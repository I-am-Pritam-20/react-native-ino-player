/**
 * src/web/WebQueue.ts
 * In-memory queue manager for the web platform.
 * No bridge serialization needed — works with native TS Track objects.
 */

import type { Track } from '../types';

export class WebQueue {
  private _tracks: Track[] = [];

  get tracks(): ReadonlyArray<Track> {
    return this._tracks;
  }

  get size(): number {
    return this._tracks.length;
  }

  setQueue(tracks: Track[]): void {
    this._tracks = [...tracks];
  }

  add(tracks: Track[], insertBeforeIndex: number): void {
    const at =
      insertBeforeIndex < 0
        ? this._tracks.length
        : Math.min(insertBeforeIndex, this._tracks.length);
    this._tracks.splice(at, 0, ...tracks);
  }

  remove(index: number): void {
    if (index >= 0 && index < this._tracks.length) {
      this._tracks.splice(index, 1);
    }
  }

  move(fromIndex: number, toIndex: number): void {
    if (
      fromIndex < 0 ||
      fromIndex >= this._tracks.length ||
      toIndex < 0 ||
      toIndex >= this._tracks.length
    ) {
      return;
    }
    const [track] = this._tracks.splice(fromIndex, 1);
    this._tracks.splice(toIndex, 0, track);
  }

  updateAt(index: number, metadata: Partial<Track>): void {
    if (index >= 0 && index < this._tracks.length) {
      this._tracks[index] = { ...this._tracks[index], ...metadata };
    }
  }

  clear(): void {
    this._tracks = [];
  }

  getAt(index: number): Track | null {
    return this._tracks[index] ?? null;
  }

  indexOf(id: string): number {
    return this._tracks.findIndex(t => t.id === id);
  }
}
