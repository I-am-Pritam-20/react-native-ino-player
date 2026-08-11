/**
 * src/events/index.ts
 * Native platform event subscription (Android, iOS, Windows).
 * Web uses src/events/index.web.ts instead (Metro platform resolution).
 */

import { NativeEventEmitter } from 'react-native';
import NativeInoPlayer from '../../specs/NativeInoPlayer';
import type { Track, PlaybackError, CastStateInfo } from '../types';
import { Event } from '../types';

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

let _emitter: NativeEventEmitter | null = null;
function getEmitter(): NativeEventEmitter {
  if (!_emitter) {
    _emitter = new NativeEventEmitter(NativeInoPlayer as any);
  }
  return _emitter;
}

export function addEventListener<E extends Event>(
  event: E,
  listener: (payload: EventPayloads[E]) => void
): { remove: () => void } {
  const sub = getEmitter().addListener(event as string, listener as any);
  return { remove: () => sub.remove() };
}

export { Event };
