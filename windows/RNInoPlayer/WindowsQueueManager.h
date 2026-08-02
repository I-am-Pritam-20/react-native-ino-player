// windows/RNInoPlayer/WindowsQueueManager.h
#pragma once
#include "pch.h"

namespace winrt::RNInoPlayer {

using namespace winrt::Windows::Media::Core;
using namespace winrt::Windows::Media::Playback;

// ─── Track data (mirrors BridgeTrack from the TS spec) ───────────────────────

struct WindowsTrack {
  std::wstring id;
  std::wstring url;
  std::wstring title;
  std::wstring artist;
  std::wstring album;
  std::wstring artwork;
  double       duration   = -1.0;
  std::wstring contentType = L"audio";
  std::wstring localUri;
  std::wstring type;
  std::map<std::wstring, std::wstring> headers;
  std::wstring userInfoJson;

  // Build a MediaPlaybackItem for the Windows.Media.Playback engine
  MediaPlaybackItem toMediaPlaybackItem() const;

  // Convert to JSValueObject for sending to JS
  Microsoft::ReactNative::JSValueObject toJSValue() const;

  // Parse from a JSValueObject (received from JS bridge)
  static WindowsTrack fromJSValue(
    const Microsoft::ReactNative::JSValueObject& obj);
};

// ─── Queue manager ────────────────────────────────────────────────────────────

class WindowsQueueManager {
public:
  void setQueue(
    const std::vector<WindowsTrack>& tracks,
    MediaPlaybackList& playbackList);

  void add(
    const std::vector<WindowsTrack>& tracks,
    int insertBeforeIndex,
    MediaPlaybackList& playbackList);

  void remove(int index, MediaPlaybackList& playbackList);

  void move(int fromIndex, int toIndex, MediaPlaybackList& playbackList);

  void updateAt(int index, const WindowsTrack& metadata);

  void clear(MediaPlaybackList& playbackList);

  const WindowsTrack* getAt(int index) const;
  int size() const;

  std::vector<Microsoft::ReactNative::JSValueObject> toJSArray() const;

private:
  std::vector<WindowsTrack> _tracks;
};

} // namespace winrt::RNInoPlayer
