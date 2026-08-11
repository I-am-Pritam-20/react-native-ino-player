/**
 * src/index.web.ts
 *
 * Web platform barrel export.
 * Metro resolves this file instead of src/index.ts on the web platform.
 * The hooks file (src/hooks/index.ts) imports from '../player' and '../events',
 * which Metro also resolves to the .web.ts variants — so hooks work on web
 * with zero modification.
 */

// ── Main player (web implementation) ─────────────────────────────────────────
export { InoPlayer as default, InoPlayer } from './player.web';

// ── Enums ─────────────────────────────────────────────────────────────────────
export { State, RepeatMode, CastState, Capability, Event } from './player.web';

// ── Types ─────────────────────────────────────────────────────────────────────
export type {
  Track,
  PlayerOptions,
  UpdateOptions,
  Progress,
  CustomAction,
  SleepTimerConfig,
  CastStateInfo,
  CarMediaItem,
  CarBrowseTreeLoader,
} from './player.web';

export type { PlaybackError, PlaybackStateEvent } from './types';

// ── Hooks (same file as native — hooks import from ./player & ./events,
//    which Metro resolves to .web.ts variants automatically) ───────────────────
export {
  usePlaybackState,
  useIsPlaying,
  useProgress,
  useActiveTrack,
  useQueue,
  useShuffle,
  useRepeatMode,
  useSleepTimer,
  useCastState,
  useRemoteCustomAction,
  usePlaybackError,
} from './hooks';

// ── Event subscription (web version) ─────────────────────────────────────────
export { addEventListener } from './events/index.web';
export type { EventPayloads } from './events/index.web';

// ── Platform guard ────────────────────────────────────────────────────────────
export { isPlatformSupported, UnsupportedPlatformError } from './platformGuard';
