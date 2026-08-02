// windows/RNInoPlayer/InoPlayerModule.h
//
// React Native Windows TurboModule for react-native-ino-player.
//
// Engine: Windows.Media.Playback.MediaPlayer (WinRT)
//   This is the canonical Windows media engine — same API on:
//   • Windows 10 (version 1607 / build 14393) — minimum
//   • Windows 10 22H2
//   • Windows 11 (all versions)
//   • Xbox (Windows gaming)
//   • Surface Hub
//   • HoloLens 2 (limited audio support)
//
// FEATURES:
//   MediaPlayer:              Playback, seek, rate, volume
//   MediaPlaybackList:        Queue management, auto-advance
//   SystemMediaTransportControls: Lock screen / taskbar media controls
//   BackgroundMediaPlayer:    Background audio when window is minimized
//   MediaPlaybackSession:     Position, duration, buffered state
//
// LIMITATIONS vs Android/iOS:
//   • No Android Auto / CarPlay / Wear OS / TV (not applicable on Windows)
//   • Chromecast: Google Cast SDK is available for UWP but requires
//     separate setup — hook is provided in showCastDialog()
//   • No built-in disk caching — Windows.Media handles HTTP caching
//     via WinINet/WinHTTP automatically
//
// EVENTS:
//   All events are emitted via RCTDeviceEventEmitter through
//   m_reactContext.CallJSFunction("RCTDeviceEventEmitter","emit",[...])
//   matching the Android/iOS event names exactly.

#pragma once
#include "pch.h"
#include "WindowsQueueManager.h"

namespace winrt::RNInoPlayer {

using namespace winrt::Windows::Media::Playback;
using namespace winrt::Windows::Media::Core;
using namespace winrt::Windows::System::Threading;

REACT_MODULE(InoPlayerModule, L"RNInoPlayer")
struct InoPlayerModule {

  // ── React context (injected by RN Windows runtime) ─────────────────────────
  REACT_INIT(Initialize)
  void Initialize(Microsoft::ReactNative::ReactContext const& reactContext) noexcept;

  // ── RCTEventEmitter stubs (required by JS NativeEventEmitter) ──────────────
  REACT_METHOD(addListener, L"addListener")
  void addListener(std::string eventName) noexcept;

  REACT_METHOD(removeListeners, L"removeListeners")
  void removeListeners(int count) noexcept;

  // ── Lifecycle ───────────────────────────────────────────────────────────────
  REACT_METHOD(setupPlayer, L"setupPlayer")
  void setupPlayer(
    Microsoft::ReactNative::JSValueObject options,
    std::function<void(bool)> resolve,
    std::function<void(std::string, std::string)> reject) noexcept;

  REACT_METHOD(destroy, L"destroy")
  void destroy(
    std::function<void()> resolve,
    std::function<void(std::string, std::string)> reject) noexcept;

  REACT_METHOD(updateOptions, L"updateOptions")
  void updateOptions(
    Microsoft::ReactNative::JSValueObject options,
    std::function<void()> resolve,
    std::function<void(std::string, std::string)> reject) noexcept;

  REACT_METHOD(setCustomActions, L"setCustomActions")
  void setCustomActions(
    Microsoft::ReactNative::JSValueArray actions,
    std::function<void()> resolve,
    std::function<void(std::string, std::string)> reject) noexcept;

  // ── Queue ───────────────────────────────────────────────────────────────────
  REACT_METHOD(setQueue, L"setQueue")
  void setQueue(
    Microsoft::ReactNative::JSValueArray tracks,
    int initialIndex,
    std::function<void()> resolve,
    std::function<void(std::string, std::string)> reject) noexcept;

  REACT_METHOD(add, L"add")
  void add(
    Microsoft::ReactNative::JSValueArray tracks,
    int insertBeforeIndex,
    std::function<void()> resolve,
    std::function<void(std::string, std::string)> reject) noexcept;

  REACT_METHOD(remove, L"remove")
  void remove(
    int index,
    std::function<void()> resolve,
    std::function<void(std::string, std::string)> reject) noexcept;

  REACT_METHOD(move, L"move")
  void move(
    int fromIndex,
    int toIndex,
    std::function<void()> resolve,
    std::function<void(std::string, std::string)> reject) noexcept;

  REACT_METHOD(updateMetadataForTrack, L"updateMetadataForTrack")
  void updateMetadataForTrack(
    int index,
    Microsoft::ReactNative::JSValueObject metadata,
    std::function<void()> resolve,
    std::function<void(std::string, std::string)> reject) noexcept;

  REACT_METHOD(clearQueue, L"clearQueue")
  void clearQueue(
    std::function<void()> resolve,
    std::function<void(std::string, std::string)> reject) noexcept;

  // ── Navigation ──────────────────────────────────────────────────────────────
  REACT_METHOD(skip, L"skip")
  void skip(
    int index,
    double initialPosition,
    std::function<void()> resolve,
    std::function<void(std::string, std::string)> reject) noexcept;

  REACT_METHOD(skipToNext, L"skipToNext")
  void skipToNext(
    double initialPosition,
    std::function<void()> resolve,
    std::function<void(std::string, std::string)> reject) noexcept;

  REACT_METHOD(skipToPrevious, L"skipToPrevious")
  void skipToPrevious(
    double initialPosition,
    std::function<void()> resolve,
    std::function<void(std::string, std::string)> reject) noexcept;

  // ── Transport ───────────────────────────────────────────────────────────────
  REACT_METHOD(play, L"play")
  void play(
    std::function<void()> resolve,
    std::function<void(std::string, std::string)> reject) noexcept;

  REACT_METHOD(pause, L"pause")
  void pause(
    std::function<void()> resolve,
    std::function<void(std::string, std::string)> reject) noexcept;

  REACT_METHOD(stop, L"stop")
  void stop(
    std::function<void()> resolve,
    std::function<void(std::string, std::string)> reject) noexcept;

  REACT_METHOD(seekTo, L"seekTo")
  void seekTo(
    double position,
    std::function<void()> resolve,
    std::function<void(std::string, std::string)> reject) noexcept;

  REACT_METHOD(seekBy, L"seekBy")
  void seekBy(
    double offset,
    std::function<void()> resolve,
    std::function<void(std::string, std::string)> reject) noexcept;

  REACT_METHOD(setRate, L"setRate")
  void setRate(
    double rate,
    std::function<void()> resolve,
    std::function<void(std::string, std::string)> reject) noexcept;

  REACT_METHOD(setVolume, L"setVolume")
  void setVolume(
    double volume,
    std::function<void()> resolve,
    std::function<void(std::string, std::string)> reject) noexcept;

  REACT_METHOD(fadeVolumeTo, L"fadeVolumeTo")
  void fadeVolumeTo(
    double targetVolume,
    double durationMs,
    std::function<void()> resolve,
    std::function<void(std::string, std::string)> reject) noexcept;

  // ── Mode ────────────────────────────────────────────────────────────────────
  REACT_METHOD(setRepeatMode, L"setRepeatMode")
  void setRepeatMode(
    std::string mode,
    std::function<void()> resolve,
    std::function<void(std::string, std::string)> reject) noexcept;

  REACT_METHOD(setShuffle, L"setShuffle")
  void setShuffle(
    bool enabled,
    std::function<void()> resolve,
    std::function<void(std::string, std::string)> reject) noexcept;

  // ── Sleep timer ─────────────────────────────────────────────────────────────
  REACT_METHOD(setSleepTimer, L"setSleepTimer")
  void setSleepTimer(
    Microsoft::ReactNative::JSValueObject config,
    std::function<void()> resolve,
    std::function<void(std::string, std::string)> reject) noexcept;

  REACT_METHOD(cancelSleepTimer, L"cancelSleepTimer")
  void cancelSleepTimer(
    std::function<void()> resolve,
    std::function<void(std::string, std::string)> reject) noexcept;

  REACT_METHOD(getSleepTimerRemaining, L"getSleepTimerRemaining")
  void getSleepTimerRemaining(
    std::function<void(double)> resolve,
    std::function<void(std::string, std::string)> reject) noexcept;

  // ── Cache / preload ─────────────────────────────────────────────────────────
  REACT_METHOD(preloadTrack, L"preloadTrack")
  void preloadTrack(
    std::string url,
    std::string headersJson,
    std::function<void()> resolve,
    std::function<void(std::string, std::string)> reject) noexcept;

  REACT_METHOD(clearCache, L"clearCache")
  void clearCache(
    std::function<void()> resolve,
    std::function<void(std::string, std::string)> reject) noexcept;

  REACT_METHOD(getCacheSize, L"getCacheSize")
  void getCacheSize(
    std::function<void(double)> resolve,
    std::function<void(std::string, std::string)> reject) noexcept;

  // ── Getters ─────────────────────────────────────────────────────────────────
  REACT_METHOD(getState, L"getState")
  void getState(
    std::function<void(std::string)> resolve,
    std::function<void(std::string, std::string)> reject) noexcept;

  REACT_METHOD(getProgress, L"getProgress")
  void getProgress(
    std::function<void(Microsoft::ReactNative::JSValueObject)> resolve,
    std::function<void(std::string, std::string)> reject) noexcept;

  REACT_METHOD(getRate, L"getRate")
  void getRate(
    std::function<void(double)> resolve,
    std::function<void(std::string, std::string)> reject) noexcept;

  REACT_METHOD(getVolume, L"getVolume")
  void getVolume(
    std::function<void(double)> resolve,
    std::function<void(std::string, std::string)> reject) noexcept;

  REACT_METHOD(getRepeatMode, L"getRepeatMode")
  void getRepeatMode(
    std::function<void(std::string)> resolve,
    std::function<void(std::string, std::string)> reject) noexcept;

  REACT_METHOD(getShuffle, L"getShuffle")
  void getShuffle(
    std::function<void(bool)> resolve,
    std::function<void(std::string, std::string)> reject) noexcept;

  REACT_METHOD(getQueue, L"getQueue")
  void getQueue(
    std::function<void(Microsoft::ReactNative::JSValueArray)> resolve,
    std::function<void(std::string, std::string)> reject) noexcept;

  REACT_METHOD(getActiveTrackIndex, L"getActiveTrackIndex")
  void getActiveTrackIndex(
    std::function<void(int)> resolve,
    std::function<void(std::string, std::string)> reject) noexcept;

  REACT_METHOD(getActiveTrack, L"getActiveTrack")
  void getActiveTrack(
    std::function<void(Microsoft::ReactNative::JSValue)> resolve,
    std::function<void(std::string, std::string)> reject) noexcept;

  // ── Cast (stub) ─────────────────────────────────────────────────────────────
  REACT_METHOD(getCastState, L"getCastState")
  void getCastState(
    std::function<void(Microsoft::ReactNative::JSValueObject)> resolve,
    std::function<void(std::string, std::string)> reject) noexcept;

  REACT_METHOD(showAirPlayPicker, L"showAirPlayPicker")
  void showAirPlayPicker(
    std::function<void()> resolve,
    std::function<void(std::string, std::string)> reject) noexcept;

  REACT_METHOD(showCastDialog, L"showCastDialog")
  void showCastDialog(
    std::function<void()> resolve,
    std::function<void(std::string, std::string)> reject) noexcept;

  // ── Car browse (stub — not applicable on Windows) ───────────────────────────
  REACT_METHOD(provideCarBrowseItems, L"provideCarBrowseItems")
  void provideCarBrowseItems(
    std::string parentId,
    Microsoft::ReactNative::JSValueArray items,
    std::function<void()> resolve,
    std::function<void(std::string, std::string)> reject) noexcept;

private:
  Microsoft::ReactNative::ReactContext m_reactContext;

  // ── Media engine ─────────────────────────────────────────────────────────
  MediaPlayer              m_player{ nullptr };
  MediaPlaybackList        m_playbackList{ nullptr };
  WindowsQueueManager      m_queue;
  std::mutex               m_mutex;

  // ── State ─────────────────────────────────────────────────────────────────
  std::string m_repeatMode   = "off";
  bool        m_shuffle      = false;
  bool        m_isSetup      = false;

  // ── Sleep timer ───────────────────────────────────────────────────────────
  ThreadPoolTimer m_sleepTimer{ nullptr };
  double          m_sleepRemaining  = -1.0;
  bool            m_sleepFadeOut    = true;
  double          m_sleepFadeDuration = 10.0;
  bool            m_sleepEndOfTrack   = false;

  // ── Volume fade ───────────────────────────────────────────────────────────
  ThreadPoolTimer m_fadeTimer{ nullptr };

  // ── Progress ──────────────────────────────────────────────────────────────
  ThreadPoolTimer m_progressTimer{ nullptr };
  double          m_progressInterval = 1.0; // seconds

  // ── SMTC (System Media Transport Controls) ────────────────────────────────
  Windows::Media::SystemMediaTransportControls m_smtc{ nullptr };

  // ── Internal helpers ──────────────────────────────────────────────────────
  void setupMediaPlayer(const Microsoft::ReactNative::JSValueObject& options);
  void setupSMTC();
  void updateSMTC();
  void attachPlayerEvents();
  void emitEvent(const std::string& name, Microsoft::ReactNative::JSValueObject payload);
  void emitStateChange();
  std::string currentState();
  void startProgressTimer();
  void stopProgressTimer();
  void cancelSleepTimerInternal();
  void fireSleepTimer();
  void startFade(double from, double to, double durationMs);
  void handleTrackChange(uint32_t index);
};

} // namespace winrt::RNInoPlayer
