package com.inoplayer

import android.content.ComponentName;
import android.content.Context;
import android.content.Intent;
import android.content.ServiceConnection;
import android.os.IBinder
import com.facebook.react.bridge.*;
import com.facebook.react.module.annotations.ReactModule;
import com.facebook.react.modules.core.DeviceEventManagerModule
import com.inoplayer.player.PlayerController;
import com.inoplayer.service.InoPlayerService;
import com.inoplayer.service.InoPlayerService.LocalBinder;
import kotlinx.coroutines.*

@ReactModule(name = InoPlayerModule.NAME)
class InoPlayerModule(private val reactContext: ReactApplicationContext) : ReactContextBaseJavaModule(reactContext) {
    companion object { const val NAME = "RNInoPlayer" }
    private val scope = CoroutineScope(Dispatchers.Main + SupervisorJob())
    private var controller: PlayerController? = null
    private var serviceReady = CompletableDeferred<PlayerController>()
    private val connection = object : ServiceConnection {
        override fun onServiceConnected(name: ComponentName, binder: IBinder) {
            val ctrl = (binder as LocalBinder).controller(); controller = ctrl
            ctrl.emitter = { event, payload -> sendEvent(event, payload) }
            if (!serviceReady.isCompleted) serviceReady.complete(ctrl)
        }
        override fun onServiceDisconnected(name: ComponentName) { controller = null }
    }
    override fun getName() = NAME
    @ReactMethod fun addListener(eventName: String) {}
    @ReactMethod fun removeListeners(count: Double) {}
    @ReactMethod fun setupPlayer(options: ReadableMap, promise: Promise) {
        serviceReady = CompletableDeferred()
        val intent = Intent(reactContext, InoPlayerService::class.java)
        reactContext.startForegroundService(intent)
        reactContext.bindService(intent, connection, Context.BIND_AUTO_CREATE)
        scope.launch { try { val c = serviceReady.await(); c.configure(options); promise.resolve(true) } catch (e: Exception) { promise.reject("SETUP_ERROR", e.message, e) } }
    }
    @ReactMethod fun destroy(promise: Promise) = scope.launch { safeResolve(promise) { controller?.destroy(); runCatching { reactContext.unbindService(connection) }; reactContext.stopService(Intent(reactContext, InoPlayerService::class.java)) } }
    @ReactMethod fun updateOptions(options: ReadableMap, promise: Promise) = dispatch(promise) { it.updateOptions(options) }
    @ReactMethod fun setCustomActions(actions: ReadableArray, promise: Promise) = dispatch(promise) { it.setCustomActions(actions) }
    @ReactMethod fun setQueue(tracks: ReadableArray, initialIndex: Double, promise: Promise) = dispatch(promise) { it.setQueue(tracks, initialIndex.toInt()) }
    @ReactMethod fun add(tracks: ReadableArray, insertBeforeIndex: Double, promise: Promise) = dispatch(promise) { it.add(tracks, insertBeforeIndex.toInt()) }
    @ReactMethod fun remove(index: Double, promise: Promise) = dispatch(promise) { it.remove(index.toInt()) }
    @ReactMethod fun move(fromIndex: Double, toIndex: Double, promise: Promise) = dispatch(promise) { it.move(fromIndex.toInt(), toIndex.toInt()) }
    @ReactMethod fun updateMetadataForTrack(index: Double, metadata: ReadableMap, promise: Promise) = dispatch(promise) { it.updateMetadataForTrack(index.toInt(), metadata) }
    @ReactMethod fun clearQueue(promise: Promise) = dispatch(promise) { it.clearQueue() }
    @ReactMethod fun skip(index: Double, initialPosition: Double, promise: Promise) = dispatch(promise) { it.skip(index.toInt(), initialPosition) }
    @ReactMethod fun skipToNext(initialPosition: Double, promise: Promise) = dispatch(promise) { it.skipToNext(initialPosition) }
    @ReactMethod fun skipToPrevious(initialPosition: Double, promise: Promise) = dispatch(promise) { it.skipToPrevious(initialPosition) }
    @ReactMethod fun play(promise: Promise) = dispatch(promise) { it.play() }
    @ReactMethod fun pause(promise: Promise) = dispatch(promise) { it.pause() }
    @ReactMethod fun stop(promise: Promise) = dispatch(promise) { it.stop() }
    @ReactMethod fun seekTo(position: Double, promise: Promise) = dispatch(promise) { it.seekTo(position) }
    @ReactMethod fun seekBy(offset: Double, promise: Promise) = dispatch(promise) { it.seekBy(offset) }
    @ReactMethod fun setRate(rate: Double, promise: Promise) = dispatch(promise) { it.setRate(rate.toFloat()) }
    @ReactMethod fun setVolume(volume: Double, promise: Promise) = dispatch(promise) { it.setVolume(volume.toFloat()) }
    @ReactMethod fun fadeVolumeTo(targetVolume: Double, durationMs: Double, promise: Promise) = dispatch(promise) { it.fadeVolumeTo(targetVolume.toFloat(), durationMs.toLong()) }
    @ReactMethod fun setRepeatMode(mode: String, promise: Promise) = dispatch(promise) { it.setRepeatMode(mode) }
    @ReactMethod fun setShuffle(enabled: Boolean, promise: Promise) = dispatch(promise) { it.setShuffle(enabled) }
    @ReactMethod fun setSleepTimer(config: ReadableMap, promise: Promise) = dispatch(promise) { it.setSleepTimer(config) }
    @ReactMethod fun cancelSleepTimer(promise: Promise) = dispatch(promise) { it.cancelSleepTimer() }
    @ReactMethod fun getSleepTimerRemaining(promise: Promise) = dispatchGet(promise) { it.getSleepTimerRemaining().toDouble() }
    @ReactMethod fun preloadTrack(url: String, headersJson: String, promise: Promise) = dispatch(promise) { it.preloadTrack(url, headersJson) }
    @ReactMethod fun clearCache(promise: Promise) = dispatch(promise) { it.clearCache() }
    @ReactMethod fun getCacheSize(promise: Promise) = dispatchGet(promise) { it.getCacheSize().toDouble() }
    @ReactMethod fun getState(promise: Promise) = dispatchGet(promise) { it.getState() }
    @ReactMethod fun getProgress(promise: Promise) = dispatchGet(promise) { it.getProgress() }
    @ReactMethod fun getRate(promise: Promise) = dispatchGet(promise) { it.getRate().toDouble() }
    @ReactMethod fun getVolume(promise: Promise) = dispatchGet(promise) { it.getVolume().toDouble() }
    @ReactMethod fun getRepeatMode(promise: Promise) = dispatchGet(promise) { it.getRepeatMode() }
    @ReactMethod fun getShuffle(promise: Promise) = dispatchGet(promise) { it.getShuffle() }
    @ReactMethod fun getQueue(promise: Promise) = dispatchGet(promise) { it.getQueueAsWritableArray() }
    @ReactMethod fun getActiveTrackIndex(promise: Promise) = dispatchGet(promise) { it.getActiveTrackIndex() }
    @ReactMethod fun getActiveTrack(promise: Promise) = dispatchGet(promise) { it.getActiveTrack() }
    @ReactMethod fun getCastState(promise: Promise) = dispatchGet(promise) { it.getCastStateMap() }
    @ReactMethod fun showAirPlayPicker(promise: Promise) { promise.resolve(null) }
    @ReactMethod fun showCastDialog(promise: Promise) = dispatch(promise) { it.showCastDialog() }
    @ReactMethod fun provideCarBrowseItems(parentId: String, items: ReadableArray, promise: Promise) = dispatch(promise) { it.provideCarBrowseItems(parentId, items) }
    private fun dispatch(promise: Promise, block: (PlayerController) -> Unit) { scope.launch { safeResolve(promise) { block(require()) } } }
    private fun <T> dispatchGet(promise: Promise, block: (PlayerController) -> T) { scope.launch { try { promise.resolve(block(require())) } catch (e: Exception) { promise.reject("PLAYER_ERROR", e.message, e) } } }
    private suspend fun safeResolve(promise: Promise, block: suspend () -> Unit) { try { block(); promise.resolve(null) } catch (e: Exception) { promise.reject("PLAYER_ERROR", e.message, e) } }
    private fun require(): PlayerController = controller ?: throw IllegalStateException("[InoPlayer] setupPlayer() not called")
    private fun sendEvent(name: String, payload: WritableMap?) { reactContext.getJSModule(DeviceEventManagerModule.RCTDeviceEventEmitter::class.java).emit(name, payload) }
    override fun onCatalystInstanceDestroy() { scope.cancel(); super.onCatalystInstanceDestroy() }
}
