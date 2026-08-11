package com.inoplayer.notification
import android.app.NotificationChannel; import android.app.NotificationManager; import android.content.Context; import android.os.Build
import androidx.media3.session.CommandButton; import androidx.media3.session.MediaSession
import com.facebook.react.bridge.*; import com.google.common.collect.ImmutableList; import org.json.JSONArray
typealias NotifEmitter = (event: String, payload: WritableMap?) -> Unit
internal class InoNotificationManager(private val context: Context, private val session: MediaSession, private val emitter: NotifEmitter) {
    private val sys = context.getSystemService(Context.NOTIFICATION_SERVICE) as NotificationManager
    private var capabilities = listOf<String>(); private var customActions = listOf<CustomDef>()
    data class CustomDef(val id: String, val title: String, val icon: String, val showIn: String)
    init { if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) { sys.createNotificationChannel(NotificationChannel("ino_player_playback", "Media Playback", NotificationManager.IMPORTANCE_LOW).apply { setShowBadge(false); setSound(null, null) }) } }
    fun updateOptions(options: ReadableMap) {
        val capJson = if (options.hasKey("capabilitiesJson")) options.getString("capabilitiesJson") else null
        if (capJson != null) { capabilities = try { val a = JSONArray(capJson); (0 until a.length()).map { a.getString(it) } } catch (_: Exception) { listOf() } }
        val actJson = if (options.hasKey("customActionsJson")) options.getString("customActionsJson") else null
        if (actJson != null) parseActionsJson(actJson); rebuildLayout()
    }
    fun setCustomActions(raw: ReadableArray) {
        customActions = (0 until raw.size()).mapNotNull { raw.getMap(it) }.mapNotNull { m -> val id = m.getString("id") ?: return@mapNotNull null; CustomDef(id, m.getString("title") ?: "", m.getString("icon") ?: "", m.getString("showIn") ?: "both") }
        rebuildLayout()
    }
    private fun parseActionsJson(json: String) { try { val a = JSONArray(json); customActions = (0 until a.length()).map { val o = a.getJSONObject(it); CustomDef(o.getString("id"), o.optString("title"), o.optString("icon"), o.optString("showIn", "both")) } } catch (_: Exception) {} }
    private fun rebuildLayout() {
        val buttons = mutableListOf<CommandButton>()
        if ("skipToPrevious" in capabilities) buttons += CommandButton.Builder().setDisplayName("Previous").setIconResId(android.R.drawable.ic_media_previous).setSessionCommand(androidx.media3.session.SessionCommand("COMMAND_SEEK_TO_PREVIOUS", android.os.Bundle.EMPTY)).build()
        if ("skipToNext" in capabilities) buttons += CommandButton.Builder().setDisplayName("Next").setIconResId(android.R.drawable.ic_media_next).setSessionCommand(androidx.media3.session.SessionCommand("COMMAND_SEEK_TO_NEXT", android.os.Bundle.EMPTY)).build()
        customActions.filter { it.showIn == "notification" || it.showIn == "both" }.forEach { a ->
            val res = context.resources.getIdentifier(a.icon, "drawable", context.packageName).takeIf { it != 0 } ?: android.R.drawable.ic_media_play
            buttons += CommandButton.Builder().setDisplayName(a.title).setIconResId(res).setSessionCommand(androidx.media3.session.SessionCommand("CUSTOM_${a.id}", android.os.Bundle.EMPTY)).build()
        }
        session.setCustomLayout(ImmutableList.copyOf(buttons))
    }
}
