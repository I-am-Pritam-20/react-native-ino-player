package com.inoplayer.service
import android.app.PendingIntent; import android.content.Intent; import android.os.Binder; import android.os.Bundle; import android.os.IBinder
import androidx.annotation.OptIn; import androidx.media3.common.MediaItem; import androidx.media3.common.MediaMetadata; import androidx.media3.common.util.UnstableApi
import androidx.media3.datasource.cache.LeastRecentlyUsedCacheEvictor; import androidx.media3.datasource.cache.SimpleCache; import androidx.media3.database.StandaloneDatabaseProvider
import androidx.media3.session.*
import com.facebook.react.bridge.ReadableArray; import com.google.common.collect.ImmutableList; import com.google.common.util.concurrent.Futures; import com.google.common.util.concurrent.ListenableFuture; import com.google.common.util.concurrent.SettableFuture
import com.inoplayer.player.CarBrowseRegistry; import com.inoplayer.player.PlayerController; import kotlinx.coroutines.*; import java.io.File

@OptIn(UnstableApi::class)
class InoPlayerService : MediaLibraryService() {
    inner class LocalBinder : Binder() { fun controller(): PlayerController = playerController }
    private val binder = LocalBinder()
    private lateinit var playerController: PlayerController
    private lateinit var librarySession: MediaLibrarySession
    private val scope = CoroutineScope(Dispatchers.Main + SupervisorJob())

    companion object {
        @Volatile private var _cache: SimpleCache? = null
        fun getOrCreateCache(dir: File, maxBytes: Long): SimpleCache = _cache ?: synchronized(this) {
            _cache ?: SimpleCache(File(dir, "ino_media_cache"), LeastRecentlyUsedCacheEvictor(maxBytes), StandaloneDatabaseProvider(dir)).also { _cache = it }
        }
    }

    override fun onCreate() {
        super.onCreate()
        val cache = getOrCreateCache(cacheDir, 1_073_741_824L)
        playerController = PlayerController(this, cache)
        librarySession = MediaLibrarySession.Builder(this, buildPlaceholderPlayer(), buildCallback())
            .setSessionActivity(buildPendingIntent()).build()
    }

    override fun onBind(intent: Intent): IBinder { super.onBind(intent); return binder }
    override fun onGetSession(info: MediaSession.ControllerInfo): MediaLibrarySession = librarySession
    override fun onDestroy() { scope.cancel(); playerController.destroy(); librarySession.release(); super.onDestroy() }

    private fun buildCallback() = object : MediaLibrarySession.Callback {
        override fun onGetLibraryRoot(session: MediaLibrarySession, browser: MediaSession.ControllerInfo, params: LibraryParams?): ListenableFuture<LibraryResult<MediaItem>> {
            val root = MediaItem.Builder().setMediaId("root").setMediaMetadata(MediaMetadata.Builder().setIsBrowsable(true).setIsPlayable(false).setTitle("Library").build()).build()
            return Futures.immediateFuture(LibraryResult.ofItem(root, params))
        }
        override fun onGetChildren(session: MediaLibrarySession, browser: MediaSession.ControllerInfo, parentId: String, page: Int, pageSize: Int, params: LibraryParams?): ListenableFuture<LibraryResult<ImmutableList<MediaItem>>> {
            val future = SettableFuture.create<LibraryResult<ImmutableList<MediaItem>>>()
            val eventMap = com.facebook.react.bridge.Arguments.createMap().apply { putString("id", parentId); putString("parentId", if (parentId == "root") null.toString() else parentId) }
            playerController.emitter?.invoke("car-browse-item-selected", eventMap)
            scope.launch {
                try {
                    val raw: ReadableArray = CarBrowseRegistry.await(parentId)
                    val items = (0 until raw.size()).mapNotNull { raw.getMap(it) }.map { m ->
                        MediaItem.Builder().setMediaId(m.getString("id") ?: "").setMediaMetadata(
                            MediaMetadata.Builder().setTitle(m.getString("title")).setSubtitle(if (m.hasKey("subtitle")) m.getString("subtitle") else null)
                                .setArtworkUri(if (m.hasKey("artworkUri")) android.net.Uri.parse(m.getString("artworkUri")) else null)
                                .setIsPlayable(m.hasKey("playable") && m.getBoolean("playable")).setIsBrowsable(m.hasKey("browsable") && m.getBoolean("browsable")).build()
                        ).build()
                    }
                    future.set(LibraryResult.ofItemList(ImmutableList.copyOf(items), params))
                } catch (_: Exception) { future.set(LibraryResult.ofError(LibraryResult.RESULT_ERROR_UNKNOWN)) }
            }
            return future
        }
        override fun onCustomCommand(session: MediaSession, controller: MediaSession.ControllerInfo, customCommand: SessionCommand, args: Bundle): ListenableFuture<SessionResult> {
            val cmd = customCommand.customAction
            if (cmd.startsWith("CUSTOM_")) { val eventMap = com.facebook.react.bridge.Arguments.createMap().apply { putString("id", cmd.removePrefix("CUSTOM_")) }; playerController.emitter?.invoke("remote-custom-action", eventMap) }
            return Futures.immediateFuture(SessionResult(SessionResult.RESULT_SUCCESS))
        }
    }

    private fun buildPendingIntent(): PendingIntent { val intent = packageManager.getLaunchIntentForPackage(packageName) ?: Intent(); return PendingIntent.getActivity(this, 0, intent, PendingIntent.FLAG_IMMUTABLE or PendingIntent.FLAG_UPDATE_CURRENT) }
    private fun buildPlaceholderPlayer(): androidx.media3.common.Player = androidx.media3.exoplayer.ExoPlayer.Builder(this).build()
}
