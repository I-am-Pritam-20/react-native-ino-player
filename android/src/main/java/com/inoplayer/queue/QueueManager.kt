package com.inoplayer.queue
import android.net.Uri
import androidx.media3.common.MediaItem; import androidx.media3.common.MediaMetadata
import com.facebook.react.bridge.*
import org.json.JSONObject
internal data class TrackData(
    val id: String, val url: String, val title: String,
    val artist: String?, val album: String?, val artwork: String?,
    val duration: Double, val contentType: String, val localUri: String?,
    val type: String?, val headers: Map<String, String>,
    val pitchAlgorithm: String?, val userInfoJson: String?,
)
internal class QueueManager {
    private val _tracks = mutableListOf<TrackData>()
    val tracks: List<TrackData> get() = _tracks
    val size: Int get() = _tracks.size
    fun setQueue(raw: ReadableArray) { _tracks.clear(); _tracks.addAll(parseArray(raw)) }
    fun add(raw: ReadableArray, insertAt: Int) { val idx = insertAt.coerceIn(0, _tracks.size); _tracks.addAll(idx, parseArray(raw)) }
    fun remove(index: Int) { if (index in _tracks.indices) _tracks.removeAt(index) }
    fun move(from: Int, to: Int) { if (from !in _tracks.indices || to !in _tracks.indices) return; val t = _tracks.removeAt(from); _tracks.add(to, t) }
    fun updateAt(index: Int, m: ReadableMap) {
        if (index !in _tracks.indices) return
        val o = _tracks[index]
        _tracks[index] = o.copy(
            title   = m.optStr("title")   ?: o.title,
            artist  = m.optStr("artist")  ?: o.artist,
            album   = m.optStr("album")   ?: o.album,
            artwork = m.optStr("artwork") ?: o.artwork,
            duration = if (m.hasKey("duration")) m.getDouble("duration") else o.duration,
        )
    }
    fun clear() = _tracks.clear()
    fun toMediaItem(i: Int) = buildItem(_tracks[i])
    fun toMediaItems() = _tracks.map { buildItem(it) }
    fun trackAt(i: Int): WritableMap? { if (i !in _tracks.indices) return null; return toMap(_tracks[i]) }
    fun toWritableArray(): WritableArray { val a = Arguments.createArray(); _tracks.forEach { a.pushMap(toMap(it)) }; return a }
    private fun buildItem(t: TrackData): MediaItem {
        val uri = Uri.parse(t.localUri ?: t.url)
        val meta = MediaMetadata.Builder().setTitle(t.title).setArtist(t.artist).setAlbumTitle(t.album)
            .setArtworkUri(t.artwork?.let { Uri.parse(it) })
            .setDurationMs(if (t.duration > 0) (t.duration * 1000).toLong() else null)
            .setMediaType(if (t.contentType == "video") MediaMetadata.MEDIA_TYPE_VIDEO else MediaMetadata.MEDIA_TYPE_MUSIC)
            .build()
        return MediaItem.Builder().setMediaId(t.id).setUri(uri).setMediaMetadata(meta).setMimeType(t.type).build()
    }
    private fun toMap(t: TrackData): WritableMap = Arguments.createMap().apply {
        putString("id", t.id); putString("url", t.url); putString("title", t.title)
        t.artist?.let { putString("artist", it) }; t.album?.let { putString("album", it) }
        t.artwork?.let { putString("artwork", it) }; putDouble("duration", t.duration)
        putString("contentType", t.contentType); t.localUri?.let { putString("localUri", it) }
        t.type?.let { putString("type", it) }; t.pitchAlgorithm?.let { putString("pitchAlgorithm", it) }
        t.userInfoJson?.let { putString("userInfoJson", it) }
        if (t.headers.isNotEmpty()) putString("headers", JSONObject(t.headers).toString())
    }
    private fun parseArray(raw: ReadableArray) = (0 until raw.size()).mapNotNull { raw.getMap(it)?.let(::parseTrack) }
    private fun parseTrack(m: ReadableMap): TrackData {
        val hJson = m.optStr("headers"); val headers = if (hJson != null) try { JSONObject(hJson).let { o -> o.keys().asSequence().associateWith { o.getString(it) } } } catch (_: Exception) { emptyMap() } else emptyMap()
        return TrackData(id = m.getString("id") ?: error("missing id"), url = m.getString("url") ?: error("missing url"), title = m.optStr("title") ?: "Unknown", artist = m.optStr("artist"), album = m.optStr("album"), artwork = m.optStr("artwork"), duration = if (m.hasKey("duration")) m.getDouble("duration") else -1.0, contentType = m.optStr("contentType") ?: "audio", localUri = m.optStr("localUri"), type = m.optStr("type"), headers = headers, pitchAlgorithm = m.optStr("pitchAlgorithm"), userInfoJson = m.optStr("userInfoJson"))
    }
    private fun ReadableMap.optStr(key: String): String? = if (hasKey(key) && getType(key) == ReadableType.String) getString(key) else null
}
