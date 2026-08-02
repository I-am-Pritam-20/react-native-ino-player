# Platform Compatibility Reference

## Support Matrix

| Platform | Status | Engine | Min Version |
|---|:---:|---|---|
| Android phone | ✅ | Media3 ExoPlayer 1.10.0 | API 26 (Android 8.0) |
| Android tablet | ✅ | Same APK | API 26 |
| Android foldable | ✅ | Same APK | API 26 |
| Chromebook (Play Store) | ✅ | Same APK | API 26 |
| iPhone | ✅ | AVFoundation | iOS 13.0 |
| iPad | ✅ | Same IPA | iOS 13.0 |
| Mac Catalyst | ✅ | AVFoundation | macOS 10.15 |
| Web (React Native Web) | ✅ | HTMLAudioElement + MediaSession | Chrome 73, Firefox 82, Safari 14 |
| Windows (RN Windows) | ✅ | WinRT MediaPlayer | Windows 10 build 19041 |
| Android Auto (old/new) | ✅ | MediaLibraryService | Auto 4.x+ |
| Android Automotive OS | ✅ | CarAppService | AAOS API 1–6 |
| Android TV | ✅ | MediaLibrarySession | API 26+ |
| Wear OS 2/3/4 | ✅ | Data Layer | API 25+ |
| CarPlay | ✅ | MPNowPlayingInfo | iOS 13+ |
| Chromecast | ✅ | media3-cast CastPlayer | Receiver SDK 3.x–6.x |
| AirPlay 1 & 2 | ✅ | AVAudioSession.allowAirPlay | Automatic |
| macOS native (AppKit) | ❌ | — | Use Mac Catalyst |
| watchOS | ❌ | — | Different API |
| tvOS | ❌ | — | Separate target needed |

## Engine Decisions

### Android: Media3 ExoPlayer 1.10.0
- `com.google.android.exoplayer2` was deprecated in 2023. Media3 IS ExoPlayer.
- One `MediaLibraryService` speaks both new protocol (2020+ head units) and legacy `MediaBrowserServiceCompat` (2016–2019 head units, Wear OS 2.x).

### iOS/iPad/Mac Catalyst: AVFoundation
- `AVQueuePlayer` is the correct engine. AirPlay 1 & 2 are automatic via `.allowAirPlay`.
- Mac Catalyst: same binary, same code, enabled via podspec `:maccatalyst => "13.0"`.

### Web: HTMLAudioElement + MediaSession API
- No native bridge — uses browser APIs directly.
- `src/player.web.ts` and `src/events/index.web.ts` are resolved by Metro automatically.
- MediaSession API provides lock-screen controls on mobile browsers.
- AirPlay on Safari: automatic. Chromecast on web requires Google Cast SDK separately.

### Windows: WinRT MediaPlayer
- `Windows.Media.Playback.MediaPlayer` — the correct modern Windows API.
- `SystemMediaTransportControls` = lock screen + taskbar Now Playing widget.
- Background audio via `MediaPlayerAudioCategory.Media`.

## Web File Resolution (Metro)
Metro resolves platform-specific files automatically:
```
src/player.web.ts         → loaded on web (instead of src/player.ts)
src/events/index.web.ts   → loaded on web (instead of src/events/index.ts)
src/index.web.ts          → loaded on web (instead of src/index.ts)
```
Hooks (`src/hooks/index.ts`) import from `../player` and `../events` — Metro resolves those to `.web.ts` automatically. Zero changes needed in the hooks file.

## Windows Build (RN Windows 0.74+)
The Windows TurboModule uses REACT_MODULE / REACT_METHOD macros from Microsoft.ReactNative.
It reads the same `specs/NativeInoPlayer.ts` spec conceptually but implements via C++/WinRT.
