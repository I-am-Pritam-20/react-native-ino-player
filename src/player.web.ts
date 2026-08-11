/**
 * src/player.web.ts
 *
 * Web-platform InoPlayer API.
 * Metro resolves this over src/player.ts on the web platform.
 *
 * This is a thin adapter that delegates every call to the WebPlayer
 * singleton (HTMLAudioElement-based) while exposing the exact same
 * public API surface as the native implementation.
 */

import { webPlayer } from './web/WebPlayer';
import type {
  Track,
  PlayerOptions,
  UpdateOptions,
  Progress,
  CustomAction,
  SleepTimerConfig,
  CastStateInfo,
  CarMediaItem,
  CarBrowseTreeLoader,
} from './types';
import { State, RepeatMode, CastState, Capability, Event } from './types';
import { isPlatformSupported } from './platformGuard';

export const InoPlayer = {
  // ── Lifecycle ──────────────────────────────────────────────────────────────

  async setupPlayer(options: PlayerOptions = {}): Promise<void> {
    return webPlayer.setupPlayer(options);
  },

  async destroy(): Promise<void> {
    return webPlayer.destroy();
  },

  async updateOptions(options: UpdateOptions): Promise<void> {
    return webPlayer.updateOptions(options);
  },

  async setCustomActions(actions: CustomAction[]): Promise<void> {
    return webPlayer.setCustomActions(actions);
  },

  // ── Queue ──────────────────────────────────────────────────────────────────

  async setQueue(tracks: Track[], initialIndex = 0): Promise<void> {
    return webPlayer.setQueue(tracks, initialIndex);
  },

  async add(tracks: Track | Track[], insertBeforeIndex = -1): Promise<void> {
    const arr = Array.isArray(tracks) ? tracks : [tracks];
    return webPlayer.add(arr, insertBeforeIndex);
  },

  async remove(index: number): Promise<void> {
    return webPlayer.remove(index);
  },

  async move(fromIndex: number, toIndex: number): Promise<void> {
    return webPlayer.move(fromIndex, toIndex);
  },

  async updateMetadataForTrack(
    index: number,
    metadata: Partial<Omit<Track, 'id'>>
  ): Promise<void> {
    return webPlayer.updateMetadataForTrack(index, metadata);
  },

  async clearQueue(): Promise<void> {
    return webPlayer.clearQueue();
  },

  // ── Navigation ─────────────────────────────────────────────────────────────

  async skip(index: number, initialPosition = 0): Promise<void> {
    return webPlayer.skip(index, initialPosition);
  },

  async skipToNext(initialPosition = 0): Promise<void> {
    return webPlayer.skipToNext(initialPosition);
  },

  async skipToPrevious(initialPosition = 0): Promise<void> {
    return webPlayer.skipToPrevious(initialPosition);
  },

  async skipForward(seconds: number): Promise<void> {
    return webPlayer.skipForward(seconds);
  },

  async skipBackward(seconds: number): Promise<void> {
    return webPlayer.skipBackward(seconds);
  },

  // ── Transport ──────────────────────────────────────────────────────────────

  async play(): Promise<void> {
    return webPlayer.play();
  },

  async pause(): Promise<void> {
    return webPlayer.pause();
  },

  async stop(): Promise<void> {
    return webPlayer.stop();
  },

  async seekTo(position: number): Promise<void> {
    return webPlayer.seekTo(position);
  },

  async seekBy(offset: number): Promise<void> {
    return webPlayer.seekBy(offset);
  },

  async setRate(rate: number): Promise<void> {
    return webPlayer.setRate(rate);
  },

  async setVolume(volume: number): Promise<void> {
    return webPlayer.setVolume(volume);
  },

  async fadeVolumeTo(targetVolume: number, durationMs: number): Promise<void> {
    return webPlayer.fadeVolumeTo(targetVolume, durationMs);
  },

  // ── Mode ───────────────────────────────────────────────────────────────────

  async setRepeatMode(mode: RepeatMode): Promise<void> {
    return webPlayer.setRepeatMode(mode);
  },

  async setShuffle(enabled: boolean): Promise<void> {
    return webPlayer.setShuffle(enabled);
  },

  // ── Sleep timer ────────────────────────────────────────────────────────────

  async setSleepTimer(config: SleepTimerConfig = {}): Promise<void> {
    return webPlayer.setSleepTimer(config);
  },

  async cancelSleepTimer(): Promise<void> {
    return webPlayer.cancelSleepTimer();
  },

  async getSleepTimerRemaining(): Promise<number> {
    return webPlayer.getSleepTimerRemaining();
  },

  // ── Preloading / caching ───────────────────────────────────────────────────

  async preloadTrack(
    url: string,
    headers: Record<string, string> = {}
  ): Promise<void> {
    return webPlayer.preloadTrack(url, headers);
  },

  async clearCache(): Promise<void> {
    return webPlayer.clearCache();
  },

  async getCacheSize(): Promise<number> {
    return webPlayer.getCacheSize();
  },

  // ── Getters ────────────────────────────────────────────────────────────────

  async getState(): Promise<State> {
    return webPlayer.getState();
  },

  async getProgress(): Promise<Progress> {
    return webPlayer.getProgress();
  },

  async getRate(): Promise<number> {
    return webPlayer.getRate();
  },

  async getVolume(): Promise<number> {
    return webPlayer.getVolume();
  },

  async getRepeatMode(): Promise<RepeatMode> {
    return webPlayer.getRepeatMode();
  },

  async getShuffle(): Promise<boolean> {
    return webPlayer.getShuffle();
  },

  async getQueue(): Promise<Track[]> {
    return webPlayer.getQueue();
  },

  async getActiveTrackIndex(): Promise<number | null> {
    const idx = webPlayer.getActiveTrackIndex();
    return idx === -1 ? null : idx;
  },

  async getActiveTrack(): Promise<Track | null> {
    return webPlayer.getActiveTrack();
  },

  async getTrackAt(index: number): Promise<Track | null> {
    const queue = await InoPlayer.getQueue();
    return queue[index] ?? null;
  },

  // ── Cast ───────────────────────────────────────────────────────────────────

  async getCastState(): Promise<CastStateInfo> {
    return webPlayer.getCastState();
  },

  async showAirPlayPicker(): Promise<void> {
    webPlayer.showAirPlayPicker();
  },

  async showCastDialog(): Promise<void> {
    webPlayer.showCastDialog();
  },

  // ── Car browse ─────────────────────────────────────────────────────────────

  setCarBrowseTreeLoader(loader: CarBrowseTreeLoader | null): void {
    webPlayer.setCarBrowseTreeLoader(loader);
  },
};

// ── Utility ──────────────────────────────────────────────────────────────────

export { isPlatformSupported };
export { State, RepeatMode, CastState, Capability, Event };
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
};
