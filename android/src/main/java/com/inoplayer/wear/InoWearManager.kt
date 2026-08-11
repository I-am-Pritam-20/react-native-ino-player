package com.inoplayer.wear
import android.content.Context; import android.util.Log
import com.facebook.react.bridge.Arguments; import com.facebook.react.bridge.WritableMap
typealias WearEmitter = (event: String, payload: WritableMap?) -> Unit
typealias WearCommandHandler = (command: String, data: Map<String, Any>) -> Unit
class InoWearManager(private val context: Context, private val emitter: WearEmitter, private val onCommand: WearCommandHandler) {
    companion object { fun isAvailable() = try { Class.forName("com.google.android.gms.wearable.Wearable"); true } catch (_: ClassNotFoundException) { false } }
    fun syncState(state: String, position: Double, duration: Double) { if (!isAvailable()) return; try { sendData("/ino-player/state", mapOf("state" to state, "position" to position, "duration" to duration, "ts" to System.currentTimeMillis())) } catch (e: Exception) { Log.w("InoWear", "Sync state failed: ${e.message}") } }
    fun syncTrack(trackJson: String) { if (!isAvailable()) return; try { sendData("/ino-player/track", mapOf("track" to trackJson)) } catch (e: Exception) { Log.w("InoWear", "Sync track failed: ${e.message}") } }
    private fun sendData(path: String, data: Map<String, Any>) {
        try {
            val wearableClass = Class.forName("com.google.android.gms.wearable.Wearable")
            val getDataClient = wearableClass.getMethod("getDataClient", Context::class.java); val dc = getDataClient.invoke(null, context)
            val reqClass = Class.forName("com.google.android.gms.wearable.PutDataMapRequest"); val create = reqClass.getMethod("create", String::class.java); val req = create.invoke(null, path)
            val getMap = req.javaClass.getMethod("getDataMap"); val dm = getMap.invoke(req)
            val putString = dm.javaClass.getMethod("putString", String::class.java, String::class.java); val putDouble = dm.javaClass.getMethod("putDouble", String::class.java, Double::class.java); val putLong = dm.javaClass.getMethod("putLong", String::class.java, Long::class.java)
            data.forEach { (k, v) -> when (v) { is String -> putString.invoke(dm, k, v); is Double -> putDouble.invoke(dm, k, v); is Long -> putLong.invoke(dm, k, v); else -> putString.invoke(dm, k, v.toString()) } }
            val asPut = req.javaClass.getMethod("asPutDataRequest"); val putReq = asPut.invoke(req)
            val putItems = dc.javaClass.getMethod("putDataItem", Class.forName("com.google.android.gms.wearable.PutDataRequest")); putItems.invoke(dc, putReq)
        } catch (_: Exception) {}
    }
}
