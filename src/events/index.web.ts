/**
 * src/events/index.web.ts
 *
 * Web-platform event subscription.
 * Metro resolves this file instead of index.ts on the web platform,
 * so hooks automatically get the web event system with zero changes.
 *
 * The API is identical to the native version — same EventPayloads,
 * same addEventListener signature — but backed by webEventBus instead
 * of NativeEventEmitter.
 */

import { webEventBus } from '../web/webEventBus';
import type { Track, PlaybackError, CastStateInfo } from '../types';
import { Event } from '../types';

// Re-export EventPayloads type (identical to the native version)
export interface EventPayloads {
  [Event.PlaybackState]: { state: string; error?: PlaybackError };
  [Event.PlaybackError]: PlaybackError;
  [Event.PlaybackActiveTrackChanged]: {
    index: number | null;
    track: Track | null;
    lastIndex: number | null;
    lastTrack: Track | null;
    lastPosition: number;
  };
  [Event.PlaybackQueueEnded]: { index: number; position: number };
  [Event.PlaybackProgressUpdated]: {
    position: number;
    duration: number;
    buffered: number;
    track: number;
  };
  [Event.SleepTimerFired]: Record<string, never>;
  [Event.SleepTimerTick]: { remaining: number };
  [Event.RemotePlay]: Record<string, never>;
  [Event.RemotePause]: Record<string, never>;
  [Event.RemoteStop]: Record<string, never>;
  [Event.RemoteNext]: Record<string, never>;
  [Event.RemotePrevious]: Record<string, never>;
  [Event.RemoteSeek]: { position: number };
  [Event.RemoteJumpForward]: { interval: number };
  [Event.RemoteJumpBackward]: { interval: number };
  [Event.RemoteShuffle]: Record<string, never>;
  [Event.RemoteRepeat]: Record<string, never>;
  [Event.RemoteCustomAction]: { id: string };
  [Event.CastStateChanged]: CastStateInfo;
  [Event.CarBrowseItemSelected]: { id: string; parentId: string | null };
}

/**
 * Subscribe to a typed InoPlayer event on web.
 * Identical API to the native addEventListener — hooks work unchanged.
 */
export function addEventListener<E extends Event>(
  event: E,
  listener: (payload: EventPayloads[E]) => void,
): { remove: () => void } {
  return webEventBus.addListener(event as string, listener as (p: unknown) => void);
}

export { Event };
