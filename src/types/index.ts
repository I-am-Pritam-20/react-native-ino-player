/**
 * src/types/index.ts
 * All public TypeScript types for react-native-ino-player.
 * Used on all platforms: Android, iOS, Web, Windows, Mac Catalyst.
 */

// ─── Track ────────────────────────────────────────────────────────────────────

export interface Track {
  id: string;
  url: string;
  title: string;
  artist?: string;
  album?: string;
  artwork?: string;
  /** Duration in seconds. -1 = unknown. */
  duration?: number;
  /** @default 'audio' */
  contentType?: 'audio' | 'video';
  /** Local file URI for offline playback (takes priority over url). */
  localUri?: string;
  /** Explicit MIME type e.g. 'audio/mp4'. */
  type?: string;
  /** HTTP headers forwarded with every media request. */
  headers?: Record<string, string>;
  /** @default 'music' */
  pitchAlgorithm?: 'linear' | 'music' | 'voice';
  userInfo?: Record<string, unknown>;
}

// ─── State ───────────────────────────────────────────────────────────────────

export enum State {
  None = 'none',
  Ready = 'ready',
  Playing = 'playing',
  Paused = 'paused',
  Buffering = 'buffering',
  Loading = 'loading',
  Ended = 'ended',
  Error = 'error',
}

export interface PlaybackError {
  code: string;
  message: string;
}

export interface PlaybackStateEvent {
  state: State;
  error?: PlaybackError;
}

// ─── Progress ─────────────────────────────────────────────────────────────────

export interface Progress {
  position: number;
  duration: number;
  buffered: number;
}

// ─── Repeat mode ─────────────────────────────────────────────────────────────

export enum RepeatMode {
  Off = 'off',
  Track = 'track',
  TrackOnce = 'track-once',
  Queue = 'queue',
}

// ─── Capability ──────────────────────────────────────────────────────────────

export enum Capability {
  Play = 'play',
  Pause = 'pause',
  Stop = 'stop',
  SeekTo = 'seekTo',
  SkipToNext = 'skipToNext',
  SkipToPrevious = 'skipToPrevious',
  JumpForward = 'jumpForward',
  JumpBackward = 'jumpBackward',
  Shuffle = 'shuffle',
  Repeat = 'repeat',
}

// ─── Custom action ────────────────────────────────────────────────────────────

export interface CustomAction {
  id: string;
  title: string;
  /**
   * Android: drawable resource name.
   * iOS/Catalyst: SF Symbol name.
   * Web: ignored (no OS-level notification buttons on web).
   * Windows: ignored (SMTC has no custom buttons).
   */
  icon: string;
  /** @default 'both' */
  showIn?: 'notification' | 'lockscreen' | 'both';
}

// ─── Options ─────────────────────────────────────────────────────────────────

export interface PlayerOptions {
  minBufferMs?: number;
  maxBufferMs?: number;
  backBufferMs?: number;
  maxCacheSize?: number;
  preloadWindowSize?: number;
  backgroundAudio?: boolean;
  handleAudioBecomingNoisy?: boolean;
  android?: {
    notificationChannelName?: string;
    wakeMode?: 'none' | 'local' | 'network';
    smallIcon?: string;
  };
  ios?: {
    audioCategory?: 'playback' | 'ambient' | 'soloAmbient';
    audioMode?:
      | 'default'
      | 'moviePlayback'
      | 'spokenAudio'
      | 'voiceChat'
      | 'measurement'
      | 'videoChat'
      | 'videoRecording'
      | 'voicePrompt'
      | 'gameChat';
  };
}

export interface UpdateOptions {
  capabilities?: Capability[];
  compactCapabilities?: Capability[];
  notificationCapabilities?: Capability[];
  /** Seconds between PlaybackProgressUpdated events. @default 1 */
  progressUpdateEventInterval?: number;
  /** Jump forward seconds. @default 30 */
  jumpForwardInterval?: number;
  /** Jump backward seconds. @default 15 */
  jumpBackwardInterval?: number;
  customActions?: CustomAction[];
}

// ─── Sleep timer ─────────────────────────────────────────────────────────────

export interface SleepTimerConfig {
  duration?: number;
  mode?: 'countdown' | 'end-of-track';
  fadeOut?: boolean;
  fadeDuration?: number;
}

// ─── Cast ─────────────────────────────────────────────────────────────────────

export enum CastState {
  NoDevices = 'no_devices',
  NotConnected = 'not_connected',
  Connecting = 'connecting',
  Connected = 'connected',
}

export interface CastStateInfo {
  state: CastState;
  deviceName?: string;
}

// ─── Events ───────────────────────────────────────────────────────────────────

export enum Event {
  PlaybackState = 'playback-state',
  PlaybackError = 'playback-error',
  PlaybackActiveTrackChanged = 'playback-active-track-changed',
  PlaybackQueueEnded = 'playback-queue-ended',
  PlaybackProgressUpdated = 'playback-progress-updated',
  SleepTimerFired = 'sleep-timer-fired',
  SleepTimerTick = 'sleep-timer-tick',
  RemotePlay = 'remote-play',
  RemotePause = 'remote-pause',
  RemoteStop = 'remote-stop',
  RemoteNext = 'remote-next',
  RemotePrevious = 'remote-previous',
  RemoteSeek = 'remote-seek',
  RemoteJumpForward = 'remote-jump-forward',
  RemoteJumpBackward = 'remote-jump-backward',
  RemoteShuffle = 'remote-shuffle',
  RemoteRepeat = 'remote-repeat',
  RemoteCustomAction = 'remote-custom-action',
  CastStateChanged = 'cast-state-changed',
  CarBrowseItemSelected = 'car-browse-item-selected',
}

// ─── Car ──────────────────────────────────────────────────────────────────────

export interface CarMediaItem {
  id: string;
  title: string;
  subtitle?: string;
  artworkUri?: string;
  playable: boolean;
  browsable: boolean;
}

export type CarBrowseTreeLoader = (
  parentId: string | null
) => Promise<CarMediaItem[]>;
