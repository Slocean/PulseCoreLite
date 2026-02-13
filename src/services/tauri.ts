import type { UnlistenFn } from "@tauri-apps/api/event";
import type { AppBootstrap } from "../types";

const isTauri = typeof window !== "undefined" && "__TAURI_INTERNALS__" in window;

async function tauriInvoke<T>(cmd: string, args?: Record<string, unknown>): Promise<T> {
  if (!isTauri) {
    throw new Error("Not running inside Tauri runtime.");
  }
  const { invoke } = await import("@tauri-apps/api/core");
  return invoke<T>(cmd, args);
}

export async function listenEvent<T>(event: string, handler: (payload: T) => void): Promise<UnlistenFn> {
  if (!isTauri) {
    return () => undefined;
  }
  const { listen } = await import("@tauri-apps/api/event");
  return listen<T>(event, (e) => handler(e.payload));
}

export function inTauri(): boolean {
  return isTauri;
}

export const api = {
  getInitialState: () => tauriInvoke<AppBootstrap>("get_initial_state"),
  toggleOverlay: (visible: boolean) => tauriInvoke<boolean>("toggle_overlay", { visible })
};
