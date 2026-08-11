package com.inoplayer.cast
import android.content.Context; import android.util.Log
import androidx.annotation.OptIn; import androidx.media3.cast.CastPlayer; import androidx.media3.cast.SessionAvailabilityListener; import androidx.media3.common.util.UnstableApi
import androidx.media3.exoplayer.ExoPlayer; import com.facebook.react.bridge.Arguments; import com.facebook.react.bridge.WritableMap
import com.google.android.gms.cast.framework.*
typealias CastEmitter = (event: String, payload: WritableMap?) -> Unit
@OptIn(UnstableApi::class)
class InoCastManager(private val context: Context, private val emitter: CastEmitter) {
    companion object {
        fun isAvailable() = try { Class.forName("com.google.android.gms.cast.framework.CastContext"); true } catch (_: ClassNotFoundException) { false }
    }
    private var castPlayer: CastPlayer? = null
    val castState: String get() = try { when (CastContext.getSharedInstance(context).castState) { CastState.NO_DEVICES_AVAILABLE -> "no_devices"; CastState.NOT_CONNECTED -> "not_connected"; CastState.CONNECTING -> "connecting"; CastState.CONNECTED -> "connected"; else -> "no_devices" } } catch (_: Exception) { "no_devices" }
    fun init(local: ExoPlayer, onSwitch: (androidx.media3.common.Player) -> Unit) {
        if (!isAvailable()) return
        try {
            val cp = CastPlayer(CastContext.getSharedInstance(context)); castPlayer = cp
            cp.setSessionAvailabilityListener(object : SessionAvailabilityListener {
                override fun onCastSessionAvailable() { onSwitch(cp); emitter("cast-state-changed", Arguments.createMap().apply { putString("state", "connected") }) }
                override fun onCastSessionUnavailable() { onSwitch(local); emitter("cast-state-changed", Arguments.createMap().apply { putString("state", "not_connected") }) }
            })
        } catch (e: Exception) { Log.e("InoCast", "Cast init failed: ${e.message}") }
    }
    fun showCastDialog() {}
    fun release() { castPlayer?.setSessionAvailabilityListener(null); castPlayer?.release(); castPlayer = null }
}
open class InoCastOptionsProvider : OptionsProvider {
    open fun getReceiverApplicationId() = com.google.android.gms.cast.framework.media.CastMediaControlIntent.DEFAULT_MEDIA_RECEIVER_APPLICATION_ID
    override fun getCastOptions(context: Context) = CastOptions.Builder().setReceiverApplicationId(getReceiverApplicationId()).build()
    override fun getAdditionalSessionProviders(context: Context) = null
}
