import type { UnlistenFn } from '@tauri-apps/api/event';

const isTauriRuntime = typeof window !== 'undefined' && '__TAURI_INTERNALS__' in window;
const tauriCallbackStorageKey = 'pulsecorelite.tauri.pending-callbacks';
let tauriCallbackGuardReady = false;

function setupTauriCallbackGuard() {
  if (tauriCallbackGuardReady || !isTauriRuntime || !import.meta.env.DEV) return;
  tauriCallbackGuardReady = true;

  const windowRecord = window as unknown as Record<string, unknown>;
  const internals = (window as typeof window & {
    __TAURI_INTERNALS__?: {
      transformCallback?: (cb: (...args: unknown[]) => unknown, once?: boolean) => string;
    };
  }).__TAURI_INTERNALS__;
  const transformCallback = internals?.transformCallback;
  if (!internals || !transformCallback) return;

  const pendingCallbacks = new Set<string>();
  const registerNoopCallback = (id: string) => {
    const key = `_${id}`;
    if (key in windowRecord) return;
    windowRecord[key] = () => {
      delete windowRecord[key];
    };
  };

  try {
    const raw = sessionStorage.getItem(tauriCallbackStorageKey);
    if (raw) {
      const stored = JSON.parse(raw);
      if (Array.isArray(stored)) {
        stored.forEach(id => typeof id === 'string' && registerNoopCallback(id));
      }
    }
  } catch {
    // ignore malformed storage
  } finally {
    sessionStorage.removeItem(tauriCallbackStorageKey);
  }

  internals.transformCallback = (callback: (...args: unknown[]) => unknown, once = false) => {
    const id = transformCallback(callback, once);
    pendingCallbacks.add(id);
    const key = `_${id}`;
    const original = windowRecord[key];
    if (typeof original === 'function') {
      windowRecord[key] = (...args: unknown[]) => {
        pendingCallbacks.delete(id);
        return (original as (...inner: unknown[]) => unknown)(...args);
      };
    }
    return id;
  };

  const storePendingCallbacks = () => {
    if (!pendingCallbacks.size) return;
    try {
      sessionStorage.setItem(tauriCallbackStorageKey, JSON.stringify([...pendingCallbacks]));
    } catch {
      // ignore storage failures
    }
  };

  window.addEventListener('beforeunload', storePendingCallbacks);
  if (import.meta.hot) {
    import.meta.hot.on('vite:beforeFullReload', storePendingCallbacks);
  }
}

export async function tauriInvoke<T>(cmd: string, args?: Record<string, unknown>): Promise<T> {
  if (!isTauriRuntime) {
    throw new Error('Not running inside Tauri runtime.');
  }
  setupTauriCallbackGuard();
  const { invoke } = await import('@tauri-apps/api/core');
  return invoke<T>(cmd, args);
}

export async function listenEvent<T>(event: string, handler: (payload: T) => void): Promise<UnlistenFn> {
  if (!isTauriRuntime) {
    return () => undefined;
  }
  setupTauriCallbackGuard();
  const { listen } = await import('@tauri-apps/api/event');
  return listen<T>(event, e => handler(e.payload));
}

export function inTauri(): boolean {
  return isTauriRuntime;
}
