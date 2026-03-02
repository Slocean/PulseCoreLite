import type { UnlistenFn } from '@tauri-apps/api/event';

const isTauriRuntime = typeof window !== 'undefined' && '__TAURI_INTERNALS__' in window;

export async function tauriInvoke<T>(cmd: string, args?: Record<string, unknown>): Promise<T> {
  if (!isTauriRuntime) {
    throw new Error('Not running inside Tauri runtime.');
  }
  const { invoke } = await import('@tauri-apps/api/core');
  return invoke<T>(cmd, args);
}

export async function listenEvent<T>(event: string, handler: (payload: T) => void): Promise<UnlistenFn> {
  if (!isTauriRuntime) {
    return () => undefined;
  }
  const { listen } = await import('@tauri-apps/api/event');
  return listen<T>(event, e => handler(e.payload));
}

export function inTauri(): boolean {
  return isTauriRuntime;
}
