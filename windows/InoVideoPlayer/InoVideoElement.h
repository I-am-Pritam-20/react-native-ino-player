// Windows video view for react-native-ino-player.
// Uses Windows.Media.Playback.MediaPlayer + MediaPlayerElement XAML control.
//
// Architecture:
//   ReactNative Fabric ViewManager → InoVideoElementManager
//   → creates InoVideoElement (UserControl wrapping MediaPlayerElement)
//
// Engine: Windows.Media.Playback.MediaPlayer (same as audio module)
//   Video rendering: MediaPlayerElement (XAML, auto hardware-accelerated)
//   DRM: Windows.Media.Protection.PlayReady + Widevine (via PlayReadyContentHeader)
//   PiP: CompactOverlay window mode (Windows 10 1703+)
//   Fullscreen: ApplicationView.TryEnterFullScreenMode()
 
#pragma once
#include "../RNInoPlayer/pch.h"
 
namespace winrt::RNInoPlayerVideo {
 
using namespace winrt::Windows::Media::Playback;
using namespace winrt::Windows::Media::Core;
using namespace winrt::Windows::UI::Xaml::Controls;
using namespace winrt::Windows::Foundation;
 
// ─── Video resize modes ──────────────────────────────────────────────────────
enum class InoVideoResizeMode {
    Contain,  // Uniform — letterbox
    Cover,    // UniformToFill — crop
    Stretch,  // Fill
    None,     // None (natural size)
};
 
// ─── InoVideoElement ─────────────────────────────────────────────────────────
// A ReactNative view that wraps MediaPlayerElement for video rendering.
 
REACT_VIEW(InoVideoElement)
struct InoVideoElement {
 
    REACT_FIELD(sourceJson)
    std::string sourceJson;
 
    REACT_FIELD(paused)
    bool paused{ false };
 
    REACT_FIELD(volume)
    double volume{ 1.0 };
 
    REACT_FIELD(rate)
    double rate{ 1.0 };
 
    REACT_FIELD(muted)
    bool muted{ false };
 
    REACT_FIELD(repeat)
    bool repeat{ false };
 
    REACT_FIELD(resizeMode)
    std::string resizeMode{ "contain" };
 
    REACT_FIELD(controls)
    bool controls{ false };
 
    REACT_FIELD(progressInterval)
    int progressInterval{ 250 };
 
    REACT_FIELD(drmJson)
    std::string drmJson;
 
    REACT_FIELD(preventSleep)
    bool preventSleep{ false };
 
    REACT_FIELD(fullscreen)
    bool fullscreen{ false };
 
    REACT_FIELD(pictureInPicture)
    bool pictureInPicture{ false };
 
    // ── Events ────────────────────────────────────────────────────────────────
    REACT_EVENT(onVideoLoad,                Microsoft::ReactNative::JSValueObject)
    std::function<void(Microsoft::ReactNative::JSValueObject const&)> onVideoLoad;
 
    REACT_EVENT(onVideoLoadStart,           Microsoft::ReactNative::JSValueObject)
    std::function<void(Microsoft::ReactNative::JSValueObject const&)> onVideoLoadStart;
 
    REACT_EVENT(onVideoProgress,            Microsoft::ReactNative::JSValueObject)
    std::function<void(Microsoft::ReactNative::JSValueObject const&)> onVideoProgress;
 
    REACT_EVENT(onVideoEnd,                 Microsoft::ReactNative::JSValueObject)
    std::function<void(Microsoft::ReactNative::JSValueObject const&)> onVideoEnd;
 
    REACT_EVENT(onVideoError,               Microsoft::ReactNative::JSValueObject)
    std::function<void(Microsoft::ReactNative::JSValueObject const&)> onVideoError;
 
    REACT_EVENT(onVideoBuffer,              Microsoft::ReactNative::JSValueObject)
    std::function<void(Microsoft::ReactNative::JSValueObject const&)> onVideoBuffer;
 
    REACT_EVENT(onVideoSeek,                Microsoft::ReactNative::JSValueObject)
    std::function<void(Microsoft::ReactNative::JSValueObject const&)> onVideoSeek;
 
    REACT_EVENT(onVideoReadyForDisplay,     Microsoft::ReactNative::JSValueObject)
    std::function<void(Microsoft::ReactNative::JSValueObject const&)> onVideoReadyForDisplay;
 
    REACT_EVENT(onVideoPlaybackRateChange,  Microsoft::ReactNative::JSValueObject)
    std::function<void(Microsoft::ReactNative::JSValueObject const&)> onVideoPlaybackRateChange;
 
    REACT_EVENT(onVideoFullscreenChange,    Microsoft::ReactNative::JSValueObject)
    std::function<void(Microsoft::ReactNative::JSValueObject const&)> onVideoFullscreenChange;
 
    REACT_EVENT(onVideoPictureInPictureChange, Microsoft::ReactNative::JSValueObject)
    std::function<void(Microsoft::ReactNative::JSValueObject const&)> onVideoPictureInPictureChange;
 
private:
    MediaPlayer              m_player{ nullptr };
    MediaPlayerElement       m_playerElement{ nullptr };
    Windows::System::Threading::ThreadPoolTimer m_progressTimer{ nullptr };
    std::string              m_loadedSourceJson;
};
 
} // namespace winrt::RNInoPlayerVideo