/**
 * specs/NativeInoPlayer.ts
 * TurboModule Codegen specification.
 * Used by: Android (Kotlin/Java codegen), iOS (ObjC++ codegen),
 *          Windows (C++/WinRT — reads spec manually via REACT_METHOD macros).
 * NOT used by: Web (uses HTMLAudioElement directly, no native bridge).
 */

import type { TurboModule } from 'react-native';
import { TurboModuleRegistry } from 'react-native';

export type BridgeTrack = Readonly<{
  id: string;
  url: string;
  title: string;
  artist?: string;
  album?: string;
  artwork?: string;
  duration?: number;
  contentType?: string;
  localUri?: string;
  type?: string;
  headers?: string; // JSON-stringified Record<string,string>
  pitchAlgorithm?: string;
  userInfoJson?: string; // JSON-stringified Record<string,unknown>
}>;

export type BridgePlayerOptions = Readonly<{
  minBufferMs?: number;
  maxBufferMs?: number;
  backBufferMs?: number;
  maxCacheSize?: number;
  preloadWindowSize?: number;
  backgroundAudio?: boolean;
  handleAudioBecomingNoisy?: boolean;
  androidNotificationChannelName?: string;
  androidWakeMode?: string;
  androidSmallIcon?: string;
  iosAudioCategory?: string;
  iosAudioMode?: string;
}>;

export type BridgeUpdateOptions = Readonly<{
  capabilitiesJson: string;
  compactCapabilitiesJson?: string;
  notificationCapabilitiesJson?: string;
  progressUpdateEventInterval?: number;
  jumpForwardInterval?: number;
  jumpBackwardInterval?: number;
  customActionsJson?: string;
}>;

export type BridgeCustomAction = Readonly<{
  id: string;
  title: string;
  icon: string;
  showIn: string;
}>;

export type BridgeProgress = Readonly<{
  position: number;
  duration: number;
  buffered: number;
}>;

export type BridgeSleepTimer = Readonly<{
  duration: number;
  mode: string;
  fadeOut: boolean;
  fadeDuration: number;
}>;

export type BridgeCarItem = Readonly<{
  id: string;
  title: string;
  subtitle?: string;
  artworkUri?: string;
  playable: boolean;
  browsable: boolean;
}>;

export type BridgeCastState = Readonly<{
  state: string;
  deviceName?: string;
}>;

export interface Spec extends TurboModule {
  // RCTEventEmitter protocol
  addListener(eventName: string): void;
  removeListeners(count: number): void;

  // Lifecycle
  setupPlayer(options: BridgePlayerOptions): Promise<boolean>;
  destroy(): Promise<void>;
  updateOptions(options: BridgeUpdateOptions): Promise<void>;
  setCustomActions(actions: BridgeCustomAction[]): Promise<void>;

  // Queue
  setQueue(tracks: BridgeTrack[], initialIndex: number): Promise<void>;
  add(tracks: BridgeTrack[], insertBeforeIndex: number): Promise<void>;
  remove(index: number): Promise<void>;
  move(fromIndex: number, toIndex: number): Promise<void>;
  updateMetadataForTrack(index: number, metadata: BridgeTrack): Promise<void>;
  clearQueue(): Promise<void>;
  skip(index: number, initialPosition: number): Promise<void>;
  skipToNext(initialPosition: number): Promise<void>;
  skipToPrevious(initialPosition: number): Promise<void>;

  // Transport
  play(): Promise<void>;
  pause(): Promise<void>;
  stop(): Promise<void>;
  seekTo(position: number): Promise<void>;
  seekBy(offset: number): Promise<void>;
  setRate(rate: number): Promise<void>;
  setVolume(volume: number): Promise<void>;
  fadeVolumeTo(targetVolume: number, durationMs: number): Promise<void>;

  // Mode
  setRepeatMode(mode: string): Promise<void>;
  setShuffle(enabled: boolean): Promise<void>;

  // Sleep timer
  setSleepTimer(config: BridgeSleepTimer): Promise<void>;
  cancelSleepTimer(): Promise<void>;
  getSleepTimerRemaining(): Promise<number>;

  // Cache
  preloadTrack(url: string, headersJson: string): Promise<void>;
  clearCache(): Promise<void>;
  getCacheSize(): Promise<number>;

  // Getters
  getState(): Promise<string>;
  getProgress(): Promise<BridgeProgress>;
  getRate(): Promise<number>;
  getVolume(): Promise<number>;
  getRepeatMode(): Promise<string>;
  getShuffle(): Promise<boolean>;
  getQueue(): Promise<BridgeTrack[]>;
  getActiveTrackIndex(): Promise<number>;
  getActiveTrack(): Promise<BridgeTrack | null>;

  // Cast
  getCastState(): Promise<BridgeCastState>;
  showAirPlayPicker(): Promise<void>;
  showCastDialog(): Promise<void>;

  // Car
  provideCarBrowseItems(
    parentId: string,
    items: BridgeCarItem[]
  ): Promise<void>;
}

export default TurboModuleRegistry.getEnforcing<Spec>('RNInoPlayer');
