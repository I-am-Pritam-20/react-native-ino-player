/**
 * src/player.ts
 * Native platform InoPlayer API — Android, iOS, Mac Catalyst, Windows.
 * Web uses src/player.web.ts (Metro platform resolution).
 */

import NativeInoPlayer from '../specs/NativeInoPlayer';
import { assertPlatformSupported } from './platformGuard';
import type {
  Track, PlayerOptions, UpdateOptions, Progress,
  CustomAction, SleepTimerConfig, CastStateInfo,
  CarMediaItem, CarBrowseTreeLoader,
} from './types';
import { State, RepeatMode, CastState, Capability, Event } from './types';
import { addEventListener } from './events';

// ─── Bridge converters ────────────────────────────────────────────────────────

function trackToBridge(t: Track) {
  return {
    id: t.id, url: t.url, title: t.title,
    artist: t.artist, album: t.album, artwork: t.artwork,
    duration: t.duration, contentType: t.contentType, localUri: t.localUri,
    type: t.type, pitchAlgorithm: t.pitchAlgorithm,
    headers: t.headers ? JSON.stringify(t.headers) : undefined,
    userInfoJson: t.userInfo ? JSON.stringify(t.userInfo) : undefined,
  };
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function bridgeToTrack(b: any): Track {
  return {
    id: b.id, url: b.url, title: b.title,
    artist: b.artist, album: b.album, artwork: b.artwork,
    duration: b.duration, contentType: b.contentType as 'audio' | 'video' | undefined,
    localUri: b.localUri, type: b.type,
    pitchAlgorithm: b.pitchAlgorithm as 'linear' | 'music' | 'voice' | undefined,
    headers: b.headers ? JSON.parse(b.headers) as Record<string, string> : undefined,
    userInfo: b.userInfoJson ? JSON.parse(b.userInfoJson) as Record<string, unknown> : undefined,
  };
}

function optsToBridge(o: PlayerOptions) {
  return {
    minBufferMs: o.minBufferMs, maxBufferMs: o.maxBufferMs,
    backBufferMs: o.backBufferMs, maxCacheSize: o.maxCacheSize,
    preloadWindowSize: o.preloadWindowSize, backgroundAudio: o.backgroundAudio,
    handleAudioBecomingNoisy: o.handleAudioBecomingNoisy,
    androidNotificationChannelName: o.android?.notificationChannelName,
    androidWakeMode: o.android?.wakeMode, androidSmallIcon: o.android?.smallIcon,
    iosAudioCategory: o.ios?.audioCategory, iosAudioMode: o.ios?.audioMode,
  };
}

function updateOptsToBridge(o: UpdateOptions) {
  return {
    capabilitiesJson: JSON.stringify(o.capabilities ?? []),
    compactCapabilitiesJson: o.compactCapabilities ? JSON.stringify(o.compactCapabilities) : undefined,
    notificationCapabilitiesJson: o.notificationCapabilities ? JSON.stringify(o.notificationCapabilities) : undefined,
    progressUpdateEventInterval: o.progressUpdateEventInterval,
    jumpForwardInterval: o.jumpForwardInterval,
    jumpBackwardInterval: o.jumpBackwardInterval,
    customActionsJson: o.customActions
      ? JSON.stringify(o.customActions.map(a => ({ ...a, showIn: a.showIn ?? 'both' })))
      : undefined,
  };
}

// ─── Car browse ───────────────────────────────────────────────────────────────

let _carLoader: CarBrowseTreeLoader | null = null;
let _carListenerActive = false;

function ensureCarListener(): void {
  if (_carListenerActive) return;
  _carListenerActive = true;
  addEventListener(Event.CarBrowseItemSelected, async ({ id, parentId }) => {
    if (!_carLoader) return;
    try {
      const items = await _carLoader(parentId);
      await NativeInoPlayer.provideCarBrowseItems(id, items.map(item => ({
        id: item.id, title: item.title, subtitle: item.subtitle,
        artworkUri: item.artworkUri, playable: item.playable, browsable: item.browsable,
      })));
    } catch (e) { console.warn('[InoPlayer] CarBrowseTreeLoader error:', e); }
  });
}

// ─── Public API ───────────────────────────────────────────────────────────────

export const InoPlayer = {

  async setupPlayer(options: PlayerOptions = {}): Promise<void> {
    assertPlatformSupported('setupPlayer');
    await NativeInoPlayer.setupPlayer(optsToBridge(options));
    ensureCarListener();
  },

  async destroy(): Promise<void> {
    assertPlatformSupported('destroy');
    return NativeInoPlayer.destroy();
  },

  async updateOptions(options: UpdateOptions): Promise<void> {
    return NativeInoPlayer.updateOptions(updateOptsToBridge(options));
  },

  async setCustomActions(actions: CustomAction[]): Promise<void> {
    return NativeInoPlayer.setCustomActions(
      actions.map(a => ({ id: a.id, title: a.title, icon: a.icon, showIn: a.showIn ?? 'both' }))
    );
  },

  // Queue
  async setQueue(tracks: Track[], initialIndex = 0): Promise<void> {
    return NativeInoPlayer.setQueue(tracks.map(trackToBridge), initialIndex);
  },

  async add(tracks: Track | Track[], insertBeforeIndex = -1): Promise<void> {
    const arr = Array.isArray(tracks) ? tracks : [tracks];
    return NativeInoPlayer.add(arr.map(trackToBridge), insertBeforeIndex);
  },

  async remove(index: number): Promise<void> { return NativeInoPlayer.remove(index); },

  async move(fromIndex: number, toIndex: number): Promise<void> {
    return NativeInoPlayer.move(fromIndex, toIndex);
  },

  async updateMetadataForTrack(index: number, metadata: Partial<Omit<Track, 'id'>>): Promise<void> {
    const existing = await InoPlayer.getTrackAt(index);
    if (!existing) throw new Error(`[InoPlayer] No track at index ${index}`);
    return NativeInoPlayer.updateMetadataForTrack(index, trackToBridge({ ...existing, ...metadata }));
  },

  async clearQueue(): Promise<void> { return NativeInoPlayer.clearQueue(); },

  // Navigation
  async skip(index: number, initialPosition = 0): Promise<void> {
    return NativeInoPlayer.skip(index, initialPosition);
  },

  async skipToNext(initialPosition = 0): Promise<void> {
    return NativeInoPlayer.skipToNext(initialPosition);
  },

  async skipToPrevious(initialPosition = 0): Promise<void> {
    return NativeInoPlayer.skipToPrevious(initialPosition);
  },

  async skipForward(seconds: number): Promise<void> { return NativeInoPlayer.seekBy(seconds); },
  async skipBackward(seconds: number): Promise<void> { return NativeInoPlayer.seekBy(-seconds); },

  // Transport
  async play(): Promise<void>   { return NativeInoPlayer.play(); },
  async pause(): Promise<void>  { return NativeInoPlayer.pause(); },
  async stop(): Promise<void>   { return NativeInoPlayer.stop(); },
  async seekTo(position: number): Promise<void> { return NativeInoPlayer.seekTo(position); },
  async seekBy(offset: number): Promise<void>   { return NativeInoPlayer.seekBy(offset); },
  async setRate(rate: number): Promise<void>    { return NativeInoPlayer.setRate(rate); },
  async setVolume(volume: number): Promise<void>{ return NativeInoPlayer.setVolume(volume); },

  async fadeVolumeTo(targetVolume: number, durationMs: number): Promise<void> {
    return NativeInoPlayer.fadeVolumeTo(targetVolume, durationMs);
  },

  // Mode
  async setRepeatMode(mode: RepeatMode): Promise<void> {
    return NativeInoPlayer.setRepeatMode(mode as string);
  },

  async setShuffle(enabled: boolean): Promise<void> { return NativeInoPlayer.setShuffle(enabled); },

  // Sleep timer
  async setSleepTimer(config: SleepTimerConfig = {}): Promise<void> {
    return NativeInoPlayer.setSleepTimer({
      duration: config.duration ?? -1, mode: config.mode ?? 'countdown',
      fadeOut: config.fadeOut ?? true, fadeDuration: config.fadeDuration ?? 10,
    });
  },

  async cancelSleepTimer(): Promise<void> { return NativeInoPlayer.cancelSleepTimer(); },
  async getSleepTimerRemaining(): Promise<number> { return NativeInoPlayer.getSleepTimerRemaining(); },

  // Cache
  async preloadTrack(url: string, headers: Record<string, string> = {}): Promise<void> {
    return NativeInoPlayer.preloadTrack(url, JSON.stringify(headers));
  },
  async clearCache(): Promise<void> { return NativeInoPlayer.clearCache(); },
  async getCacheSize(): Promise<number> { return NativeInoPlayer.getCacheSize(); },

  // Getters
  async getState(): Promise<State> { return (await NativeInoPlayer.getState()) as State; },
  async getProgress(): Promise<Progress> { return NativeInoPlayer.getProgress(); },
  async getRate(): Promise<number>   { return NativeInoPlayer.getRate(); },
  async getVolume(): Promise<number> { return NativeInoPlayer.getVolume(); },

  async getRepeatMode(): Promise<RepeatMode> {
    return (await NativeInoPlayer.getRepeatMode()) as RepeatMode;
  },

  async getShuffle(): Promise<boolean> { return NativeInoPlayer.getShuffle(); },

  async getQueue(): Promise<Track[]> {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    return ((await NativeInoPlayer.getQueue()) as any[]).map(bridgeToTrack);
  },

  async getActiveTrackIndex(): Promise<number | null> {
    const idx = await NativeInoPlayer.getActiveTrackIndex();
    return idx === -1 ? null : idx;
  },

  async getActiveTrack(): Promise<Track | null> {
    const raw = await NativeInoPlayer.getActiveTrack();
    return raw ? bridgeToTrack(raw) : null;
  },

  async getTrackAt(index: number): Promise<Track | null> {
    return (await InoPlayer.getQueue())[index] ?? null;
  },

  // Cast
  async getCastState(): Promise<CastStateInfo> {
    const raw = await NativeInoPlayer.getCastState();
    return { state: raw.state as CastState, deviceName: raw.deviceName };
  },
  async showAirPlayPicker(): Promise<void> { return NativeInoPlayer.showAirPlayPicker(); },
  async showCastDialog(): Promise<void>    { return NativeInoPlayer.showCastDialog(); },

  // Car
  setCarBrowseTreeLoader(loader: CarBrowseTreeLoader | null): void {
    _carLoader = loader;
  },
};

export { State, RepeatMode, CastState, Capability, Event };
export type {
  Track, PlayerOptions, UpdateOptions, Progress,
  CustomAction, SleepTimerConfig, CastStateInfo,
  CarMediaItem, CarBrowseTreeLoader,
};
