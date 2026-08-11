/**
 * src/web/webEventBus.ts
 *
 * Lightweight synchronous pub/sub bus used by the web implementation.
 * Mirrors the NativeEventEmitter contract so the same hooks work on web
 * without modification.
 */

type Listener = (payload: unknown) => void;

const _listeners = new Map<string, Set<Listener>>();

export const webEventBus = {
  emit(event: string, payload: unknown): void {
    const set = _listeners.get(event);
    if (!set) return;
    // Copy before iterating so removeListener inside a handler is safe
    [...set].forEach(l => l(payload));
  },

  addListener(event: string, listener: Listener): { remove: () => void } {
    if (!_listeners.has(event)) _listeners.set(event, new Set());
    _listeners.get(event)!.add(listener);
    return {
      remove: () => {
        _listeners.get(event)?.delete(listener);
        if (_listeners.get(event)?.size === 0) _listeners.delete(event);
      },
    };
  },

  /** Remove all listeners — useful for teardown in tests. */
  reset(): void {
    _listeners.clear();
  },
};
