/**
 * react-native-ino-player — Native platform barrel export
 * (Android, iOS, Mac Catalyst, Windows)
 *
 * Web uses src/index.web.ts (resolved by Metro on web platform).
 */

export { InoPlayer as default, InoPlayer } from './player';
export { State, RepeatMode, CastState, Capability, Event } from './player';
export type {
  Track, PlayerOptions, UpdateOptions, Progress,
  CustomAction, SleepTimerConfig, CastStateInfo,
  CarMediaItem, CarBrowseTreeLoader,
} from './player';
export type { PlaybackError, PlaybackStateEvent } from './types';
export {
  usePlaybackState, useIsPlaying, useProgress, useActiveTrack,
  useQueue, useShuffle, useRepeatMode, useSleepTimer,
  useCastState, useRemoteCustomAction, usePlaybackError,
} from './hooks';
export { addEventListener } from './events';
export type { EventPayloads } from './events';
export { isPlatformSupported, UnsupportedPlatformError } from './platformGuard';
