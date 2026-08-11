/**
 * src/platformGuard.ts
 *
 * Platform support declarations.
 *
 * SUPPORTED:
 *   android  — API 26+ (Android 8.0): phone, tablet, foldable, Chromebook
 *   ios      — iOS 13+: iPhone, iPad, Mac Catalyst
 *   web      — Chrome 73+, Firefox 82+, Safari 14+, Edge 79+
 *   windows  — Windows 10 build 19041+ (RN Windows 0.74+)
 *
 * NOT SUPPORTED:
 *   macos    — native AppKit target (use Mac Catalyst / ios target instead)
 *   tvos     — separate Apple TV target needed
 *   watchos  — different media API (WKAudioFileQueuePlayer)
 */

import { Platform } from 'react-native';

const SUPPORTED_PLATFORMS = new Set(['android', 'ios', 'web', 'windows']);

/** Returns true when running on a supported platform. */
export function isPlatformSupported(): boolean {
  return SUPPORTED_PLATFORMS.has(Platform.OS);
}

/**
 * Throws a descriptive error on unsupported platforms.
 * Called at the top of every InoPlayer method on native platforms.
 * (Web and Windows have their own implementations so this is not called there.)
 */
export function assertPlatformSupported(methodName: string): void {
  if (!isPlatformSupported()) {
    throw new UnsupportedPlatformError(methodName);
  }
}

export class UnsupportedPlatformError extends Error {
  constructor(methodName: string) {
    const platform = Platform.OS;
    const guide: Record<string, string> = {
      macos:
        'Use Mac Catalyst (ios target) instead of the native macOS AppKit target.',
      tvos: 'A separate Apple TV target with tvOS-specific AVPlayer setup is needed.',
      watchos: 'watchOS uses WKAudioFileQueuePlayer — a different API.',
    };
    const hint =
      guide[platform] ??
      'This platform is not supported by react-native-ino-player.';

    super(
      `[InoPlayer] \`${methodName}\` is not supported on platform "${platform}".\n` +
        `Supported platforms: android (API 26+), ios (iOS 13+), web, windows (RN Windows 0.74+).\n` +
        hint
    );
    this.name = 'UnsupportedPlatformError';
  }
}

/**
 * Returns a proxy where every method is a no-op (returns undefined).
 * Useful for platforms where throwing would break module initialisation.
 */
export function noOpProxy<T extends object>(name: string): T {
  return new Proxy({} as T, {
    get(_target, prop) {
      if (prop === 'then') return undefined;
      return (..._args: unknown[]) => {
        console.warn(
          `[InoPlayer] \`${name}.${String(prop)}\` is a no-op on "${Platform.OS}".`
        );
        return Promise.resolve(undefined);
      };
    },
  });
}
