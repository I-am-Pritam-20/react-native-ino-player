/**
 * src/web/WebPlayer.ts
 *
 * Full web implementation of the InoPlayer API.
 * Uses:
 *   • HTMLAudioElement / HTMLVideoElement   — playback engine
 *   • navigator.mediaSession               — browser lock-screen / media keys (Chrome, Safari, Firefox)
 *   • setTimeout / setInterval             — sleep timer, volume fade
 *   • fetch + Cache API / preload attr     — preloading & caching
 *
 * BROWSER COMPATIBILITY:
 *   Chrome 73+    ✅  MediaSession, AudioElement
 *   Firefox 82+   ✅  MediaSession, AudioElement
 *   Safari 14+    ✅  MediaSession, AirPlay automatic
 *   Edge 79+      ✅  MediaSession, AudioElement
 *   Safari iOS 14+ ✅ MediaSession, AirPlay via Control Center
 *
 * LIMITATIONS vs Native:
 *   • Background audio stops when tab is hidden (OS browser restriction).
 *     navigator.mediaSession keeps play/pause controls alive on lock screen.
 *   • No Android Auto / CarPlay / Chromecast from web context.
 *   • Cache is managed by browser (Cache API, not ExoPlayer SimpleCache).
 *   • No foreground service — audio stops if the tab is closed.
 *   • Wear OS / TV — not applicable in a browser context.
 *
 * AirPlay:
 *   Safari automatically enables AirPlay for <audio>/<video> elements.
 *   No extra code needed. Users access AirPlay via browser controls.
 */

import type {
  Track,
  PlayerOptions,
  UpdateOptions,
  Progress,
  SleepTimerConfig,
  CastStateInfo,
  CustomAction,
  CarMediaItem,
  CarBrowseTreeLoader,
} from '../types';
import { State, RepeatMode, CastState, Event } from '../types';
import { webEventBus } from './webEventBus';
import { WebQueue } from './WebQueue';

// ─── Helper: emit through the shared bus ─────────────────────────────────────

function emit(event: Event | string, payload: unknown = {}): void {
  webEventBus.emit(event, payload);
}

// ─── WebPlayer singleton ──────────────────────────────────────────────────────

export class WebPlayer {
  // ── Audio element ─────────────────────────────────────────────────────────
  private _el: HTMLAudioElement | null = null;
  private _preloadEls: Map<string, HTMLAudioElement> = new Map();

  // ── Queue ─────────────────────────────────────────────────────────────────
  private _queue = new WebQueue();
  private _currentIndex = 0;

  // ── Mode ──────────────────────────────────────────────────────────────────
  private _repeatMode: RepeatMode = RepeatMode.Off;
  private _shuffleEnabled = false;
  private _shuffledOrder: number[] = [];
  private _trackOnceFired = false;

  // ── State ─────────────────────────────────────────────────────────────────
  private _state: State = State.None;
  private _lastRate = 1;
  private _lastVolume = 1;

  // ── Progress polling ──────────────────────────────────────────────────────
  private _progressInterval = 1000;
  private _progressTimer: ReturnType<typeof setInterval> | null = null;

  // ── Sleep timer ───────────────────────────────────────────────────────────
  private _sleepTimer: ReturnType<typeof setInterval> | null = null;
  private _sleepRemaining = -1;
  private _sleepFadeOut = true;
  private _sleepFadeDuration = 10;
  private _sleepEndOfTrack = false;

  // ── Volume fade ───────────────────────────────────────────────────────────
  private _fadeTimer: ReturnType<typeof setInterval> | null = null;

  // ── Jump intervals ────────────────────────────────────────────────────────
  private _jumpForward = 30;
  private _jumpBackward = 15;

  // ── Preload window ────────────────────────────────────────────────────────
  private _preloadWindowSize = 3;

  // ─────────────────────────────────────────────────────────────────────────
  // Setup
  // ─────────────────────────────────────────────────────────────────────────

  async setupPlayer(options: PlayerOptions = {}): Promise<void> {
    this._preloadWindowSize = options.preloadWindowSize ?? 3;
    this._progressInterval  = (options as any).progressUpdateEventInterval
      ? (options as any).progressUpdateEventInterval * 1000
      : 1000;

    // Start progress polling
    this._startProgressTimer();

    // Set up browser MediaSession (lock-screen / media keys)
    this._setupMediaSession();

    this._setState(State.Ready);
  }

  async destroy(): Promise<void> {
    this._clearProgressTimer();
    this._cancelSleepTimerInternal();
    this._clearFadeTimer();
    this._destroyElement();
    this._preloadEls.forEach(el => { el.src = ''; el.load(); });
    this._preloadEls.clear();
    this._queue.clear();
    this._currentIndex = 0;
    this._setState(State.None);
    webEventBus.reset();
  }

  async updateOptions(options: UpdateOptions): Promise<void> {
    if (options.progressUpdateEventInterval !== undefined) {
      this._progressInterval = options.progressUpdateEventInterval * 1000;
      this._clearProgressTimer();
      this._startProgressTimer();
    }
    if (options.jumpForwardInterval !== undefined) this._jumpForward = options.jumpForwardInterval;
    if (options.jumpBackwardInterval !== undefined) this._jumpBackward = options.jumpBackwardInterval;
    this._setupMediaSession(); // Re-registers with updated intervals
  }

  async setCustomActions(_actions: CustomAction[]): Promise<void> {
    // Web: MediaSession has no concept of custom action buttons.
    // Custom actions are still fired as events when triggered from JS UI.
    // noop — the host app fires remote-custom-action events directly via JS.
  }

  // ─────────────────────────────────────────────────────────────────────────
  // Queue
  // ─────────────────────────────────────────────────────────────────────────

  async setQueue(tracks: Track[], initialIndex = 0): Promise<void> {
    this._destroyElement();
    this._queue.setQueue(tracks);
    this._currentIndex = Math.max(0, Math.min(initialIndex, tracks.length - 1));
    if (tracks.length > 0) {
      this._loadCurrentTrack();
      this._preloadUpcoming();
    }
  }

  async add(tracks: Track[], insertBeforeIndex = -1): Promise<void> {
    this._queue.add(tracks, insertBeforeIndex);
    this._preloadUpcoming();
  }

  async remove(index: number): Promise<void> {
    this._queue.remove(index);
    if (index === this._currentIndex) {
      this._loadCurrentTrack();
    } else if (index < this._currentIndex) {
      this._currentIndex = Math.max(0, this._currentIndex - 1);
    }
  }

  async move(fromIndex: number, toIndex: number): Promise<void> {
    this._queue.move(fromIndex, toIndex);
    // Adjust current index to follow the track that was playing
    if (fromIndex === this._currentIndex) {
      this._currentIndex = toIndex;
    } else if (fromIndex < this._currentIndex && toIndex >= this._currentIndex) {
      this._currentIndex--;
    } else if (fromIndex > this._currentIndex && toIndex <= this._currentIndex) {
      this._currentIndex++;
    }
  }

  async updateMetadataForTrack(index: number, metadata: Partial<Track>): Promise<void> {
    this._queue.updateAt(index, metadata);
    if (index === this._currentIndex) this._updateMediaSession();
  }

  async clearQueue(): Promise<void> {
    this._destroyElement();
    this._queue.clear();
    this._currentIndex = 0;
    this._cancelSleepTimerInternal();
  }

  // ─────────────────────────────────────────────────────────────────────────
  // Navigation
  // ─────────────────────────────────────────────────────────────────────────

  async skip(index: number, initialPosition = 0): Promise<void> {
    if (index < 0 || index >= this._queue.size) return;
    this._currentIndex = index;
    this._loadCurrentTrack(initialPosition);
  }

  async skipToNext(initialPosition = 0): Promise<void> {
    const next = this._nextIndex();
    if (next === null) return;
    this._currentIndex = next;
    this._loadCurrentTrack(initialPosition);
  }

  async skipToPrevious(initialPosition = 0): Promise<void> {
    const el = this._el;
    if (el && el.currentTime > 3 && initialPosition === 0) {
      el.currentTime = 0;
      return;
    }
    const prev = this._previousIndex();
    if (prev === null) return;
    this._currentIndex = prev;
    this._loadCurrentTrack(initialPosition);
  }

  async skipForward(seconds: number): Promise<void> {
    return this.seekBy(seconds);
  }

  async skipBackward(seconds: number): Promise<void> {
    return this.seekBy(-seconds);
  }

  // ─────────────────────────────────────────────────────────────────────────
  // Transport
  // ─────────────────────────────────────────────────────────────────────────

  async play(): Promise<void> {
    if (!this._el && this._queue.size > 0) this._loadCurrentTrack();
    if (!this._el) return;
    try {
      await this._el.play();
    } catch (e) {
      // Autoplay blocked — emit error for the host app to handle
      emit(Event.PlaybackError, {
        code: 'AUTOPLAY_BLOCKED',
        message: 'Browser autoplay policy blocked playback. A user gesture is required.',
      });
    }
  }

  async pause(): Promise<void> {
    this._el?.pause();
  }

  async stop(): Promise<void> {
    if (this._el) {
      this._el.pause();
      this._el.currentTime = 0;
    }
  }

  async seekTo(position: number): Promise<void> {
    if (this._el) this._el.currentTime = position;
  }

  async seekBy(offset: number): Promise<void> {
    if (!this._el) return;
    const newPos = Math.max(0, Math.min(
      this._el.currentTime + offset,
      this._el.duration || Infinity,
    ));
    this._el.currentTime = newPos;
  }

  async setRate(rate: number): Promise<void> {
    this._lastRate = rate;
    if (this._el) this._el.playbackRate = rate;
  }

  async setVolume(volume: number): Promise<void> {
    this._clearFadeTimer();
    this._lastVolume = Math.max(0, Math.min(1, volume));
    if (this._el) this._el.volume = this._lastVolume;
  }

  async fadeVolumeTo(targetVolume: number, durationMs: number): Promise<void> {
    this._clearFadeTimer();
    const start   = this._el?.volume ?? this._lastVolume;
    const target  = Math.max(0, Math.min(1, targetVolume));
    const delta   = target - start;
    const steps   = Math.max(1, Math.floor(durationMs / 50));
    let   step    = 0;

    this._fadeTimer = setInterval(() => {
      step++;
      const vol = Math.max(0, Math.min(1, start + delta * (step / steps)));
      if (this._el) this._el.volume = vol;
      this._lastVolume = vol;
      if (step >= steps) {
        this._clearFadeTimer();
        if (this._el) this._el.volume = target;
        this._lastVolume = target;
      }
    }, 50);
  }

  // ─────────────────────────────────────────────────────────────────────────
  // Mode
  // ─────────────────────────────────────────────────────────────────────────

  async setRepeatMode(mode: RepeatMode): Promise<void> {
    this._repeatMode = mode;
    this._trackOnceFired = false;
    if (this._el) {
      // Native loop attribute only for track — we handle queue/trackOnce manually
      this._el.loop = mode === RepeatMode.Track;
    }
    this._updateMediaSession();
  }

  async setShuffle(enabled: boolean): Promise<void> {
    this._shuffleEnabled = enabled;
    if (enabled) this._buildShuffleOrder();
    this._updateMediaSession();
  }

  // ─────────────────────────────────────────────────────────────────────────
  // Sleep timer
  // ─────────────────────────────────────────────────────────────────────────

  async setSleepTimer(config: SleepTimerConfig = {}): Promise<void> {
    this._cancelSleepTimerInternal();
    this._sleepFadeOut     = config.fadeOut ?? true;
    this._sleepFadeDuration = config.fadeDuration ?? 10;
    this._sleepEndOfTrack   = config.mode === 'end-of-track';

    if (this._sleepEndOfTrack) {
      this._sleepRemaining = -2; // sentinel
    } else {
      this._sleepRemaining = config.duration ?? 0;
      if (this._sleepRemaining <= 0) return;

      this._sleepTimer = setInterval(() => {
        this._sleepRemaining--;
        emit(Event.SleepTimerTick, { remaining: this._sleepRemaining });
        if (this._sleepRemaining <= 0) this._fireSleepTimer();
      }, 1000);
    }
  }

  async cancelSleepTimer(): Promise<void> {
    this._cancelSleepTimerInternal();
  }

  getSleepTimerRemaining(): number {
    return this._sleepRemaining;
  }

  // ─────────────────────────────────────────────────────────────────────────
  // Preloading / caching
  // ─────────────────────────────────────────────────────────────────────────

  /**
   * Preload a URL into the browser cache.
   * Uses the Cache API (Service Worker) when available, falls back to
   * creating a hidden <audio> element with preload="auto".
   */
  async preloadTrack(url: string, headers: Record<string, string> = {}): Promise<void> {
    // Strategy 1: Cache API (requires HTTPS + SW)
    if ('caches' in window) {
      try {
        const cache = await caches.open('ino-player-v1');
        const req   = new Request(url, { headers });
        const hit   = await cache.match(req);
        if (!hit) await cache.add(req);
        return;
      } catch {
        // Fall through to strategy 2
      }
    }

    // Strategy 2: Hidden <audio> with preload="auto"
    if (this._preloadEls.has(url)) return;
    const el = document.createElement('audio');
    el.preload = 'auto';
    el.src     = url;
    el.load();
    this._preloadEls.set(url, el);
  }

  async clearCache(): Promise<void> {
    if ('caches' in window) {
      try {
        await caches.delete('ino-player-v1');
      } catch { /* ignore */ }
    }
    this._preloadEls.forEach(el => { el.src = ''; el.load(); });
    this._preloadEls.clear();
  }

  async getCacheSize(): Promise<number> {
    if ('storage' in navigator && 'estimate' in navigator.storage) {
      const { usage } = await navigator.storage.estimate();
      return usage ?? 0;
    }
    return 0;
  }

  // ─────────────────────────────────────────────────────────────────────────
  // Getters
  // ─────────────────────────────────────────────────────────────────────────

  getState(): State {
    return this._state;
  }

  getProgress(): Progress {
    const el = this._el;
    if (!el) return { position: 0, duration: 0, buffered: 0 };

    let buffered = 0;
    if (el.buffered.length > 0) {
      // Find the buffered range that contains the current time
      for (let i = 0; i < el.buffered.length; i++) {
        if (el.buffered.start(i) <= el.currentTime &&
            el.currentTime <= el.buffered.end(i)) {
          buffered = el.buffered.end(i);
          break;
        }
      }
    }

    return {
      position: isNaN(el.currentTime) ? 0 : el.currentTime,
      duration: isNaN(el.duration) || !isFinite(el.duration) ? 0 : el.duration,
      buffered,
    };
  }

  getRate(): number {
    return this._el?.playbackRate ?? this._lastRate;
  }

  getVolume(): number {
    return this._el?.volume ?? this._lastVolume;
  }

  getRepeatMode(): RepeatMode {
    return this._repeatMode;
  }

  getShuffle(): boolean {
    return this._shuffleEnabled;
  }

  getQueue(): Track[] {
    return [...this._queue.tracks];
  }

  getActiveTrackIndex(): number {
    return this._queue.size === 0 ? -1 : this._currentIndex;
  }

  getActiveTrack(): Track | null {
    return this._queue.getAt(this._currentIndex);
  }

  getCastState(): CastStateInfo {
    // On web, AirPlay is handled transparently by Safari.
    // There's no API to query the AirPlay connection state programmatically.
    // Chromecast on web requires the Google Cast SDK (separate integration).
    return { state: CastState.NoDevices };
  }

  showAirPlayPicker(): void {
    // Safari exposes AirPlay via its built-in media controls.
    // There's no programmatic way to open the AirPlay picker from JS.
    // The user accesses AirPlay via the browser's native controls.
    console.warn('[InoPlayer Web] AirPlay picker must be opened via browser native controls on web.');
  }

  showCastDialog(): void {
    // Chromecast on web requires the Google Cast SDK.
    // Docs: https://developers.google.com/cast/docs/web_sender
    console.warn('[InoPlayer Web] Chromecast on web requires the Google Cast SDK. See docs/ARCHITECTURE.md.');
  }

  setCarBrowseTreeLoader(_loader: CarBrowseTreeLoader | null): void {
    // Car integration is not applicable on web — loader is intentionally ignored.
  }

  async provideCarBrowseItems(_parentId: string, _items: CarMediaItem[]): Promise<void> {
    // No-op on web
  }

  // ─────────────────────────────────────────────────────────────────────────
  // Internal: element lifecycle
  // ─────────────────────────────────────────────────────────────────────────

  private _loadCurrentTrack(initialPosition = 0): void {
    this._destroyElement();

    const track = this._queue.getAt(this._currentIndex);
    if (!track) return;

    // Use localUri (offline file) if available, else remote url
    const src = track.localUri ?? track.url;

    const el = document.createElement(
      track.contentType === 'video' ? 'video' : 'audio'
    ) as HTMLAudioElement;

    el.preload       = 'auto';
    el.src           = src;
    el.volume        = this._lastVolume;
    el.playbackRate  = this._lastRate;
    el.loop          = this._repeatMode === RepeatMode.Track;

    if (track.headers && Object.keys(track.headers).length > 0) {
      // Headers on media elements require a Service Worker or MSE;
      // for most CDN streams with token-in-URL this isn't needed.
      console.warn('[InoPlayer Web] HTTP headers on media elements are not directly supported by the browser. Use signed URLs or a Service Worker proxy instead.');
    }

    // ── Attach event listeners ──────────────────────────────────────────────
    el.addEventListener('playing',    () => this._setState(State.Playing));
    el.addEventListener('pause',      () => this._setState(State.Paused));
    el.addEventListener('waiting',    () => this._setState(State.Buffering));
    el.addEventListener('stalled',    () => this._setState(State.Buffering));
    el.addEventListener('canplay',    () => {
      if (this._state === State.Loading || this._state === State.Buffering) {
        this._setState(State.Paused);
      }
    });
    el.addEventListener('loadstart',  () => this._setState(State.Loading));
    el.addEventListener('error',      () => this._handleError(el));
    el.addEventListener('ended',      () => this._handleEnded());

    this._el = el as HTMLAudioElement;

    if (initialPosition > 0) {
      el.addEventListener('loadedmetadata', () => { el.currentTime = initialPosition; }, { once: true });
    }

    el.load();

    // Emit active track changed
    emit(Event.PlaybackActiveTrackChanged, {
      index: this._currentIndex,
      track,
      lastIndex: null,
      lastTrack: null,
      lastPosition: 0,
    });

    // Update browser MediaSession Now Playing
    this._updateMediaSession();

    // Start preloading upcoming tracks
    this._preloadUpcoming();
  }

  private _destroyElement(): void {
    if (this._el) {
      this._el.pause();
      this._el.src = '';
      this._el.load();
      this._el.remove();
      this._el = null;
    }
  }

  // ─────────────────────────────────────────────────────────────────────────
  // Internal: event handlers
  // ─────────────────────────────────────────────────────────────────────────

  private _handleError(el: HTMLAudioElement): void {
    const err = el.error;
    const code = err
      ? `MEDIA_ERR_${['', 'ABORTED', 'NETWORK', 'DECODE', 'SRC_NOT_SUPPORTED'][err.code]}`
      : 'UNKNOWN';
    const message = err?.message ?? 'Media playback error';

    this._setState(State.Error);
    emit(Event.PlaybackError, { code, message });
    emit(Event.PlaybackState, { state: State.Error, error: { code, message } });
  }

  private _handleEnded(): void {
    // End-of-track sleep timer sentinel
    if (this._sleepEndOfTrack || this._sleepRemaining === -2) {
      this._sleepEndOfTrack = false;
      this._sleepRemaining  = -1;
      this._fireSleepTimer();
      return;
    }

    switch (this._repeatMode) {
      case RepeatMode.Track:
        // Native `loop` handles this — ended should not fire when loop=true
        // but if it does, restart
        if (this._el) { this._el.currentTime = 0; this._el.play().catch(() => {}); }
        break;

      case RepeatMode.TrackOnce:
        if (!this._trackOnceFired) {
          this._trackOnceFired = true;
          if (this._el) { this._el.currentTime = 0; this._el.play().catch(() => {}); }
        } else {
          this._trackOnceFired = false;
          this._repeatMode     = RepeatMode.Off;
          this._advanceToNext();
        }
        break;

      case RepeatMode.Off:
        if (this._currentIndex === this._queue.size - 1) {
          this._setState(State.Ended);
          emit(Event.PlaybackQueueEnded, { index: this._currentIndex, position: this._el?.currentTime ?? 0 });
        } else {
          this._currentIndex++;
          this._loadCurrentTrack();
          this._el?.play().catch(() => {});
        }
        break;

      case RepeatMode.Queue:
        this._currentIndex = (this._currentIndex + 1) % this._queue.size;
        this._loadCurrentTrack();
        this._el?.play().catch(() => {});
        break;
    }
  }

  private _advanceToNext(): void {
    const next = this._nextIndex();
    if (next !== null) {
      this._currentIndex = next;
      this._loadCurrentTrack();
      this._el?.play().catch(() => {});
    } else {
      this._setState(State.Ended);
      emit(Event.PlaybackQueueEnded, { index: this._currentIndex, position: 0 });
    }
  }

  // ─────────────────────────────────────────────────────────────────────────
  // Internal: state management
  // ─────────────────────────────────────────────────────────────────────────

  private _setState(state: State): void {
    if (this._state === state) return;
    this._state = state;
    emit(Event.PlaybackState, { state });
  }

  // ─────────────────────────────────────────────────────────────────────────
  // Internal: shuffle / order
  // ─────────────────────────────────────────────────────────────────────────

  private _buildShuffleOrder(): void {
    const indices = Array.from({ length: this._queue.size }, (_, i) => i);
    // Fisher-Yates shuffle
    for (let i = indices.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      // noUncheckedIndexedAccess: both slots are in-bounds by loop invariant
      [indices[i], indices[j]] = [indices[j]!, indices[i]!];
    }
    // Ensure current track is first
    const pos = indices.indexOf(this._currentIndex);
    if (pos > 0) { [indices[0], indices[pos]] = [indices[pos]!, indices[0]!]; }
    this._shuffledOrder = indices;
  }

  private _playOrder(): number[] {
    if (this._shuffleEnabled) {
      if (this._shuffledOrder.length !== this._queue.size) this._buildShuffleOrder();
      return this._shuffledOrder;
    }
    return Array.from({ length: this._queue.size }, (_, i) => i);
  }

  private _nextIndex(): number | null {
    const order = this._playOrder();
    const pos   = order.indexOf(this._currentIndex);
    if (pos === -1) return null;
    const next  = pos + 1;
    if (next < order.length) return order[next]!;
    return this._repeatMode === RepeatMode.Queue ? order[0]! : null;
  }

  private _previousIndex(): number | null {
    const order = this._playOrder();
    const pos   = order.indexOf(this._currentIndex);
    if (pos === -1) return null;
    const prev  = pos - 1;
    if (prev >= 0) return order[prev]!;
    return this._repeatMode === RepeatMode.Queue ? order[order.length - 1]! : null;
  }

  // ─────────────────────────────────────────────────────────────────────────
  // Internal: preloading
  // ─────────────────────────────────────────────────────────────────────────

  private _preloadUpcoming(): void {
    const order   = this._playOrder();
    const pos     = order.indexOf(this._currentIndex);
    if (pos === -1) return;

    for (let i = 1; i <= this._preloadWindowSize; i++) {
      const nextPos = pos + i;
      if (nextPos >= order.length) break;
      const track   = this._queue.getAt(order[nextPos]!);
      if (!track) continue;
      const src = track.localUri ?? track.url;
      if (!this._preloadEls.has(src)) {
        const el    = document.createElement('audio');
        el.preload  = 'auto';
        el.src      = src;
        el.load();
        this._preloadEls.set(src, el);
      }
    }
  }

  // ─────────────────────────────────────────────────────────────────────────
  // Internal: progress timer
  // ─────────────────────────────────────────────────────────────────────────

  private _startProgressTimer(): void {
    this._clearProgressTimer();
    this._progressTimer = setInterval(() => {
      if (this._state !== State.Playing) return;
      const p = this.getProgress();
      emit(Event.PlaybackProgressUpdated, { ...p, track: this._currentIndex });
    }, this._progressInterval);
  }

  private _clearProgressTimer(): void {
    if (this._progressTimer !== null) { clearInterval(this._progressTimer); this._progressTimer = null; }
  }

  // ─────────────────────────────────────────────────────────────────────────
  // Internal: sleep timer
  // ─────────────────────────────────────────────────────────────────────────

  private _cancelSleepTimerInternal(): void {
    if (this._sleepTimer !== null) { clearInterval(this._sleepTimer); this._sleepTimer = null; }
    this._sleepRemaining  = -1;
    this._sleepEndOfTrack = false;
  }

  private _fireSleepTimer(): void {
    this._cancelSleepTimerInternal();
    if (this._sleepFadeOut) {
      this.fadeVolumeTo(0, this._sleepFadeDuration * 1000).then(() => {
        this._el?.pause();
        if (this._el) this._el.volume = 1;
        this._lastVolume = 1;
        emit(Event.SleepTimerFired, {});
      });
    } else {
      this._el?.pause();
      emit(Event.SleepTimerFired, {});
    }
  }

  // ─────────────────────────────────────────────────────────────────────────
  // Internal: fade timer
  // ─────────────────────────────────────────────────────────────────────────

  private _clearFadeTimer(): void {
    if (this._fadeTimer !== null) { clearInterval(this._fadeTimer); this._fadeTimer = null; }
  }

  // ─────────────────────────────────────────────────────────────────────────
  // Internal: Browser MediaSession API (lock screen / media keys)
  // ─────────────────────────────────────────────────────────────────────────

  private _setupMediaSession(): void {
    if (!('mediaSession' in navigator)) return;

    navigator.mediaSession.setActionHandler('play', () => {
      this.play();
      emit(Event.RemotePlay, {});
    });
    navigator.mediaSession.setActionHandler('pause', () => {
      this.pause();
      emit(Event.RemotePause, {});
    });
    navigator.mediaSession.setActionHandler('stop', () => {
      this.stop();
      emit(Event.RemoteStop, {});
    });
    navigator.mediaSession.setActionHandler('nexttrack', () => {
      this.skipToNext();
      emit(Event.RemoteNext, {});
    });
    navigator.mediaSession.setActionHandler('previoustrack', () => {
      this.skipToPrevious();
      emit(Event.RemotePrevious, {});
    });
    navigator.mediaSession.setActionHandler('seekto', detail => {
      if (detail.seekTime !== undefined) {
        this.seekTo(detail.seekTime);
        emit(Event.RemoteSeek, { position: detail.seekTime });
      }
    });

    // Skip intervals (available in Chrome 73+, Firefox 82+)
    try {
      navigator.mediaSession.setActionHandler('seekforward', () => {
        this.seekBy(this._jumpForward);
        emit(Event.RemoteJumpForward, { interval: this._jumpForward });
      });
      navigator.mediaSession.setActionHandler('seekbackward', () => {
        this.seekBy(-this._jumpBackward);
        emit(Event.RemoteJumpBackward, { interval: this._jumpBackward });
      });
    } catch { /* older browsers */ }
  }

  private _updateMediaSession(): void {
    if (!('mediaSession' in navigator)) return;

    const track = this._queue.getAt(this._currentIndex);
    if (!track) return;

    const metadata: MediaMetadataInit = {
      title:  track.title,
      artist: track.artist ?? '',
      album:  track.album  ?? '',
    };

    if (track.artwork) {
      metadata.artwork = [
        { src: track.artwork, sizes: '512x512', type: 'image/jpeg' },
        { src: track.artwork, sizes: '256x256', type: 'image/jpeg' },
      ];
    }

    navigator.mediaSession.metadata = new MediaMetadata(metadata);

    // Update playback state for lock screen
    navigator.mediaSession.playbackState =
      this._state === State.Playing ? 'playing' : 'paused';
  }
}

// ─── Singleton ─────────────────────────────────────────────────────────────

export const webPlayer = new WebPlayer();
