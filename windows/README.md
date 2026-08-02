# Windows Setup Guide — react-native-ino-player

## Requirements

| Tool | Version |
|---|---|
| Windows 10 | Build 10.0.19041 (20H1) minimum |
| Windows 11 | All versions |
| Visual Studio | 2022 (v17.x) with "Desktop development with C++" and "Universal Windows Platform development" workloads |
| Windows SDK | 10.0.22621.0 (Windows 11 SDK) or 10.0.19041.0 minimum |
| React Native Windows | 0.74.0+ |
| Node.js | 20+ |

## Engine

`Windows.Media.Playback.MediaPlayer` (WinRT) — the canonical modern Windows media engine.

| WinRT API | Purpose |
|---|---|
| `MediaPlayer` | Playback, volume, rate |
| `MediaPlaybackList` | Queue, auto-advance, shuffle |
| `MediaPlaybackSession` | Position, duration, buffered progress |
| `SystemMediaTransportControls` | Lock screen + taskbar Now Playing widget |
| `ThreadPoolTimer` | Sleep timer, progress polling, volume fade |

## Project Setup

### 1. Add the library to your Windows solution

```bash
cd windows
# Open your solution file in Visual Studio
```

In Visual Studio:
1. **File → Add → Existing Project**
2. Navigate to `node_modules/react-native-ino-player/windows/RNInoPlayer/`
3. Select `RNInoPlayer.vcxproj`

### 2. Add a reference from your app to RNInoPlayer

In Solution Explorer:
1. Right-click your app project → **Add → Reference**
2. Check `RNInoPlayer`
3. Click OK

### 3. Register the package provider in your app

In `windows/YourApp/App.cpp`:

```cpp
#include <winrt/RNInoPlayer.h>

// In App::App() constructor, before LoadComponent():
PackageProviders().Append(winrt::make<winrt::RNInoPlayer::ReactPackageProvider>());
```

### 4. Add capabilities to Package.appxmanifest

```xml
<Capabilities>
  <Capability Name="internetClient" />
  <!-- Required for background audio with media keys -->
  <uap3:Capability Name="backgroundMediaPlayback" />
</Capabilities>
```

### 5. Build and run

```bash
npx react-native run-windows
```

## Features

| Feature | Status | Notes |
|---|---|---|
| Audio playback | ✅ | `MediaPlayer` + `MediaPlaybackList` |
| Video playback | ✅ | Same engine, content type hint |
| Background audio | ✅ | `AudioCategory.Media` keeps audio alive |
| Lock screen controls | ✅ | `SystemMediaTransportControls` |
| Taskbar Now Playing | ✅ | `SystemMediaTransportControls` |
| Queue management | ✅ | `MediaPlaybackList` |
| Repeat modes | ✅ | Off/Track/TrackOnce/Queue |
| Shuffle | ✅ | `MediaPlaybackList.ShuffleEnabled` |
| Sleep timer | ✅ | `ThreadPoolTimer` |
| Volume fade | ✅ | Timer-based interpolation |
| Seek | ✅ | `MediaPlaybackSession.Position` |
| Rate | ✅ | `MediaPlaybackSession.PlaybackRate` |
| HTTP headers | ⚠️ | Use signed URLs for auth streams |
| Stream caching | ✅ | Automatic via WinINet/WinHTTP |
| Preloading | ⚠️ | Managed by OS, no explicit API |
| Chromecast | ❌ | Requires Google Cast SDK for UWP separately |
| AirPlay | ❌ | iOS/macOS only |
| Android Auto | ❌ | Android only |
| CarPlay | ❌ | iOS only |
| Wear OS | ❌ | Android only |

## Platform Versions

| Windows version | Build | Status |
|---|---|---|
| Windows 10 20H1 | 19041 | ✅ Minimum |
| Windows 10 21H2 | 19044 | ✅ |
| Windows 10 22H2 | 19045 | ✅ |
| Windows 11 21H2 | 22000 | ✅ |
| Windows 11 22H2 | 22621 | ✅ |
| Windows 11 23H2 | 22631 | ✅ |
| Xbox One (Windows gaming) | — | ✅ Same WinRT APIs |
| Surface Hub 2S | — | ✅ |
| HoloLens 2 | — | ⚠️ Limited audio hardware |

## HTTP Headers Note

`Windows.Media.Playback.MediaPlayer` does not expose a public API to set
per-request HTTP headers on `MediaSource.CreateFromUri()`.

**Workarounds:**
1. **Signed URLs** (recommended) — embed auth tokens in the URL query string.
   This is the standard CDN approach (AWS CloudFront, Azure CDN, etc.)
2. **Local HTTP proxy** — run a local server that adds headers and forward
   to `MediaSource.CreateFromUri("http://localhost:PORT/...")`
3. **AdaptiveMediaSource** — supports `AdditionalRequestHeaders` for HLS/DASH streams

## Troubleshooting

**Audio stops when app is minimized**
→ Ensure `Package.appxmanifest` includes `backgroundMediaPlayback` capability.

**Lock screen controls not showing**
→ `SystemMediaTransportControls` requires `IsEnabled = true` (set automatically).
→ Make sure `AudioCategory.Media` is set on the `MediaPlayer`.

**Build error: cannot open source file "winrt/Windows.Media.Playback.h"**
→ Ensure Windows SDK 10.0.19041.0+ is installed via Visual Studio Installer.

**"React Native Windows package not found"**
→ Run `yarn install` then rebuild. Ensure `newArchEnabled=true` is not blocking.
