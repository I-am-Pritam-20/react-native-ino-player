# React Native Ino Player

<a href="https://www.npmjs.com/package/react-native-ino-player"><img width="100%" height="35%" alt="react-native-ino-player-github-banner" src="https://github.com/user-attachments/assets/ddc372a0-220a-48f1-a0fa-d711be76d4ad" /></a>
<br></br>

> A full-featured audio/video media player for **React Native** — built on the **New Architecture** (TurboModule + Bridgeless, RN ≥ 0.74).

[![npm version](https://img.shields.io/npm/v/react-native-ino-player?color=green)](https://www.npmjs.com/package/react-native-ino-player)
[![CI](https://github.com/I-am-Pritam-20/react-native-ino-player/actions/workflows/ci.yml/badge.svg)](https://github.com/I-am-Pritam-20/react-native-ino-player/actions/workflows/ci.yml)
[![Android Build](https://github.com/I-am-Pritam-20/react-native-ino-player/actions/workflows/build-android.yml/badge.svg)](https://github.com/I-am-Pritam-20/react-native-ino-player/actions/workflows/build-android.yml)
[![iOS Build](https://github.com/I-am-Pritam-20/react-native-ino-player/actions/workflows/build-ios.yml/badge.svg)](https://github.com/I-am-Pritam-20/react-native-ino-player/actions/workflows/build-ios.yml)
[![License: MIT](https://img.shields.io/badge/License-MIT-blue.svg)](LICENSE)
[![TypeScript](https://img.shields.io/badge/TypeScript-strict-blue)](tsconfig.json)

---

## Table of Contents
- [react-native-ino-player](#react-native-ino-player)
  - [Platform Support](#platform-support)
  - [Table of Contents](#table-of-contents)
  - [Installation](#installation)
    - [New Architecture](#new-architecture)
    - [Android](#android)
      - [Using a custom Cast receiver app ID](#using-a-custom-cast-receiver-app-id)
      - [Usage in Android Auto](#for-android-auto-also-add-to-your-manifest)
    - [iOS](#ios)
    - [Web](#web)
    - [Windows](#windows)
  - [Checking Platform Support at Runtime](#checking-platform-support-at-runtime)
  - [Quick Start](#quick-start)
  - [Playback Controls](#playback-controls)
  - [Queue Management](#queue-management)
  - [Repeat Modes](#repeat-modes)
  - [Shuffle](#shuffle)
  - [Progress Bar \& Seeking](#progress-bar--seeking)
  - [Sleep Timer](#sleep-timer)
  - [Volume Fade](#volume-fade)
  - [Custom Remote Actions](#custom-remote-actions)
  - [Preloading \& Caching](#preloading--caching)
  - [AirPlay \& Chromecast](#airplay--chromecast)
  - [Android Auto \& CarPlay](#android-auto--carplay)
  - [React Hooks Reference](#react-hooks-reference)
  - [Full API Reference](#full-api-reference)
    - [`InoPlayer.setupPlayer(options?)`](#inoplayersetupplayeroptions)
    - [State enum](#state-enum)
    - [Event enum](#event-enum)
  - [Error Handling](#error-handling)
  - [Contributing](#contributing)
  - [License](#license)

---

## Platform Support

| Device / Platform | Supported | Engine | Min version |
|---|:---:|---|---|
| **Android** phone, tablet, foldable | ✅ | Media3 ExoPlayer 1.10.0 | API 26 (Android 8.0) |
| **iOS** iPhone, iPad | ✅ | AVFoundation | iOS 13.0 |
| **Mac Catalyst** | ✅ | AVFoundation | macOS 10.15 |
| **Web** (React Native Web) | ✅ | HTMLAudioElement + MediaSession API | Chrome 73 / Firefox 82 / Safari 14 |
| **Windows** (RN Windows) | ✅ | WinRT `Windows.Media.Playback.MediaPlayer` | Windows 10 build 19041 |
| Android Auto (old + new head units) | ✅ | MediaLibraryService | 2016+ |
| Android Automotive OS | ✅ | CarAppService | AAOS API 1–6 |
| Android TV | ✅ | MediaLibrarySession | API 26+ |
| Wear OS 2 / 3 / 4 | ✅ | Wearable Data Layer | OS 2+ |
| CarPlay | ✅ | MPNowPlayingInfoCenter | iOS 13+ |
| Chromecast | ✅ | media3-cast CastPlayer | Receiver 3.x–6.x |
| AirPlay 1 & 2 | ✅ | AVAudioSession (automatic) | All iOS |
| **macOS native (AppKit)** | ❌ | — | Use Mac Catalyst instead |
| **watchOS** | ❌ | — | Uses WKAudioFileQueuePlayer |
| **tvOS** | ❌ | — | Separate Apple TV target needed |


<div style="border-left: 4px solid #d29922; padding: 28px 15px; background-color: transparent; color: #d29922; margin: 10px 0; font-weight: 500;"> Unsupported features will be implemented soon
</div>

---

## Installation

```bash
npm install react-native-ino-player
# or
yarn add react-native-ino-player
```

---

### New Architecture (react-native ≥ 0.79)

This library **requires** the New Architecture. In your `android/gradle.properties`:

```properties
newArchEnabled=true
```

In `ios/Podfile`:

```ruby
ENV['RCT_NEW_ARCH_ENABLED'] = '1'
```
---

### Android

No extra steps — the library's `AndroidManifest.xml` declares all permissions and services.

Ensure your app's `build.gradle` has `minSdkVersion = 26`.

For **Chromecast** support, add to your app's `AndroidManifest.xml`:

```xml
<meta-data
    android:name="com.google.android.gms.cast.framework.OPTIONS_PROVIDER_CLASS_NAME"
    android:value="com.inoplayer.cast.InoCastOptionsProvider" />
```

This uses Google's **default Cast receiver** (`CC1AD845`), which works for standard audio/video
playback without any extra setup.
 
### Using a custom Cast receiver app ID
 
If you have your own Cast receiver app, subclass `InoCastOptionsProvider` in your app's Android
source and override `getReceiverApplicationId()`:
 
```kotlin
// android/app/src/main/java/com/yourapp/MyOptionsProvider.kt
package com.yourapp
 
import com.inoplayer.cast.InoCastOptionsProvider
 
class MyOptionsProvider : InoCastOptionsProvider() {
    override fun getReceiverApplicationId(): String = "YOUR_CUSTOM_APP_ID"
}
```
 
Then point the manifest `meta-data` at your subclass instead:
 
```xml
<meta-data
    android:name="com.google.android.gms.cast.framework.OPTIONS_PROVIDER_CLASS_NAME"
    android:value="com.yourapp.MyOptionsProvider" />
```
 
If you need more than just a different app ID (e.g. custom namespaces, launch options), override
`getCastOptions()` directly:
 
```kotlin
import android.content.Context
import com.google.android.gms.cast.framework.CastOptions
import com.inoplayer.cast.InoCastOptionsProvider
 
class MyOptionsProvider : InoCastOptionsProvider() {
    override fun getCastOptions(context: Context) =
        CastOptions.Builder()
            .setReceiverApplicationId("YOUR_CUSTOM_APP_ID")
            .setEnableReconnectionService(true)
            // any other CastOptions here
            .build()
}
```

#### For Android Auto, also add to your manifest:

```xml
<meta-data
  android:name="com.google.android.gms.car.application"
  android:resource="@xml/automotive_app_desc" />
```
---

### iOS / Mac Catalyst

```bash
cd ios && pod install
```

Add to your `Info.plist`:

```xml
<key>UIBackgroundModes</key>
<array>
  <string>audio</string>
</array>
```
---

### Web

Works out of the box with React Native Web. Metro resolves the `.web.ts` files automatically — no extra configuration needed.

```tsx
// Web usage is identical to native
import InoPlayer from 'react-native-ino-player';
await InoPlayer.setupPlayer();
```

### Web-specific Notes

- **Background audio**: Pauses when tab is hidden (browser restriction). `navigator.mediaSession` keeps lock-screen controls alive.
- **AirPlay**: Automatic in Safari. No extra code.
- **Chromecast**: Requires [Google Cast SDK for Web](https://developers.google.com/cast/docs/web_sender) separately.
- **Caching**: Uses Cache API when available (HTTPS + Service Worker), falls back to `<audio preload="auto">`.

---

### Windows (React Native Windows)

See [`windows/README.md`](windows/README.md) for Visual Studio setup.

```cpp
// In your App.cpp
#include <winrt/RNInoPlayer.h>
PackageProviders().Append(winrt::make<winrt::RNInoPlayer::ReactPackageProvider>());
```
### Windows-specific Notes

- **Background audio**: `MediaPlayerAudioCategory.Media` keeps audio alive when minimised.
- **Lock screen**: `SystemMediaTransportControls` shows Now Playing in taskbar/lock screen.
- **HTTP headers**: Not supported by `MediaSource.CreateFromUri()` — use signed URLs for authenticated streams.
- **Chromecast/AirPlay**: Not applicable on Windows.


---

## Checking Platform Support at Runtime

On unsupported platforms ( macOS native AppKit, watchOS, tvOS ), every `InoPlayer.*` call throws `UnsupportedPlatformError`. Guard your setup:

```tsx
import InoPlayer, { isPlatformSupported } from 'react-native-ino-player';

useEffect(() => {
  if (!isPlatformSupported()) return; 
  // macOS native AppKit, watchOS, tvOS — skip gracefully

  InoPlayer.setupPlayer().then(() => {
    // Ready
  });
}, []);
```
**or**

```tsx
import InoPlayer, { isPlatformSupported } from 'react-native-ino-player';

if (!isPlatformSupported()) {
  // macOS native AppKit, watchOS, tvOS — skip gracefully
  return;
}

await InoPlayer.setupPlayer(); // Ready
```

See [`docs/ARCHITECTURE.md`](docs/ARCHITECTURE.md) for the full per-platform compatibility breakdown.

---

## Quick Start

```tsx
import InoPlayer, { Capability, usePlaybackState, useProgress, useActiveTrack, isPlatformSupported, } from 'react-native-ino-player';

// Guard for unsupported platforms (macOS native, watchOS, tvOS)
if (!isPlatformSupported()) return;

// 1. Initialize once at app startup (before any other API call)
await InoPlayer.setupPlayer({
  maxCacheSize: 512 * 1024 * 1024, // 512 MB
  preloadWindowSize: 3,
  android: { wakeMode: 'network' },
  ios: { audioCategory: 'playback' },
});

// 2. Configure notification / lock-screen controls
await InoPlayer.updateOptions({
  capabilities: [
    Capability.Play,
    Capability.Pause,
    Capability.SkipToNext,
    Capability.SkipToPrevious,
    Capability.SeekTo,
    Capability.Shuffle,
    Capability.Repeat,
  ],
  compactCapabilities: [Capability.Play, Capability.SkipToNext],
  progressUpdateEventInterval: 1,
});

// 3. Load tracks and play
await InoPlayer.setQueue([
  {
    id: '1',
    url: 'https://example.com/track1.mp3',
    title: 'Track One',
    artist: 'Artist Name',
    artwork: 'https://example.com/cover.jpg',
    duration: 240,
  },
]);

await InoPlayer.play();
```

---

## Playback Controls

```ts
await InoPlayer.play();
await InoPlayer.pause();
await InoPlayer.stop();

// Absolute seek
await InoPlayer.seekTo(90);          // jump to 1:30

// Relative seek
await InoPlayer.seekBy(30);          // forward 30 s
await InoPlayer.seekBy(-10);         // backward 10 s

// Convenience wrappers (wrap to prev/next track at boundaries)
await InoPlayer.skipForward(30);
await InoPlayer.skipBackward(15);

// Speed (0.25 – 4.0)
await InoPlayer.setRate(1.5);

// Volume (0.0 – 1.0)
await InoPlayer.setVolume(0.8);

// fade to silence over 3 s
await InoPlayer.fadeVolumeTo(0, 3000);
```

---

## Queue Management

```ts
// Replace entire queue
await InoPlayer.setQueue(tracks, /* initialIndex */ 0);

// Append
await InoPlayer.add(newTrack); // Default insert at the end
await InoPlayer.add(newTrack, 2); // Insert before index

await InoPlayer.add([track1, track2]); // Default insert at the end
await InoPlayer.add([track1, track2], 2); // Insert before index

// Navigate
await InoPlayer.skip(3);             // jump to queue index 3
await InoPlayer.skip(3, 30);         // jump to index 3, start at 30s
await InoPlayer.skipToNext();
await InoPlayer.skipToPrevious();    // seeks to start if > 3s in

// Modify
await InoPlayer.remove(1);
await InoPlayer.move(2, 0);          // move index 2 to top
await InoPlayer.updateMetadataForTrack(0, { title: 'Live — Updated Title' });
await InoPlayer.clearQueue();
```

---

## Repeat Modes

| Mode | Behaviour |
|---|---|
| `RepeatMode.Off` | Queue plays once, then stops. **Default.** |
| `RepeatMode.Track` | Current track loops forever. |
| `RepeatMode.TrackOnce` | Current track plays one additional time, then queue continues normally ("repeat once"). |
| `RepeatMode.Queue` | Whole queue repeats indefinitely. |

```ts
import { RepeatMode } from 'react-native-ino-player';

await InoPlayer.setRepeatMode(RepeatMode.Queue);
await InoPlayer.setRepeatMode(RepeatMode.TrackOnce);   // "repeat once"
```

---

## Shuffle

```ts
await InoPlayer.setShuffle(true);
await InoPlayer.setShuffle(false);

// Or use the hook:
const { shuffle, toggleShuffle, setShuffle } = useShuffle();
```

When shuffle is enabled the player follows a randomised order while still respecting the active repeat mode.

---

## Progress Bar & Seeking

```tsx
import { useProgress } from 'react-native-ino-player';
import Slider from '@react-native-community/slider';

function ProgressBar() {
  const { position, duration, buffered } = useProgress(500); // poll every 500 ms

  return (
    <Slider
      minimumValue={0}
      maximumValue={duration || 1}
      value={position}
      onSlidingComplete={val => InoPlayer.seekTo(val)}
    />
  );
}
```

---

## Sleep Timer

```ts
// Stop in 30 minutes with a 10-second volume fade
await InoPlayer.setSleepTimer({
  duration: 1800,
  fadeOut: true,
  fadeDuration: 10,
});

// Stop when the current track finishes (no fade)
await InoPlayer.setSleepTimer({ mode: 'end-of-track', fadeOut: false });

// Cancel
await InoPlayer.cancelSleepTimer();
```

```tsx
const { remaining, active, cancel } = useSleepTimer();
<Text onPress={cancel}>{active ? `Stops in ${Math.ceil(remaining)}s` : 'No timer'}
</Text>
```

---

## Volume Fade

```ts
// Fade to silence over 3 seconds
await InoPlayer.fadeVolumeTo(0, 3_000);

// Fade back up
await InoPlayer.fadeVolumeTo(1, 2_000);
```

---

## Custom Remote Actions

Register any number of fully configurable notification / lock-screen buttons:

```ts
await InoPlayer.setCustomActions([
  {
    id: 'bookmark',
    title: 'Bookmark',
    icon: 'ic_bookmark',     // Android: drawable resource name
                             // iOS: SF Symbol name (e.g. 'bookmark')
    showIn: 'both',          // 'notification' | 'lockscreen' | 'both'
  },
  {
    id: 'speed_1_5x',
    title: '1.5×',
    icon: 'ic_speed',
    showIn: 'notification',
  },
]);
```

Respond to taps:

```tsx
// With hook (recommended)
useRemoteCustomAction('bookmark', () => {
  saveBookmark(activeTrack, position);
});

// With raw event listener
import { addEventListener, Event } from 'react-native-ino-player';

const sub = addEventListener(Event.RemoteCustomAction, ({ id }) => {
  if (id === 'speed_1_5x') InoPlayer.setRate(1.5);
});
// cleanup: sub.remove();
```

---

## Preloading & Caching

The library automatically preloads the next `preloadWindowSize` (default: 3) tracks in the background — no configuration needed.

For manual pre-fetching (e.g. next episode, album tracks):

```ts
// Prime the cache for a specific URL
await InoPlayer.preloadTrack('https://cdn.example.com/episode-5.mp3');

// With auth headers
await InoPlayer.preloadTrack(url, { Authorization: 'Bearer token' });

// Inspect / manage cache
const bytes = await InoPlayer.getCacheSize();
console.log(`Cache: ${(bytes / 1024 / 1024).toFixed(1)} MB`);

await InoPlayer.clearCache();
```

**Offline playback** — set the `localUri` field on a `Track` to use a local file instead of the remote URL:

```ts
{
  id: '1',
  url: 'https://cdn.example.com/track.mp3',   // fallback
  localUri: 'file:///path/to/downloaded.mp3', // used when present
  title: 'Offline Track',
}
```

---

## AirPlay & Chromecast

```tsx
import { Platform, Text, TouchableOpacity } from 'react-native';
import { useCastState, CastState } from 'react-native-ino-player';

function CastButton() {
  const { state, deviceName } = useCastState();

  const handlePress = () => {
    if (Platform.OS === 'ios') {
      InoPlayer.showAirPlayPicker();        // shows native AirPlay popover
    } else {
      InoPlayer.showCastDialog();           // shows Chromecast device list
    }
  };

  return (
    <TouchableOpacity onPress={handlePress}>
      <Text>
        {state === CastState.Connected
          ? `▶ ${deviceName}`
          : state === CastState.Connecting
          ? 'Connecting…'
          : 'Cast'}
      </Text>
    </TouchableOpacity>
  );
}
```

---

## Android Auto & CarPlay

Register a browse-tree loader that the OS calls whenever the car head unit needs content:

```ts
InoPlayer.setCarBrowseTreeLoader(async (parentId) => {
  // parentId === null → root level
  if (parentId === null) {
    return [
      { id: 'playlists', title: 'Playlists', browsable: true,  playable: false },
      { id: 'albums',    title: 'Albums',    browsable: true,  playable: false },
      { id: 'recent',    title: 'Recent',    browsable: false, playable: true  },
    ];
  }

  // Return children for the selected item
  if (parentId === 'playlists') return await fetchPlaylists();
  if (parentId === 'albums')    return await fetchAlbums();
  return [];
});
```

Each `CarMediaItem`:

| Field | Type | Description |
|---|---|---|
| `id` | `string` | Stable identifier |
| `title` | `string` | Display name |
| `subtitle` | `string?` | Secondary line |
| `artworkUri` | `string?` | Remote or local URI |
| `playable` | `boolean` | Triggers playback when selected |
| `browsable` | `boolean` | Opens a child list when selected |

---

## React Hooks Reference

| Hook | Returns | Description |
|---|---|---|
| `usePlaybackState()` | `{ state: State, error? }` | Current player state |
| `useIsPlaying()` | `{ playing, bufferingDuringPlay }` | Quick play/buffer check |
| `useProgress(ms?)` | `{ position, duration, buffered }` | Live progress (seconds) |
| `useActiveTrack()` | `Track \| undefined` | Currently playing track |
| `useQueue()` | `Track[]` | Full playback queue |
| `useShuffle()` | `{ shuffle, toggleShuffle, setShuffle }` | Shuffle state + controls |
| `useRepeatMode()` | `{ repeatMode, setRepeatMode, cycleRepeatMode }` | Repeat state + controls |
| `useSleepTimer()` | `{ remaining, active, cancel }` | Sleep timer countdown |
| `useCastState()` | `{ state: CastState, deviceName? }` | AirPlay / Chromecast state |
| `useRemoteCustomAction(id, fn)` | `void` | Subscribe to a custom action tap |
| `usePlaybackError()` | `PlaybackError \| null` | Most recent error |

---

## Full API Reference

### `InoPlayer.setupPlayer(options?)`

Must be called **once**, from the foreground, before any other API.

| Option | Type | Default | Description |
|---|---|---|---|
| `minBufferMs` | `number` | `2500` | Buffer before playback starts (ms) |
| `maxBufferMs` | `number` | `50000` | Max buffer ahead (ms) |
| `backBufferMs` | `number` | `2500` | Buffer behind playhead (ms) |
| `maxCacheSize` | `number` | `1073741824` | Disk cache limit in bytes (0 = off) |
| `preloadWindowSize` | `number` | `3` | Upcoming tracks to preload |
| `backgroundAudio` | `boolean` | `true` | Keep audio alive when backgrounded |
| `handleAudioBecomingNoisy` | `boolean` | `true` | Pause on headphone unplug |
| `android.notificationChannelName` | `string` | `'Media Playback'` | Notification channel name |
| `android.wakeMode` | `'none' \| 'local' \| 'network'` | `'network'` | CPU wake-lock strategy |
| `android.smallIcon` | `string` | app icon | Drawable resource for notification icon |
| `ios.audioCategory` | `'playback' \| 'ambient' \| 'soloAmbient'` | `'playback'` | AVAudioSession category |
| `ios.audioMode` | `string` | `'default'` | AVAudioSession mode |

### State enum

| Value | Description |
|---|---|
| `State.None` | Not initialized |
| `State.Ready` | Initialized, no item |
| `State.Playing` | Actively playing |
| `State.Paused` | Paused |
| `State.Buffering` | Buffer empty, waiting |
| `State.Loading` | Initial track load |
| `State.Ended` | Queue finished |
| `State.Error` | Fatal error |

### Event enum

| Event | Payload | Description |
|---|---|---|
| `PlaybackState` | `{ state, error? }` | State changed |
| `PlaybackError` | `{ code, message }` | Fatal error |
| `PlaybackActiveTrackChanged` | `{ index, track, lastIndex, lastTrack, lastPosition }` | Track changed |
| `PlaybackQueueEnded` | `{ index, position }` | Queue finished |
| `PlaybackProgressUpdated` | `{ position, duration, buffered, track }` | Progress tick |
| `SleepTimerFired` | `{}` | Sleep timer triggered |
| `SleepTimerTick` | `{ remaining }` | Countdown second |
| `RemotePlay` | `{}` | Lock-screen / notification play |
| `RemotePause` | `{}` | Lock-screen / notification pause |
| `RemoteStop` | `{}` | Lock-screen stop |
| `RemoteNext` | `{}` | Next button tapped |
| `RemotePrevious` | `{}` | Previous button tapped |
| `RemoteSeek` | `{ position }` | Scrubber dragged |
| `RemoteJumpForward` | `{ interval }` | Jump-forward tapped |
| `RemoteJumpBackward` | `{ interval }` | Jump-backward tapped |
| `RemoteShuffle` | `{}` | Shuffle button tapped |
| `RemoteRepeat` | `{}` | Repeat button tapped |
| `RemoteCustomAction` | `{ id }` | Custom button tapped |
| `CastStateChanged` | `{ state, deviceName? }` | Cast connection changed |
| `CarBrowseItemSelected` | `{ id, parentId }` | Car head unit browse request |

---

## Error Handling

Every playback error fires `Event.PlaybackError` and transitions to `State.Error`.

```tsx
import { usePlaybackState, State } from 'react-native-ino-player';

function PlayerErrorHandler() {
  const { state, error } = usePlaybackState();

  useEffect(() => {
    if (state === State.Error) {
      console.error(`[${error?.code}] ${error?.message}`);
      // Auto-skip to next track on error
      InoPlayer.skipToNext().catch(() => {});
    }
  }, [state, error]);

  return null;
}
```

Common error codes on Android (ExoPlayer):

| Code | Cause |
|---|---|
| `ERROR_CODE_IO_NETWORK_CONNECTION_FAILED` | Network unreachable |
| `ERROR_CODE_IO_FILE_NOT_FOUND` | 404 / bad URL |
| `ERROR_CODE_PARSING_CONTAINER_MALFORMED` | Corrupt media file |
| `ERROR_CODE_DECODER_INIT_FAILED` | Codec not supported on device |

Common error codes on Web:

| Code | Cause |
|---|---|
| `MEDIA_ERR_NETWORK`| Network unreachable |
| `MEDIA_ERR_DECODE`| Corrupt media file |
| `MEDIA_ERR_SRC_NOT_SUPPORTED`| Unsupported format/Bad URL |
| `AUTOPLAY_BLOCKED`|

---

## Contributing

See [CONTRIBUTING.md](CONTRIBUTING.md) for the full development guide.

---

## License

[MIT](LICENSE) © Pritam Nanda
