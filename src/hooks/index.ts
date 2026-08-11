/**
 * src/hooks/index.ts
 * All React hooks for react-native-ino-player.
 * Works on all supported platforms — Android, iOS, Web, Windows, Mac Catalyst.
 *
 * On Web: hooks import from '../player' and '../events', which Metro
 *   resolves to player.web.ts and events/index.web.ts automatically.
 * On native: hooks import the native implementations.
 * Zero platform-specific code needed in this file.
 */

import { useState, useEffect, useRef, useCallback } from 'react';
import { InoPlayer } from '../player';
import { addEventListener } from '../events';
import { Event, State, RepeatMode, CastState } from '../types';
import type { Track, Progress, CastStateInfo } from '../types';

// ─── usePlaybackState ─────────────────────────────────────────────────────────

export function usePlaybackState(): {
  state: State;
  error?: { code: string; message: string };
} {
  const [value, setValue] = useState<{
    state: State;
    error?: { code: string; message: string };
  }>({ state: State.None });

  useEffect(() => {
    let cancelled = false;
    InoPlayer.getState()
      .then(s => { if (!cancelled) setValue({ state: s }); })
      .catch(() => {});

    const sub = addEventListener(Event.PlaybackState, p => {
      setValue({ state: p.state as State, error: p.error });
    });

    return () => { cancelled = true; sub.remove(); };
  }, []);

  return value;
}

// ─── useIsPlaying ─────────────────────────────────────────────────────────────

export function useIsPlaying(): { playing: boolean; bufferingDuringPlay: boolean } {
  const { state } = usePlaybackState();
  return {
    playing: state === State.Playing,
    bufferingDuringPlay: state === State.Buffering,
  };
}

// ─── useProgress ─────────────────────────────────────────────────────────────

export function useProgress(updateInterval = 1000): Progress {
  const [progress, setProgress] = useState<Progress>({
    position: 0, duration: 0, buffered: 0,
  });

  useEffect(() => {
    const sub = addEventListener(Event.PlaybackProgressUpdated, p => {
      setProgress({ position: p.position, duration: p.duration, buffered: p.buffered });
    });

    const timer = setInterval(async () => {
      try { setProgress(await InoPlayer.getProgress()); } catch { /* ignore */ }
    }, updateInterval);

    return () => { sub.remove(); clearInterval(timer); };
  }, [updateInterval]);

  return progress;
}

// ─── useActiveTrack ───────────────────────────────────────────────────────────

export function useActiveTrack(): Track | undefined {
  const [track, setTrack] = useState<Track | undefined>(undefined);

  useEffect(() => {
    let cancelled = false;
    InoPlayer.getActiveTrack()
      .then(t => { if (!cancelled) setTrack(t ?? undefined); })
      .catch(() => {});

    const sub = addEventListener(Event.PlaybackActiveTrackChanged, p => {
      setTrack(p.track ?? undefined);
    });

    return () => { cancelled = true; sub.remove(); };
  }, []);

  return track;
}

// ─── useQueue ─────────────────────────────────────────────────────────────────

export function useQueue(): Track[] {
  const [queue, setQueue] = useState<Track[]>([]);

  const refresh = useCallback(async () => {
    try { setQueue(await InoPlayer.getQueue()); } catch { /* ignore */ }
  }, []);

  useEffect(() => {
    refresh();
    const subs = [
      addEventListener(Event.PlaybackActiveTrackChanged, refresh),
      addEventListener(Event.PlaybackQueueEnded, refresh),
    ];
    return () => subs.forEach(s => s.remove());
  }, [refresh]);

  return queue;
}

// ─── useShuffle ───────────────────────────────────────────────────────────────

export function useShuffle(): {
  shuffle: boolean;
  toggleShuffle: () => Promise<void>;
  setShuffle: (enabled: boolean) => Promise<void>;
} {
  const [shuffle, setLocalShuffle] = useState(false);

  const setShuffle = useCallback(async (enabled: boolean) => {
    await InoPlayer.setShuffle(enabled);
    setLocalShuffle(enabled);
  }, []);

  const toggleShuffle = useCallback(
    () => setShuffle(!shuffle),
    [shuffle, setShuffle]
  );

  useEffect(() => {
    InoPlayer.getShuffle().then(setLocalShuffle).catch(() => {});

    const sub = addEventListener(Event.RemoteShuffle, async () => {
      const current = await InoPlayer.getShuffle().catch(() => false);
      await setShuffle(!current);
    });

    return () => sub.remove();
  }, [setShuffle]);

  return { shuffle, toggleShuffle, setShuffle };
}

// ─── useRepeatMode ────────────────────────────────────────────────────────────

export function useRepeatMode(): {
  repeatMode: RepeatMode;
  setRepeatMode: (mode: RepeatMode) => Promise<void>;
  cycleRepeatMode: () => Promise<void>;
} {
  const CYCLE: RepeatMode[] = [
    RepeatMode.Off, RepeatMode.Track, RepeatMode.TrackOnce, RepeatMode.Queue,
  ];
  const [repeatMode, setLocalRepeat] = useState<RepeatMode>(RepeatMode.Off);

  const setRepeatMode = useCallback(async (mode: RepeatMode) => {
    await InoPlayer.setRepeatMode(mode);
    setLocalRepeat(mode);
  }, []);

  const cycleRepeatMode = useCallback(async () => {
    setLocalRepeat(prev => {
      const next = CYCLE[(CYCLE.indexOf(prev) + 1) % CYCLE.length]!;
      InoPlayer.setRepeatMode(next).catch(() => {});
      return next;
    });
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    InoPlayer.getRepeatMode().then(setLocalRepeat).catch(() => {});
    const sub = addEventListener(Event.RemoteRepeat, cycleRepeatMode);
    return () => sub.remove();
  }, [cycleRepeatMode]);

  return { repeatMode, setRepeatMode, cycleRepeatMode };
}

// ─── useSleepTimer ────────────────────────────────────────────────────────────

export function useSleepTimer(): {
  remaining: number;
  active: boolean;
  cancel: () => Promise<void>;
} {
  const [remaining, setRemaining] = useState(-1);

  const cancel = useCallback(async () => {
    await InoPlayer.cancelSleepTimer();
    setRemaining(-1);
  }, []);

  useEffect(() => {
    InoPlayer.getSleepTimerRemaining().then(setRemaining).catch(() => {});
    const tickSub = addEventListener(Event.SleepTimerTick, p => setRemaining(p.remaining));
    const fireSub = addEventListener(Event.SleepTimerFired, () => setRemaining(-1));
    return () => { tickSub.remove(); fireSub.remove(); };
  }, []);

  return { remaining, active: remaining >= 0, cancel };
}

// ─── useCastState ─────────────────────────────────────────────────────────────

export function useCastState(): CastStateInfo {
  const [info, setInfo] = useState<CastStateInfo>({ state: CastState.NoDevices });

  useEffect(() => {
    InoPlayer.getCastState().then(setInfo).catch(() => {});
    const sub = addEventListener(Event.CastStateChanged, setInfo);
    return () => sub.remove();
  }, []);

  return info;
}

// ─── useRemoteCustomAction ────────────────────────────────────────────────────

export function useRemoteCustomAction(id: string, handler: () => void): void {
  const handlerRef = useRef(handler);
  handlerRef.current = handler;

  useEffect(() => {
    const sub = addEventListener(Event.RemoteCustomAction, p => {
      if (p.id === id) handlerRef.current();
    });
    return () => sub.remove();
  }, [id]);
}

// ─── usePlaybackError ─────────────────────────────────────────────────────────

export function usePlaybackError(): { code: string; message: string } | null {
  const { state, error } = usePlaybackState();
  return state === State.Error ? (error ?? null) : null;
}
