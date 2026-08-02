# react-native-ino-player

> A full-featured audio/video media player for **React Native** — built on the **New Architecture** (TurboModule + Bridgeless, RN ≥ 0.74).

[![npm version](https://img.shields.io/npm/v/react-native-ino-player?color=green)](https://www.npmjs.com/package/react-native-ino-player)
[![CI](https://github.com/I-am-Pritam-20/react-native-ino-player/actions/workflows/ci.yml/badge.svg)](https://github.com/I-am-Pritam-20/react-native-ino-player/actions/workflows/ci.yml)
[![Android Build](https://github.com/I-am-Pritam-20/react-native-ino-player/actions/workflows/build-android.yml/badge.svg)](https://github.com/I-am-Pritam-20/react-native-ino-player/actions/workflows/build-android.yml)
[![iOS Build](https://github.com/I-am-Pritam-20/react-native-ino-player/actions/workflows/build-ios.yml/badge.svg)](https://github.com/I-am-Pritam-20/react-native-ino-player/actions/workflows/build-ios.yml)
[![License: MIT](https://img.shields.io/badge/License-MIT-blue.svg)](LICENSE)
[![TypeScript](https://img.shields.io/badge/TypeScript-strict-blue)](tsconfig.json)

---

## Platform Support

| Device / Platform | Supported | Engine | Notes |
|---|:---:|---|---|
| **Android phone** | ✅ | Media3 ExoPlayer | API 26+ (Android 8.0+) |
| **Android tablet** | ✅ | Media3 ExoPlayer | Same APK as phone, no extra code |
| **Android foldable** | ✅ | Media3 ExoPlayer | Both folded + unfolded |
| **Chromebook (Play Store)** | ✅ | Media3 ExoPlayer | Runs Android APK |
| **iPhone** | ✅ | AVFoundation | iOS 13+ |
| **iPad** | ✅ | AVFoundation | Same IPA as iPhone |
| **Mac Catalyst** | ✅ | AVFoundation | iPad app on macOS, enable in Xcode |
| **Android Auto** | ✅ | MediaLibraryService | Old + new head units (2016–2025) |
| **Android Automotive OS** | ✅ | CarAppService | AAOS API 1–6 |
| **Android TV** | ✅ | MediaLibrarySession | All Android TV / Google TV |
| **Wear OS** | ✅ | Data Layer | Wear OS 2/3/4 |
| **CarPlay** | ✅ | MPNowPlayingInfo | Via AVFoundation lock screen |
| **Chromecast** | ✅ | media3-cast CastPlayer | Receiver SDK 3.x–6.x (2018+) |
| **AirPlay 1 & 2** | ✅ | AVAudioSession | Automatic, no extra code |
| **macOS native (AppKit)** | ❌ | — | Use Mac Catalyst instead |
| **Windows** | ❌ | — | Different API; see docs/ARCHITECTURE.md |
| **Web** | ❌ | — | Use HTMLAudioElement instead |
| **watchOS** | ❌ | — | Uses WKAudioFileQueuePlayer |
| **tvOS** | ❌ | — | Separate Apple TV target needed |

---

## Table of Contents

1. [Installation](#installation)
2. [Quick Start](#quick-start)
3. [Playback Controls](#playback-controls)
4. [Queue Management](#queue-management)
5. [Repeat Modes](#repeat-modes)
6. [Shuffle](#shuffle)
7. [Progress Bar & Seeking](#progress-bar--seeking)
8. [Sleep Timer](#sleep-timer)
9. [Volume Fade](#volume-fade)
10. [Custom Remote Actions](#custom-remote-actions)
11. [Preloading & Caching](#preloading--caching)
12. [AirPlay & Chromecast](#airplay--chromecast)
13. [Android Auto & CarPlay](#android-auto--carplay)
14. [React Hooks Reference](#react-hooks-reference)
15. [Full API Reference](#full-api-reference)
16. [Error Handling](#error-handling)
17. [Contributing](#contributing)

---

## Installation

```bash
npm install react-native-ino-player
# or
yarn add react-native-ino-player
```

### iOS

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

### Android

No extra steps — the library's `AndroidManifest.xml` declares all permissions and services.

Ensure your app's `build.gradle` has `minSdkVersion = 21`.

For Chromecast support, add to your app's `AndroidManifest.xml`:

```xml
<meta-data
  android:name="com.google.android.gms.cast.framework.OPTIONS_PROVIDER_CLASS_NAME"
  android:value="YOUR_PACKAGE.CastOptionsProvider" />
```

For Android Auto, also add to your manifest:

```xml
<meta-data
  android:name="com.google.android.gms.car.application"
  android:resource="@xml/automotive_app_desc" />
```

### New Architecture

This library **requires** the New Architecture. In your `android/gradle.properties`:

```properties
newArchEnabled=true
```

In `ios/Podfile`:

```ruby
ENV['RCT_NEW_ARCH_ENABLED'] = '1'
```

---

## Checking Platform Support at Runtime

On unsupported platforms (Windows, Web), every `InoPlayer.*` call throws `UnsupportedPlatformError`. Guard your setup:

```tsx
import InoPlayer, { isPlatformSupported } from 'react-native-ino-player';

useEffect(() => {
  if (!isPlatformSupported()) return; // Windows / Web: skip gracefully

  InoPlayer.setupPlayer().then(() => {
    // Ready
  });
}, []);
```

See [`docs/ARCHITECTURE.md`](docs/ARCHITECTURE.md) for the full per-platform compatibility breakdown.

---

## Quick Start

```tsx
import InoPlayer, {
  Capability,
  usePlaybackState,
  useProgress,
  useActiveTrack,
} from 'react-native-ino-player';

// 1. Initialize once at app startup (before any other API call)
await InoPlayer.setupPlayer({
  maxCacheSize: 512 * 1024 * 1024, // 512 MB
  preloadWindowSize: 3,
  android: { wakeMode: 'network' },
  ios:     { audioCategory: 'playback' },
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
```

---

## Queue Management

```ts
// Replace entire queue
await InoPlayer.setQueue(tracks, /* initialIndex */ 0);

// Append
await InoPlayer.add(newTrack);
await InoPlayer.add([track1, track2]);

// Insert before index
await InoPlayer.add(newTrack, 2);

// Navigate
await InoPlayer.skip(3);             // jump to queue index 3
await InoPlayer.skip(3, 30);         // jump to index 3, start at 30 s
await InoPlayer.skipToNext();
await InoPlayer.skipToPrevious();    // seeks to start if > 3 s in

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

return active
  ? <Text onPress={cancel}>Stops in {Math.ceil(remaining)} s — tap to cancel</Text>
  : null;
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
import { Platform } from 'react-native';
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

---

## Contributing

See [CONTRIBUTING.md](CONTRIBUTING.md) for the full development guide.

---

## License

[MIT](LICENSE) © Pritam Nanda
