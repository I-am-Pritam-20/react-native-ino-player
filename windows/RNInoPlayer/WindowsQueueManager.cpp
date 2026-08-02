// windows/RNInoPlayer/WindowsQueueManager.cpp
#include "pch.h"
#include "WindowsQueueManager.h"

namespace winrt::RNInoPlayer {

using namespace winrt::Windows::Media::Core;
using namespace winrt::Windows::Media::Playback;
using namespace winrt::Windows::Foundation;
using namespace winrt::Windows::Storage::Streams;

// ─── WindowsTrack ─────────────────────────────────────────────────────────────

MediaPlaybackItem WindowsTrack::toMediaPlaybackItem() const {
  // Use localUri (offline) if present, otherwise the remote url
  const auto& src = localUri.empty() ? url : localUri;
  auto uri = Uri(src);

  MediaSource source{ nullptr };

  if (!headers.empty()) {
    // Custom HTTP headers via HttpMediaSource
    auto httpSource =
      winrt::Windows::Web::Http::HttpClient();
    // Note: MediaSource.CreateFromUri does not support headers directly.
    // For authenticated streams, use MediaSource with AdaptiveMediaSource
    // or proxy the request through a local HTTP server.
    // For most CDN use cases, sign the URL and use CreateFromUri.
    source = MediaSource::CreateFromUri(uri);
  } else {
    source = MediaSource::CreateFromUri(uri);
  }

  auto item = MediaPlaybackItem(source);

  // Set display properties (shown on lock screen / taskbar)
  auto props = item.GetDisplayProperties();
  props.Type(
    contentType == L"video"
      ? winrt::Windows::Media::MediaPlaybackType::Video
      : winrt::Windows::Media::MediaPlaybackType::Music
  );
  props.MusicProperties().Title(title);
  props.MusicProperties().Artist(artist);
  props.MusicProperties().AlbumTitle(album);

  if (!artwork.empty()) {
    props.Thumbnail(
      RandomAccessStreamReference::CreateFromUri(Uri(artwork))
    );
  }

  item.ApplyDisplayProperties(props);
  return item;
}

Microsoft::ReactNative::JSValueObject WindowsTrack::toJSValue() const {
  Microsoft::ReactNative::JSValueObject obj;
  obj["id"]          = winrt::to_string(id);
  obj["url"]         = winrt::to_string(url);
  obj["title"]       = winrt::to_string(title);
  obj["artist"]      = winrt::to_string(artist);
  obj["album"]       = winrt::to_string(album);
  obj["artwork"]     = winrt::to_string(artwork);
  obj["duration"]    = duration;
  obj["contentType"] = winrt::to_string(contentType);
  if (!localUri.empty())    obj["localUri"]    = winrt::to_string(localUri);
  if (!type.empty())        obj["type"]        = winrt::to_string(type);
  if (!userInfoJson.empty()) obj["userInfoJson"] = winrt::to_string(userInfoJson);
  return obj;
}

WindowsTrack WindowsTrack::fromJSValue(
  const Microsoft::ReactNative::JSValueObject& obj)
{
  WindowsTrack t;
  auto getString = [&](const char* key) -> std::wstring {
    auto it = obj.find(key);
    if (it != obj.end() && it->second.Type() ==
        Microsoft::ReactNative::JSValueType::String) {
      return winrt::to_hstring(it->second.AsString()).c_str();
    }
    return {};
  };
  auto getDouble = [&](const char* key, double def) -> double {
    auto it = obj.find(key);
    if (it != obj.end() && it->second.Type() ==
        Microsoft::ReactNative::JSValueType::Double) {
      return it->second.AsDouble();
    }
    return def;
  };

  t.id          = getString("id");
  t.url         = getString("url");
  t.title       = getString("title");
  t.artist      = getString("artist");
  t.album       = getString("album");
  t.artwork     = getString("artwork");
  t.duration    = getDouble("duration", -1.0);
  t.contentType = getString("contentType");
  if (t.contentType.empty()) t.contentType = L"audio";
  t.localUri    = getString("localUri");
  t.type        = getString("type");
  t.userInfoJson = getString("userInfoJson");

  // Parse headers JSON string
  auto headersJson = getString("headers");
  if (!headersJson.empty()) {
    try {
      auto parsed = folly::parseJson(winrt::to_string(headersJson));
      for (auto& [k, v] : parsed.items()) {
        t.headers[winrt::to_hstring(k).c_str()] =
          winrt::to_hstring(v.asString()).c_str();
      }
    } catch (...) {}
  }

  return t;
}

// ─── WindowsQueueManager ──────────────────────────────────────────────────────

void WindowsQueueManager::setQueue(
  const std::vector<WindowsTrack>& tracks,
  MediaPlaybackList& playbackList)
{
  _tracks = tracks;
  playbackList.Items().Clear();
  for (const auto& t : _tracks) {
    playbackList.Items().Append(t.toMediaPlaybackItem());
  }
}

void WindowsQueueManager::add(
  const std::vector<WindowsTrack>& tracks,
  int insertBeforeIndex,
  MediaPlaybackList& playbackList)
{
  int at = (insertBeforeIndex < 0 || insertBeforeIndex > (int)_tracks.size())
    ? (int)_tracks.size()
    : insertBeforeIndex;

  for (int i = 0; i < (int)tracks.size(); i++) {
    _tracks.insert(_tracks.begin() + at + i, tracks[i]);
    playbackList.Items().InsertAt(
      (uint32_t)(at + i),
      tracks[i].toMediaPlaybackItem()
    );
  }
}

void WindowsQueueManager::remove(int index, MediaPlaybackList& playbackList) {
  if (index < 0 || index >= (int)_tracks.size()) return;
  _tracks.erase(_tracks.begin() + index);
  playbackList.Items().RemoveAt((uint32_t)index);
}

void WindowsQueueManager::move(
  int fromIndex, int toIndex, MediaPlaybackList& playbackList)
{
  if (fromIndex < 0 || fromIndex >= (int)_tracks.size()) return;
  if (toIndex < 0   || toIndex   >= (int)_tracks.size()) return;

  auto track = _tracks[fromIndex];
  _tracks.erase(_tracks.begin() + fromIndex);
  _tracks.insert(_tracks.begin() + toIndex, track);

  auto item = playbackList.Items().GetAt((uint32_t)fromIndex);
  playbackList.Items().RemoveAt((uint32_t)fromIndex);
  playbackList.Items().InsertAt((uint32_t)toIndex, item);
}

void WindowsQueueManager::updateAt(int index, const WindowsTrack& metadata) {
  if (index < 0 || index >= (int)_tracks.size()) return;
  auto& t = _tracks[index];
  if (!metadata.title.empty())   t.title   = metadata.title;
  if (!metadata.artist.empty())  t.artist  = metadata.artist;
  if (!metadata.album.empty())   t.album   = metadata.album;
  if (!metadata.artwork.empty()) t.artwork = metadata.artwork;
  if (metadata.duration >= 0)    t.duration = metadata.duration;
}

void WindowsQueueManager::clear(MediaPlaybackList& playbackList) {
  _tracks.clear();
  playbackList.Items().Clear();
}

const WindowsTrack* WindowsQueueManager::getAt(int index) const {
  if (index < 0 || index >= (int)_tracks.size()) return nullptr;
  return &_tracks[(size_t)index];
}

int WindowsQueueManager::size() const {
  return (int)_tracks.size();
}

std::vector<Microsoft::ReactNative::JSValueObject>
WindowsQueueManager::toJSArray() const {
  std::vector<Microsoft::ReactNative::JSValueObject> arr;
  arr.reserve(_tracks.size());
  for (const auto& t : _tracks) arr.push_back(t.toJSValue());
  return arr;
}

} // namespace winrt::RNInoPlayer
