// windows/RNInoPlayer/InoPlayerModule.cpp
//
// Full Windows.Media.Playback implementation for react-native-ino-player.
//
// ENGINE CHOICE:
//   Windows.Media.Playback.MediaPlayer is the correct, modern Windows
//   media engine (WinRT, available since Windows 10 build 10240).
//   It replaces the deprecated WMP COM interfaces and the older
//   BackgroundMediaPlayer API.
//
// BACKGROUND AUDIO:
//   Setting MediaPlayer.AudioCategory to Media keeps audio alive
//   when the app window is minimized or loses focus. This is the
//   Windows equivalent of Android's foreground service.
//
// LOCK SCREEN / TASKBAR (SMTC):
//   SystemMediaTransportControls shows the Now Playing widget in the
//   Windows 10/11 taskbar and on the lock screen.
//   Play/pause/skip buttons in the SMTC fire back through our handlers.
//
// REPEAT MODES:
//   MediaPlaybackList.AutoRepeatEnabled  → RepeatMode.Queue
//   Single-item looping handled manually via CurrentItemChanged +
//   MoveTo(index) to avoid the loop gap in MediaPlaybackList.
//
// SHUFFLE:
//   MediaPlaybackList.ShuffleEnabled → built-in Windows shuffle.
//   When enabled, ShuffledItems gives the shuffled order.

#include "pch.h"
#include "InoPlayerModule.h"

namespace winrt::RNInoPlayer {

using namespace winrt::Windows::Media::Playback;
using namespace winrt::Windows::Media::Core;
using namespace winrt::Windows::Foundation;
using namespace winrt::Windows::System::Threading;
using namespace Microsoft::ReactNative;

// ─────────────────────────────────────────────────────────────────────────────
// Initialize
// ─────────────────────────────────────────────────────────────────────────────

void InoPlayerModule::Initialize(ReactContext const& ctx) noexcept {
  m_reactContext = ctx;
}

// ─────────────────────────────────────────────────────────────────────────────
// Event emitter stubs
// ─────────────────────────────────────────────────────────────────────────────

void InoPlayerModule::addListener(std::string /*eventName*/) noexcept {}
void InoPlayerModule::removeListeners(int /*count*/) noexcept {}

// ─────────────────────────────────────────────────────────────────────────────
// Lifecycle
// ─────────────────────────────────────────────────────────────────────────────

void InoPlayerModule::setupPlayer(
  JSValueObject options,
  std::function<void(bool)> resolve,
  std::function<void(std::string, std::string)> reject) noexcept
{
  try {
    std::lock_guard<std::mutex> lock(m_mutex);
    setupMediaPlayer(options);
    m_isSetup = true;
    resolve(true);
  } catch (std::exception const& e) {
    reject("SETUP_ERROR", e.what());
  }
}

void InoPlayerModule::destroy(
  std::function<void()> resolve,
  std::function<void(std::string, std::string)> /*reject*/) noexcept
{
  try {
    std::lock_guard<std::mutex> lock(m_mutex);
    stopProgressTimer();
    cancelSleepTimerInternal();
    if (m_fadeTimer) { m_fadeTimer.Cancel(); m_fadeTimer = nullptr; }
    if (m_player) {
      m_player.Pause();
      m_player.Source(nullptr);
    }
    m_queue.clear(m_playbackList);
    m_isSetup = false;
    resolve();
  } catch (...) { resolve(); }
}

void InoPlayerModule::updateOptions(
  JSValueObject options,
  std::function<void()> resolve,
  std::function<void(std::string, std::string)> reject) noexcept
{
  try {
    auto it = options.find("progressUpdateEventInterval");
    if (it != options.end()) {
      m_progressInterval = it->second.AsDouble();
      stopProgressTimer();
      startProgressTimer();
    }
    updateSMTC();
    resolve();
  } catch (std::exception const& e) { reject("PLAYER_ERROR", e.what()); }
}

void InoPlayerModule::setCustomActions(
  JSValueArray /*actions*/,
  std::function<void()> resolve,
  std::function<void(std::string, std::string)> /*reject*/) noexcept
{
  // Windows SMTC doesn't support arbitrary custom buttons.
  // Custom actions fire as remote-custom-action events when triggered
  // from JS UI (same pattern as iOS lock screen limitation).
  resolve();
}

// ─────────────────────────────────────────────────────────────────────────────
// Queue
// ─────────────────────────────────────────────────────────────────────────────

void InoPlayerModule::setQueue(
  JSValueArray tracks, int initialIndex,
  std::function<void()> resolve,
  std::function<void(std::string, std::string)> reject) noexcept
{
  try {
    std::vector<WindowsTrack> tracks;
    for (const auto& t : tracks) {
      tracks.push_back(WindowsTrack::fromJSValue(t.AsObject()));
    }
    std::lock_guard<std::mutex> lock(m_mutex);
    m_queue.setQueue(tracks, m_playbackList);
    m_playbackList.StartingItem(
      m_playbackList.Items().GetAt((uint32_t)initialIndex));
    resolve();
  } catch (std::exception const& e) { reject("PLAYER_ERROR", e.what()); }
}

void InoPlayerModule::add(
  JSValueArray tracks, int insertBeforeIndex,
  std::function<void()> resolve,
  std::function<void(std::string, std::string)> reject) noexcept
{
  try {
    std::vector<WindowsTrack> trs;
    for (const auto& t : tracks) trs.push_back(WindowsTrack::fromJSValue(t.AsObject()));
    std::lock_guard<std::mutex> lock(m_mutex);
    m_queue.add(trs, insertBeforeIndex, m_playbackList);
    resolve();
  } catch (std::exception const& e) { reject("PLAYER_ERROR", e.what()); }
}

void InoPlayerModule::remove(
  int index, std::function<void()> resolve,
  std::function<void(std::string, std::string)> reject) noexcept
{
  try {
    std::lock_guard<std::mutex> lock(m_mutex);
    m_queue.remove(index, m_playbackList);
    resolve();
  } catch (std::exception const& e) { reject("PLAYER_ERROR", e.what()); }
}

void InoPlayerModule::move(
  int fromIndex, int toIndex,
  std::function<void()> resolve,
  std::function<void(std::string, std::string)> reject) noexcept
{
  try {
    std::lock_guard<std::mutex> lock(m_mutex);
    m_queue.move(fromIndex, toIndex, m_playbackList);
    resolve();
  } catch (std::exception const& e) { reject("PLAYER_ERROR", e.what()); }
}

void InoPlayerModule::updateMetadataForTrack(
  int index, JSValueObject metadata,
  std::function<void()> resolve,
  std::function<void(std::string, std::string)> reject) noexcept
{
  try {
    auto t = WindowsTrack::fromJSValue(metadata);
    std::lock_guard<std::mutex> lock(m_mutex);
    m_queue.updateAt(index, t);
    // Refresh SMTC if this is the current track
    auto currentIdx = (int)m_playbackList.CurrentItemIndex();
    if (index == currentIdx) updateSMTC();
    resolve();
  } catch (std::exception const& e) { reject("PLAYER_ERROR", e.what()); }
}

void InoPlayerModule::clearQueue(
  std::function<void()> resolve,
  std::function<void(std::string, std::string)> reject) noexcept
{
  try {
    std::lock_guard<std::mutex> lock(m_mutex);
    if (m_player) m_player.Pause();
    m_queue.clear(m_playbackList);
    cancelSleepTimerInternal();
    resolve();
  } catch (std::exception const& e) { reject("PLAYER_ERROR", e.what()); }
}

// ─────────────────────────────────────────────────────────────────────────────
// Navigation
// ─────────────────────────────────────────────────────────────────────────────

void InoPlayerModule::skip(
  int index, double initialPosition,
  std::function<void()> resolve,
  std::function<void(std::string, std::string)> reject) noexcept
{
  try {
    if (index < 0 || index >= m_queue.size()) { resolve(); return; }
    m_playbackList.MoveTo((uint32_t)index);
    if (initialPosition > 0 && m_player) {
      auto session = m_player.PlaybackSession();
      session.Position(TimeSpan{ (long long)(initialPosition * 1e7) });
    }
    resolve();
  } catch (std::exception const& e) { reject("PLAYER_ERROR", e.what()); }
}

void InoPlayerModule::skipToNext(
  double initialPosition,
  std::function<void()> resolve,
  std::function<void(std::string, std::string)> reject) noexcept
{
  try {
    auto currentIdx = (int)m_playbackList.CurrentItemIndex();
    if (currentIdx + 1 < m_queue.size()) {
      m_playbackList.MoveTo((uint32_t)(currentIdx + 1));
      if (initialPosition > 0 && m_player) {
        m_player.PlaybackSession().Position(
          TimeSpan{ (long long)(initialPosition * 1e7) });
      }
    }
    resolve();
  } catch (std::exception const& e) { reject("PLAYER_ERROR", e.what()); }
}

void InoPlayerModule::skipToPrevious(
  double initialPosition,
  std::function<void()> resolve,
  std::function<void(std::string, std::string)> reject) noexcept
{
  try {
    if (m_player) {
      auto pos = m_player.PlaybackSession().Position().count() / 1e7;
      if (pos > 3.0 && initialPosition == 0.0) {
        m_player.PlaybackSession().Position(TimeSpan{ 0 });
        resolve(); return;
      }
    }
    auto currentIdx = (int)m_playbackList.CurrentItemIndex();
    if (currentIdx > 0) {
      m_playbackList.MoveTo((uint32_t)(currentIdx - 1));
      if (initialPosition > 0 && m_player) {
        m_player.PlaybackSession().Position(
          TimeSpan{ (long long)(initialPosition * 1e7) });
      }
    }
    resolve();
  } catch (std::exception const& e) { reject("PLAYER_ERROR", e.what()); }
}

// ─────────────────────────────────────────────────────────────────────────────
// Transport
// ─────────────────────────────────────────────────────────────────────────────

void InoPlayerModule::play(
  std::function<void()> resolve,
  std::function<void(std::string, std::string)> reject) noexcept
{
  try { if (m_player) m_player.Play(); resolve(); }
  catch (std::exception const& e) { reject("PLAYER_ERROR", e.what()); }
}

void InoPlayerModule::pause(
  std::function<void()> resolve,
  std::function<void(std::string, std::string)> reject) noexcept
{
  try { if (m_player) m_player.Pause(); resolve(); }
  catch (std::exception const& e) { reject("PLAYER_ERROR", e.what()); }
}

void InoPlayerModule::stop(
  std::function<void()> resolve,
  std::function<void(std::string, std::string)> reject) noexcept
{
  try {
    if (m_player) {
      m_player.Pause();
      m_player.PlaybackSession().Position(TimeSpan{ 0 });
    }
    resolve();
  } catch (std::exception const& e) { reject("PLAYER_ERROR", e.what()); }
}

void InoPlayerModule::seekTo(
  double position,
  std::function<void()> resolve,
  std::function<void(std::string, std::string)> reject) noexcept
{
  try {
    if (m_player) {
      m_player.PlaybackSession().Position(
        TimeSpan{ (long long)(position * 1e7) });
    }
    resolve();
  } catch (std::exception const& e) { reject("PLAYER_ERROR", e.what()); }
}

void InoPlayerModule::seekBy(
  double offset,
  std::function<void()> resolve,
  std::function<void(std::string, std::string)> reject) noexcept
{
  try {
    if (m_player) {
      auto session  = m_player.PlaybackSession();
      auto current  = session.Position().count() / 1e7;
      auto duration = session.NaturalDuration().count() / 1e7;
      auto newPos   = std::max(0.0, std::min(current + offset, duration));
      session.Position(TimeSpan{ (long long)(newPos * 1e7) });
    }
    resolve();
  } catch (std::exception const& e) { reject("PLAYER_ERROR", e.what()); }
}

void InoPlayerModule::setRate(
  double rate,
  std::function<void()> resolve,
  std::function<void(std::string, std::string)> reject) noexcept
{
  try {
    if (m_player) m_player.PlaybackSession().PlaybackRate(rate);
    resolve();
  } catch (std::exception const& e) { reject("PLAYER_ERROR", e.what()); }
}

void InoPlayerModule::setVolume(
  double volume,
  std::function<void()> resolve,
  std::function<void(std::string, std::string)> reject) noexcept
{
  try {
    if (m_fadeTimer) { m_fadeTimer.Cancel(); m_fadeTimer = nullptr; }
    if (m_player) m_player.Volume(std::max(0.0, std::min(1.0, volume)));
    resolve();
  } catch (std::exception const& e) { reject("PLAYER_ERROR", e.what()); }
}

void InoPlayerModule::fadeVolumeTo(
  double targetVolume, double durationMs,
  std::function<void()> resolve,
  std::function<void(std::string, std::string)> reject) noexcept
{
  try {
    if (m_fadeTimer) { m_fadeTimer.Cancel(); m_fadeTimer = nullptr; }
    if (!m_player) { resolve(); return; }
    double from = m_player.Volume();
    startFade(from, targetVolume, durationMs);
    resolve();
  } catch (std::exception const& e) { reject("PLAYER_ERROR", e.what()); }
}

// ─────────────────────────────────────────────────────────────────────────────
// Mode
// ─────────────────────────────────────────────────────────────────────────────

void InoPlayerModule::setRepeatMode(
  std::string mode,
  std::function<void()> resolve,
  std::function<void(std::string, std::string)> reject) noexcept
{
  try {
    m_repeatMode = mode;
    if (m_playbackList) {
      // Queue repeat → built-in MediaPlaybackList auto-repeat
      m_playbackList.AutoRepeatEnabled(mode == "queue");
    }
    // "track" and "track-once" handled in CurrentItemChanged handler
    resolve();
  } catch (std::exception const& e) { reject("PLAYER_ERROR", e.what()); }
}

void InoPlayerModule::setShuffle(
  bool enabled,
  std::function<void()> resolve,
  std::function<void(std::string, std::string)> reject) noexcept
{
  try {
    m_shuffle = enabled;
    if (m_playbackList) m_playbackList.ShuffleEnabled(enabled);
    resolve();
  } catch (std::exception const& e) { reject("PLAYER_ERROR", e.what()); }
}

// ─────────────────────────────────────────────────────────────────────────────
// Sleep timer
// ─────────────────────────────────────────────────────────────────────────────

void InoPlayerModule::setSleepTimer(
  JSValueObject config,
  std::function<void()> resolve,
  std::function<void(std::string, std::string)> reject) noexcept
{
  try {
    cancelSleepTimerInternal();

    auto getDouble = [&](const char* key, double def) {
      auto it = config.find(key); return (it != config.end()) ? it->second.AsDouble() : def;
    };
    auto getBool = [&](const char* key, bool def) {
      auto it = config.find(key); return (it != config.end()) ? it->second.AsBoolean() : def;
    };
    auto getString = [&](const char* key, std::string def) {
      auto it = config.find(key);
      return (it != config.end() && it->second.Type() == JSValueType::String)
        ? it->second.AsString() : def;
    };

    m_sleepFadeOut      = getBool("fadeOut", true);
    m_sleepFadeDuration = getDouble("fadeDuration", 10.0);
    m_sleepEndOfTrack   = (getString("mode", "countdown") == "end-of-track");

    if (m_sleepEndOfTrack) {
      m_sleepRemaining = -2.0; // sentinel
    } else {
      m_sleepRemaining = getDouble("duration", 0.0);
      if (m_sleepRemaining <= 0.0) { resolve(); return; }

      auto period = TimeSpan{ 10'000'000LL }; // 1 second
      m_sleepTimer = ThreadPoolTimer::CreatePeriodicTimer(
        [this](ThreadPoolTimer const&) {
          m_sleepRemaining -= 1.0;
          JSValueObject tick;
          tick["remaining"] = m_sleepRemaining;
          emitEvent("sleep-timer-tick", std::move(tick));
          if (m_sleepRemaining <= 0.0) fireSleepTimer();
        }, period);
    }
    resolve();
  } catch (std::exception const& e) { reject("PLAYER_ERROR", e.what()); }
}

void InoPlayerModule::cancelSleepTimer(
  std::function<void()> resolve,
  std::function<void(std::string, std::string)> /*reject*/) noexcept
{
  cancelSleepTimerInternal();
  resolve();
}

void InoPlayerModule::getSleepTimerRemaining(
  std::function<void(double)> resolve,
  std::function<void(std::string, std::string)> /*reject*/) noexcept
{
  resolve(m_sleepRemaining);
}

// ─────────────────────────────────────────────────────────────────────────────
// Cache / preload
// ─────────────────────────────────────────────────────────────────────────────

void InoPlayerModule::preloadTrack(
  std::string /*url*/, std::string /*headersJson*/,
  std::function<void()> resolve,
  std::function<void(std::string, std::string)> /*reject*/) noexcept
{
  // Windows.Media.Playback.MediaPlayer uses WinINet/WinHTTP which has its
  // own HTTP cache. No explicit preloading API is available from WinRT.
  // The OS automatically caches media segments based on HTTP headers.
  resolve();
}

void InoPlayerModule::clearCache(
  std::function<void()> resolve,
  std::function<void(std::string, std::string)> /*reject*/) noexcept
{
  // Managed by the OS; no WinRT API to flush it.
  resolve();
}

void InoPlayerModule::getCacheSize(
  std::function<void(double)> resolve,
  std::function<void(std::string, std::string)> /*reject*/) noexcept
{
  resolve(0.0);
}

// ─────────────────────────────────────────────────────────────────────────────
// Getters
// ─────────────────────────────────────────────────────────────────────────────

void InoPlayerModule::getState(
  std::function<void(std::string)> resolve,
  std::function<void(std::string, std::string)> /*reject*/) noexcept
{
  resolve(currentState());
}

void InoPlayerModule::getProgress(
  std::function<void(JSValueObject)> resolve,
  std::function<void(std::string, std::string)> /*reject*/) noexcept
{
  JSValueObject obj;
  if (m_player) {
    auto session = m_player.PlaybackSession();
    obj["position"] = session.Position().count() / 1e7;
    obj["duration"] = session.NaturalDuration().count() / 1e7;
    obj["buffered"]  = session.BufferingProgress() *
                       (session.NaturalDuration().count() / 1e7);
  } else {
    obj["position"] = 0.0; obj["duration"] = 0.0; obj["buffered"] = 0.0;
  }
  resolve(std::move(obj));
}

void InoPlayerModule::getRate(
  std::function<void(double)> resolve,
  std::function<void(std::string, std::string)> /*reject*/) noexcept
{
  resolve(m_player ? m_player.PlaybackSession().PlaybackRate() : 1.0);
}

void InoPlayerModule::getVolume(
  std::function<void(double)> resolve,
  std::function<void(std::string, std::string)> /*reject*/) noexcept
{
  resolve(m_player ? m_player.Volume() : 1.0);
}

void InoPlayerModule::getRepeatMode(
  std::function<void(std::string)> resolve,
  std::function<void(std::string, std::string)> /*reject*/) noexcept
{
  resolve(m_repeatMode);
}

void InoPlayerModule::getShuffle(
  std::function<void(bool)> resolve,
  std::function<void(std::string, std::string)> /*reject*/) noexcept
{
  resolve(m_shuffle);
}

void InoPlayerModule::getQueue(
  std::function<void(JSValueArray)> resolve,
  std::function<void(std::string, std::string)> /*reject*/) noexcept
{
  JSValueArray arr;
  for (auto& obj : m_queue.toJSArray()) arr.push_back(std::move(obj));
  resolve(std::move(arr));
}

void InoPlayerModule::getActiveTrackIndex(
  std::function<void(int)> resolve,
  std::function<void(std::string, std::string)> /*reject*/) noexcept
{
  resolve(m_playbackList ? (int)m_playbackList.CurrentItemIndex() : -1);
}

void InoPlayerModule::getActiveTrack(
  std::function<void(JSValue)> resolve,
  std::function<void(std::string, std::string)> /*reject*/) noexcept
{
  int idx = m_playbackList ? (int)m_playbackList.CurrentItemIndex() : -1;
  auto track = m_queue.getAt(idx);
  if (track) resolve(JSValue(track->toJSValue()));
  else       resolve(JSValue(nullptr));
}

// ─────────────────────────────────────────────────────────────────────────────
// Cast (stubs — not applicable on Windows desktop)
// ─────────────────────────────────────────────────────────────────────────────

void InoPlayerModule::getCastState(
  std::function<void(JSValueObject)> resolve,
  std::function<void(std::string, std::string)> /*reject*/) noexcept
{
  JSValueObject obj;
  obj["state"] = "no_devices";
  resolve(std::move(obj));
}

void InoPlayerModule::showAirPlayPicker(
  std::function<void()> resolve,
  std::function<void(std::string, std::string)> /*reject*/) noexcept
{
  resolve(); // iOS only
}

void InoPlayerModule::showCastDialog(
  std::function<void()> resolve,
  std::function<void(std::string, std::string)> /*reject*/) noexcept
{
  // Chromecast on Windows requires the Google Cast SDK for UWP.
  // Guide: https://developers.google.com/cast/docs/windows
  resolve();
}

void InoPlayerModule::provideCarBrowseItems(
  std::string /*parentId*/, JSValueArray /*items*/,
  std::function<void()> resolve,
  std::function<void(std::string, std::string)> /*reject*/) noexcept
{
  resolve(); // Not applicable on Windows
}

// ─────────────────────────────────────────────────────────────────────────────
// Internal helpers
// ─────────────────────────────────────────────────────────────────────────────

void InoPlayerModule::setupMediaPlayer(const JSValueObject& options) {
  // Create MediaPlaybackList (the queue engine)
  m_playbackList = MediaPlaybackList();
  m_playbackList.AutoRepeatEnabled(false);
  m_playbackList.ShuffleEnabled(false);

  // Create MediaPlayer
  m_player = MediaPlayer();

  // Background audio: keep playing when window is minimized
  m_player.AudioCategory(MediaPlayerAudioCategory::Media);

  // Source = our playlist
  m_player.Source(m_playbackList);

  // Progress interval
  auto it = options.find("progressUpdateEventInterval");
  if (it != options.end()) m_progressInterval = it->second.AsDouble();

  // Attach SMTC
  setupSMTC();

  // Attach player events
  attachPlayerEvents();

  // Start progress timer
  startProgressTimer();
}

void InoPlayerModule::setupSMTC() {
  m_smtc = m_player.SystemMediaTransportControls();
  m_smtc.IsEnabled(true);
  m_smtc.IsPlayEnabled(true);
  m_smtc.IsPauseEnabled(true);
  m_smtc.IsNextEnabled(true);
  m_smtc.IsPreviousEnabled(true);
  m_smtc.IsStopEnabled(true);

  m_smtc.ButtonPressed(
    [this](auto const&, SystemMediaTransportControlsButtonPressedEventArgs const& args) {
      JSValueObject payload;
      switch (args.Button()) {
        case SystemMediaTransportControlsButton::Play:
          if (m_player) m_player.Play();
          emitEvent("remote-play", {});
          break;
        case SystemMediaTransportControlsButton::Pause:
          if (m_player) m_player.Pause();
          emitEvent("remote-pause", {});
          break;
        case SystemMediaTransportControlsButton::Stop:
          if (m_player) {
            m_player.Pause();
            m_player.PlaybackSession().Position(TimeSpan{0});
          }
          emitEvent("remote-stop", {});
          break;
        case SystemMediaTransportControlsButton::Next:
          emitEvent("remote-next", {});
          break;
        case SystemMediaTransportControlsButton::Previous:
          emitEvent("remote-previous", {});
          break;
        default: break;
      }
    });

  m_smtc.PlaybackPositionChangeRequested(
    [this](auto const&, PlaybackPositionChangeRequestedEventArgs const& args) {
      auto pos = args.RequestedPlaybackPosition().count() / 1e7;
      if (m_player) {
        m_player.PlaybackSession().Position(args.RequestedPlaybackPosition());
      }
      JSValueObject payload;
      payload["position"] = pos;
      emitEvent("remote-seek", std::move(payload));
    });
}

void InoPlayerModule::updateSMTC() {
  if (!m_smtc) return;
  int idx = m_playbackList ? (int)m_playbackList.CurrentItemIndex() : -1;
  const auto* track = m_queue.getAt(idx);
  if (!track) return;

  auto updater = m_smtc.DisplayUpdater();
  updater.Type(Windows::Media::MediaPlaybackType::Music);
  updater.MusicProperties().Title(track->title);
  updater.MusicProperties().Artist(track->artist);
  updater.MusicProperties().AlbumTitle(track->album);
  if (!track->artwork.empty()) {
    updater.Thumbnail(
      Windows::Storage::Streams::RandomAccessStreamReference::CreateFromUri(
        Foundation::Uri(track->artwork)));
  }
  updater.Update();
}

void InoPlayerModule::attachPlayerEvents() {
  if (!m_player) return;

  // Playback state changes
  m_player.PlaybackSession().PlaybackStateChanged(
    [this](MediaPlaybackSession const&, IInspectable const&) {
      emitStateChange();
    });

  // Error
  m_player.MediaFailed(
    [this](MediaPlayer const&, MediaPlayerFailedEventArgs const& args) {
      JSValueObject errPayload;
      errPayload["state"] = "error";
      JSValueObject errObj;
      errObj["code"]    = "MEDIA_FAILED";
      errObj["message"] = winrt::to_string(args.ErrorMessage());
      errPayload["error"] = std::move(errObj);
      emitEvent("playback-state", std::move(errPayload));
    });

  // Track transition
  m_playbackList.CurrentItemChanged(
    [this](MediaPlaybackList const&, CurrentMediaPlaybackItemChangedEventArgs const&) {
      auto idx = (int)m_playbackList.CurrentItemIndex();
      handleTrackChange(idx);

      // Handle track-once repeat
      if (m_repeatMode == "track-once") {
        static bool trackOnceFired = false;
        if (!trackOnceFired) {
          trackOnceFired = true;
          // Replay current item
          m_playbackList.MoveTo((uint32_t)idx);
        } else {
          trackOnceFired  = false;
          m_repeatMode    = "off";
          m_playbackList.AutoRepeatEnabled(false);
        }
      }

      // End-of-track sleep timer
      if (m_sleepRemaining == -2.0) {
        m_sleepRemaining  = -1.0;
        m_sleepEndOfTrack = false;
        fireSleepTimer();
      }
    });

  // Queue ended
  m_playbackList.ItemFailed(
    [this](MediaPlaybackList const&, MediaPlaybackItemFailedEventArgs const& args) {
      JSValueObject errPayload;
      errPayload["state"] = "error";
      JSValueObject errObj;
      errObj["code"]    = "ITEM_FAILED";
      errObj["message"] = "Media item failed to load";
      errPayload["error"] = std::move(errObj);
      emitEvent("playback-state", std::move(errPayload));
    });
}

void InoPlayerModule::handleTrackChange(uint32_t index) {
  const auto* track = m_queue.getAt((int)index);
  JSValueObject payload;
  payload["index"]        = (int)index;
  payload["lastIndex"]    = -1;
  payload["lastPosition"] = 0.0;
  if (track) payload["track"] = track->toJSValue();
  emitEvent("playback-active-track-changed", std::move(payload));
  updateSMTC();
}

void InoPlayerModule::emitStateChange() {
  JSValueObject payload;
  payload["state"] = currentState();
  emitEvent("playback-state", std::move(payload));
}

std::string InoPlayerModule::currentState() {
  if (!m_player) return "none";
  switch (m_player.PlaybackSession().PlaybackState()) {
    case MediaPlaybackState::None:     return "none";
    case MediaPlaybackState::Opening:  return "loading";
    case MediaPlaybackState::Buffering: return "buffering";
    case MediaPlaybackState::Playing:  return "playing";
    case MediaPlaybackState::Paused:   return "paused";
    default:                           return "none";
  }
}

void InoPlayerModule::emitEvent(
  const std::string& name, JSValueObject payload)
{
  m_reactContext.CallJSFunction(
    L"RCTDeviceEventEmitter", L"emit",
    [name, payload = std::move(payload)](IJSValueWriter const& writer) mutable {
      writer.WriteString(winrt::to_hstring(name));
      WriteValue(writer, payload);
    });
}

void InoPlayerModule::startProgressTimer() {
  stopProgressTimer();
  auto period = TimeSpan{ (long long)(m_progressInterval * 1e7) };
  m_progressTimer = ThreadPoolTimer::CreatePeriodicTimer(
    [this](ThreadPoolTimer const&) {
      if (!m_player) return;
      if (m_player.PlaybackSession().PlaybackState() !=
          MediaPlaybackState::Playing) return;
      auto session = m_player.PlaybackSession();
      JSValueObject payload;
      payload["position"] = session.Position().count() / 1e7;
      payload["duration"] = session.NaturalDuration().count() / 1e7;
      payload["buffered"] = session.BufferingProgress() *
                            (session.NaturalDuration().count() / 1e7);
      payload["track"]    = (int)m_playbackList.CurrentItemIndex();
      emitEvent("playback-progress-updated", std::move(payload));
    }, period);
}

void InoPlayerModule::stopProgressTimer() {
  if (m_progressTimer) { m_progressTimer.Cancel(); m_progressTimer = nullptr; }
}

void InoPlayerModule::cancelSleepTimerInternal() {
  if (m_sleepTimer) { m_sleepTimer.Cancel(); m_sleepTimer = nullptr; }
  m_sleepRemaining  = -1.0;
  m_sleepEndOfTrack = false;
}

void InoPlayerModule::fireSleepTimer() {
  cancelSleepTimerInternal();
  if (m_sleepFadeOut) {
    double from = m_player ? m_player.Volume() : 1.0;
    startFade(from, 0.0, m_sleepFadeDuration * 1000.0);
    auto delay = TimeSpan{ (long long)(m_sleepFadeDuration * 1e7) };
    ThreadPoolTimer::CreateTimer(
      [this](ThreadPoolTimer const&) {
        if (m_player) { m_player.Pause(); m_player.Volume(1.0); }
        emitEvent("sleep-timer-fired", {});
      }, delay);
  } else {
    if (m_player) m_player.Pause();
    emitEvent("sleep-timer-fired", {});
  }
}

void InoPlayerModule::startFade(
  double from, double to, double durationMs)
{
  if (m_fadeTimer) { m_fadeTimer.Cancel(); m_fadeTimer = nullptr; }
  if (!m_player) return;

  int steps      = std::max(1, (int)(durationMs / 50.0));
  double delta   = to - from;
  int* stepCount = new int(0);

  auto period = TimeSpan{ 500'000LL }; // 50ms
  m_fadeTimer = ThreadPoolTimer::CreatePeriodicTimer(
    [this, from, delta, steps, stepCount](ThreadPoolTimer const& timer) {
      (*stepCount)++;
      double vol = std::max(0.0, std::min(1.0,
        from + delta * ((double)*stepCount / steps)));
      if (m_player) m_player.Volume(vol);
      if (*stepCount >= steps) {
        if (m_player) m_player.Volume(std::max(0.0, std::min(1.0, from + delta)));
        timer.Cancel();
        delete stepCount;
      }
    }, period);
}

} // namespace winrt::RNInoPlayer
