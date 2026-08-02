# Contributing to react-native-ino-player

## Supported platforms

| Platform | Engine | Min version |
|---|---|---|
| Android | Media3 ExoPlayer 1.10.0 | API 26 |
| iOS / iPad / Mac Catalyst | AVFoundation | iOS 13 |
| Web | HTMLAudioElement + MediaSession | Chrome 73 |
| Windows | WinRT MediaPlayer | Win 10 build 19041 |

## Prerequisites

| Tool | Version |
|---|---|
| Node.js | 20 (see `.nvmrc`) |
| Yarn | 4.x Berry |
| Android Studio | Hedgehog+ |
| Xcode | 14.x+ |
| CocoaPods | 1.14+ |
| Visual Studio | 2022 (for Windows) |
| Windows SDK | 10.0.22621.0 (for Windows) |

## Setup

```bash
git clone https://github.com/I-am-Pritam-20/react-native-ino-player.git
cd react-native-ino-player
yarn install && yarn build

# iOS
cd example/ios && pod install && cd ../..
```

## Branch workflow

```
feature/xyz → develop → main → tag → npm publish
```

Always branch from `develop`. PRs target `develop`. Maintainer merges `develop → main` for releases.

## Local checks (run before pushing)

```bash
yarn typecheck
yarn lint
yarn test
yarn build
node scripts/validate-exports.js
```

## Platform-specific files

| File | Platform | Why |
|---|---|---|
| `src/player.ts` | Android, iOS, Windows, Mac Catalyst | Native TurboModule |
| `src/player.web.ts` | Web | HTMLAudioElement (Metro resolves automatically) |
| `src/events/index.ts` | Android, iOS, Windows | NativeEventEmitter |
| `src/events/index.web.ts` | Web | webEventBus (Metro resolves automatically) |
| `src/index.web.ts` | Web | Web barrel export |

**Rule:** Web files (`*.web.ts`) must NEVER import from `specs/NativeInoPlayer`. The CI `build-web.yml` enforces this.

## Adding a new API method

1. Add to `specs/NativeInoPlayer.ts` (bridge contract)
2. Add to `src/player.ts` (native) AND `src/player.web.ts` (web)
3. Add to `src/types/index.ts` if new types are needed
4. Implement in Android: `InoPlayerModule.kt` → `PlayerController.kt`
5. Implement in iOS: `RNInoPlayer.mm` → `InoPlayerCore.swift`
6. Implement in Windows: `InoPlayerModule.h` + `InoPlayerModule.cpp`
7. Add unit tests in `__tests__/player.test.ts`
8. Update `CHANGELOG.md`

## Commit format (Conventional Commits)

```
feat(android): add gapless playback
fix(ios): prevent crash on empty queue
docs: update Windows setup guide
chore: bump media3 to 1.10.1
test(web): add WebQueue move() test
```

## Testing

```bash
yarn test                    # unit tests (all platforms mocked)
yarn test --coverage         # with coverage

# Android instrumented (needs emulator)
cd example/android && ./gradlew connectedAndroidTest

# iOS
cd example/ios && xcodebuild test -workspace InoPlayerExample.xcworkspace \
  -scheme InoPlayerExampleTests -destination 'platform=iOS Simulator,name=iPhone 15'
```
