// android/src/main/java/com/inoplayer/player/PlayerController.kt
package com.inoplayer.player

import android.content.Context
import android.net.Uri
import androidx.annotation.OptIn
import androidx.media3.common.*
import androidx.media3.common.Player.*
import androidx.media3.common.util.UnstableApi
import androidx.media3.datasource.DefaultHttpDataSource
import androidx.media3.datasource.cache.*
import androidx.media3.exoplayer.ExoPlayer
import androidx.media3.exoplayer.DefaultLoadControl
import androidx.media3.exoplayer.source.DefaultMediaSourceFactory
import androidx.media3.session.MediaSession
import com.facebook.react.bridge.*
import com.inoplayer.cast.InoCastManager
import com.inoplayer.notification.InoNotificationManager
import com.inoplayer.queue.QueueManager
import com.inoplayer.wear.InoWearManager
import kotlinx.coroutines.*
import org.json.JSONObject

typealias EventEmitter = (event: String, payload: WritableMap?) -> Unit

@OptIn(UnstableApi::class)
internal class PlayerController(private val context: Context, internal val cache: SimpleCache) {
    private val scope = CoroutineScope(Dispatchers.Main + SupervisorJob())
    var emitter: EventEmitter? = null

    private lateinit var exoPlayer: ExoPlayer
    private var activePlayer: Player? = null
    private var mediaSession: MediaSession? = null
    private var notificationManager: InoNotificationManager? = null
    private var castManager: InoCastManager? = null
    private var wearManager: InoWearManager? = null

    val queueManager = QueueManager()
    private var repeatMode = "off"
    private var shuffleEnabled = false
    private var trackOnceDone = false

    private var sleepTimerJob: Job? = null
    private var sleepTimerRemaining = -1L
    private var sleepFadeOut = true
    private var sleepFadeDuration = 10L
    private var preloadWindowSize = 3
    private var progressIntervalMs = 1_000L
    private var progressJob: Job? = null
    private var fadeJob: Job? = null
    private var jumpForwardInterval = 30L
    private var jumpBackwardInterval = 15L

    fun configure(options: ReadableMap) {
        val minBuf = options.optInt("minBufferMs", 2_500); val maxBuf = options.optInt("maxBufferMs", 50_000)
        val backBuf = options.optInt("backBufferMs", 2_500)
        preloadWindowSize = options.optInt("preloadWindowSize", 3)
        jumpForwardInterval = options.optInt("jumpForwardInterval", 30).toLong()
        jumpBackwardInterval = options.optInt("jumpBackwardInterval", 15).toLong()

        val cacheFactory = CacheDataSource.Factory().setCache(cache)
            .setUpstreamDataSourceFactory(DefaultHttpDataSource.Factory().setAllowCrossProtocolRedirects(true))
            .setFlags(CacheDataSource.FLAG_IGNORE_CACHE_ON_ERROR)

        exoPlayer = ExoPlayer.Builder(context)
            .setLoadControl(DefaultLoadControl.Builder().setBufferDurationsMs(minBuf, maxBuf, minBuf, minBuf).build())
            .setMediaSourceFactory(DefaultMediaSourceFactory(context).setDataSourceFactory(cacheFactory))
            .setHandleAudioBecomingNoisy(options.optBoolean("handleAudioBecomingNoisy", true))
            .setWakeMode(when (options.optStr("androidWakeMode")) { "local" -> C.WAKE_MODE_LOCAL; "network" -> C.WAKE_MODE_NETWORK; else -> C.WAKE_MODE_NONE })
            .build().also { it.addListener(createListener()) }

        activePlayer = exoPlayer
        mediaSession = MediaSession.Builder(context, exoPlayer).build()
        notificationManager = InoNotificationManager(context, mediaSession!!) { event, payload -> emitter?.invoke(event, payload) }

        if (InoCastManager.isAvailable()) {
            castManager = InoCastManager(context) { event, payload -> emitter?.invoke(event, payload) }
                .also { cm -> cm.init(exoPlayer) { newPlayer -> activePlayer = newPlayer } }
        }
        if (InoWearManager.isAvailable()) {
            wearManager = InoWearManager(context, { event, payload -> emitter?.invoke(event, payload) }) { cmd, _ ->
                when (cmd) { "play" -> play(); "pause" -> pause(); "next" -> skipToNext(0.0); "previous" -> skipToPrevious(0.0) }
            }
        }
        startProgressEmitter()
    }

    fun setQueue(tracks: ReadableArray, initialIndex: Int) {
        queueManager.setQueue(tracks); exoPlayer.setMediaItems(queueManager.toMediaItems(), initialIndex, 0L); exoPlayer.prepare(); preloadUpcoming()
    }
    fun add(tracks: ReadableArray, insertBeforeIndex: Int) {
        val at = if (insertBeforeIndex < 0) exoPlayer.mediaItemCount else insertBeforeIndex.coerceAtMost(exoPlayer.mediaItemCount)
        val prev = queueManager.size; queueManager.add(tracks, at)
        val newItems = (prev until queueManager.size).map { queueManager.toMediaItem(it) }
        exoPlayer.addMediaItems(at, newItems); preloadUpcoming()
    }
    fun remove(index: Int) { queueManager.remove(index); exoPlayer.removeMediaItem(index) }
    fun move(fromIndex: Int, toIndex: Int) { queueManager.move(fromIndex, toIndex); exoPlayer.moveMediaItem(fromIndex, toIndex) }
    fun updateMetadataForTrack(index: Int, metadata: ReadableMap) { queueManager.updateAt(index, metadata); exoPlayer.replaceMediaItem(index, queueManager.toMediaItem(index)) }
    fun clearQueue() { queueManager.clear(); exoPlayer.clearMediaItems(); cancelSleepTimerInternal() }
    fun skip(index: Int, pos: Double) { exoPlayer.seekTo(index, (pos * 1_000).toLong()) }
    fun skipToNext(pos: Double) { if (exoPlayer.hasNextMediaItem()) { exoPlayer.seekToNext(); if (pos > 0) exoPlayer.seekTo((pos * 1_000).toLong()) } }
    fun skipToPrevious(pos: Double) {
        if (exoPlayer.currentPosition > 3_000 && pos == 0.0) exoPlayer.seekTo(0L)
        else if (exoPlayer.hasPreviousMediaItem()) { exoPlayer.seekToPrevious(); if (pos > 0) exoPlayer.seekTo((pos * 1_000).toLong()) }
    }
    fun play() { activePlayer?.play() }; fun pause() { activePlayer?.pause() }
    fun stop() { activePlayer?.stop(); exoPlayer.clearMediaItems(); queueManager.clear() }
    fun seekTo(position: Double) { activePlayer?.seekTo((position * 1_000).toLong()) }
    fun seekBy(offset: Double) {
        val p = activePlayer ?: return
        val newPos = (p.currentPosition + (offset * 1_000).toLong()).coerceAtLeast(0L).coerceAtMost(p.duration.takeIf { it > 0L } ?: Long.MAX_VALUE)
        p.seekTo(newPos)
    }
    fun setRate(rate: Float) { exoPlayer.playbackParameters = exoPlayer.playbackParameters.withSpeed(rate) }
    fun setVolume(volume: Float) { fadeJob?.cancel(); exoPlayer.volume = volume.coerceIn(0f, 1f) }
    fun fadeVolumeTo(target: Float, durationMs: Long) {
        fadeJob?.cancel(); val start = exoPlayer.volume; val delta = target - start; val steps = (durationMs / 50L).coerceAtLeast(1L)
        fadeJob = scope.launch { repeat(steps.toInt()) { step -> val f = (step + 1).toFloat() / steps; exoPlayer.volume = (start + delta * f).coerceIn(0f, 1f); delay(50L) }; exoPlayer.volume = target.coerceIn(0f, 1f) }
    }
    fun setRepeatMode(mode: String) { repeatMode = mode; trackOnceDone = false; exoPlayer.repeatMode = when (mode) { "track", "track-once" -> REPEAT_MODE_ONE; "queue" -> REPEAT_MODE_ALL; else -> REPEAT_MODE_OFF } }
    fun setShuffle(enabled: Boolean) { shuffleEnabled = enabled; exoPlayer.shuffleModeEnabled = enabled }

    fun setSleepTimer(config: ReadableMap) {
        cancelSleepTimerInternal(); sleepFadeOut = config.optBoolean("fadeOut", true); sleepFadeDuration = config.optInt("fadeDuration", 10).toLong()
        when (config.getString("mode") ?: "countdown") {
            "end-of-track" -> sleepTimerRemaining = -2L
            else -> {
                sleepTimerRemaining = config.optInt("duration", 0).toLong(); if (sleepTimerRemaining <= 0L) return
                sleepTimerJob = scope.launch { while (sleepTimerRemaining > 0L) { delay(1_000L); sleepTimerRemaining--; emitMap("sleep-timer-tick") { putDouble("remaining", sleepTimerRemaining.toDouble()) } }; fireSleepTimer() }
            }
        }
    }
    fun cancelSleepTimer() = cancelSleepTimerInternal()
    fun getSleepTimerRemaining() = sleepTimerRemaining
    private fun cancelSleepTimerInternal() { sleepTimerJob?.cancel(); sleepTimerJob = null; sleepTimerRemaining = -1L }
    private fun fireSleepTimer() {
        sleepTimerJob?.cancel(); sleepTimerJob = null; sleepTimerRemaining = -1L
        if (sleepFadeOut) { fadeVolumeTo(0f, sleepFadeDuration * 1_000L); scope.launch { delay(sleepFadeDuration * 1_000L); activePlayer?.pause(); exoPlayer.volume = 1f; emitter?.invoke("sleep-timer-fired", null) } }
        else { activePlayer?.pause(); emitter?.invoke("sleep-timer-fired", null) }
    }

    private fun preloadUpcoming() { val c = exoPlayer.currentMediaItemIndex; for (i in 1..preloadWindowSize) { val n = c + i; if (n < exoPlayer.mediaItemCount) exoPlayer.getMediaItemAt(n) } }
    fun preloadTrack(url: String, headersJson: String) { scope.launch(Dispatchers.IO) { try { val headers = if (headersJson.isNotBlank()) JSONObject(headersJson).let { o -> o.keys().asSequence().associateWith { o.getString(it) } } else emptyMap(); val f = DefaultHttpDataSource.Factory().setDefaultRequestProperties(headers); val cds = CacheDataSource(cache, f.createDataSource(), CacheDataSource.FLAG_BLOCK_ON_CACHE); CacheWriter(cds, androidx.media3.datasource.DataSpec(Uri.parse(url)), null, null).cache() } catch (_: Exception) {} } }
    fun clearCache() { scope.launch(Dispatchers.IO) { cache.keys.toList().forEach { cache.removeResource(it) } } }
    fun getCacheSize() = cache.cacheSpace

    fun updateOptions(options: ReadableMap) { progressIntervalMs = ((options.optInt("progressUpdateEventInterval", 1)) * 1_000L).coerceAtLeast(100L); progressJob?.cancel(); startProgressEmitter(); notificationManager?.updateOptions(options) }
    fun setCustomActions(actions: ReadableArray) { notificationManager?.setCustomActions(actions) }

    fun getState(): String { val p = activePlayer ?: return "none"; if (p is ExoPlayer && p.playerError != null) return "error"; return when (p.playbackState) { STATE_IDLE -> "none"; STATE_ENDED -> "ended"; STATE_BUFFERING -> if (p.playWhenReady) "buffering" else "loading"; STATE_READY -> if (p.isPlaying) "playing" else "paused"; else -> "none" } }
    fun getProgress(): WritableMap = Arguments.createMap().apply { val p = activePlayer; putDouble("position", (p?.currentPosition ?: 0L) / 1_000.0); putDouble("duration", ((p?.duration ?: 0L).takeIf { it > 0L } ?: 0L) / 1_000.0); putDouble("buffered", (p?.bufferedPosition ?: 0L) / 1_000.0) }
    fun getRate() = exoPlayer.playbackParameters.speed; fun getVolume() = exoPlayer.volume
    fun getRepeatMode() = repeatMode; fun getShuffle() = shuffleEnabled
    fun getQueueAsWritableArray() = queueManager.toWritableArray()
    fun getActiveTrackIndex() = exoPlayer.currentMediaItemIndex
    fun getActiveTrack() = queueManager.trackAt(exoPlayer.currentMediaItemIndex)
    fun getCastStateMap() = Arguments.createMap().apply { putString("state", castManager?.castState ?: "no_devices") }
    fun showCastDialog() { castManager?.showCastDialog() }
    fun provideCarBrowseItems(parentId: String, items: ReadableArray) { CarBrowseRegistry.provide(parentId, items) }

    private fun startProgressEmitter() {
        progressJob = scope.launch { while (isActive) { delay(progressIntervalMs); val p = activePlayer ?: continue; if (!p.isPlaying) continue; emitMap("playback-progress-updated") { putDouble("position", p.currentPosition / 1_000.0); putDouble("duration", (p.duration.takeIf { it > 0L } ?: 0L) / 1_000.0); putDouble("buffered", p.bufferedPosition / 1_000.0); putInt("track", exoPlayer.currentMediaItemIndex) }; wearManager?.syncState(getState(), p.currentPosition / 1_000.0, (p.duration.takeIf { it > 0L } ?: 0L) / 1_000.0) } }
    }

    private fun createListener() = object : Player.Listener {
        override fun onPlaybackStateChanged(state: Int) = emitStateChange()
        override fun onIsPlayingChanged(isPlaying: Boolean) = emitStateChange()
        override fun onMediaItemTransition(item: MediaItem?, reason: Int) {
            val idx = exoPlayer.currentMediaItemIndex
            emitMap("playback-active-track-changed") { putInt("index", idx); putMap("track", queueManager.trackAt(idx) ?: Arguments.createMap()); putInt("lastIndex", -1); putNull("lastTrack"); putDouble("lastPosition", 0.0) }
            if (repeatMode == "track-once" && reason == MEDIA_ITEM_TRANSITION_REASON_REPEAT) { if (trackOnceDone) { trackOnceDone = false; setRepeatMode("off") } else trackOnceDone = true }
            if (sleepTimerRemaining == -2L && reason == MEDIA_ITEM_TRANSITION_REASON_AUTO) { sleepTimerRemaining = -1L; fireSleepTimer() }
            preloadUpcoming(); val t = queueManager.trackAt(idx); if (t != null) wearManager?.syncTrack(t.toString())
        }
        override fun onPlayerError(error: PlaybackException) { emitMap("playback-state") { putString("state", "error"); putMap("error", Arguments.createMap().apply { putString("code", error.errorCodeName); putString("message", error.message ?: "Playback error") }) } }
    }

    private fun emitStateChange() { val s = getState(); emitMap("playback-state") { putString("state", s) }; if (s == "ended") emitMap("playback-queue-ended") { putInt("index", exoPlayer.currentMediaItemIndex); putDouble("position", exoPlayer.currentPosition / 1_000.0) } }
    private fun emitMap(name: String, block: WritableMap.() -> Unit) { val map = Arguments.createMap().apply(block); emitter?.invoke(name, map) }

    fun destroy() { scope.cancel(); fadeJob?.cancel(); sleepTimerJob?.cancel(); progressJob?.cancel(); castManager?.release(); mediaSession?.release(); exoPlayer.release() }

    private fun ReadableMap.optInt(key: String, default: Int) = if (hasKey(key)) getInt(key) else default
    private fun ReadableMap.optBoolean(key: String, default: Boolean) = if (hasKey(key)) getBoolean(key) else default
    private fun ReadableMap.optStr(key: String) = if (hasKey(key) && getType(key) == ReadableType.String) getString(key) else null
}

object CarBrowseRegistry {
    private val pending = mutableMapOf<String, ReadableArray>()
    private val waiters = mutableMapOf<String, CompletableDeferred<ReadableArray>>()
    fun provide(parentId: String, items: ReadableArray) { pending[parentId] = items; waiters.remove(parentId)?.complete(items) }
    suspend fun await(parentId: String): ReadableArray { pending.remove(parentId)?.let { return it }; val d = CompletableDeferred<ReadableArray>(); waiters[parentId] = d; return withTimeout(5_000L) { d.await() } }
}
