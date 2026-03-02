import type { UnlistenFn } from '@tauri-apps/api/event';
import type { WebviewOptions } from '@tauri-apps/api/webview';
import type { WindowOptions } from '@tauri-apps/api/window';

import { inTauri } from './tauri';

type WindowOpenResult = 'unavailable' | 'created' | 'focused';
type CreateWindowOptions = Omit<WebviewOptions, 'x' | 'y' | 'width' | 'height'> & WindowOptions;

let webviewWindowApiPromise: Promise<typeof import('@tauri-apps/api/webviewWindow')> | undefined;

async function getWebviewWindowApi() {
  if (!webviewWindowApiPromise) {
    webviewWindowApiPromise = import('@tauri-apps/api/webviewWindow');
  }
  return webviewWindowApiPromise;
}

export async function getWindowByLabel(label: string) {
  if (!inTauri()) {
    return null;
  }
  try {
    const { WebviewWindow } = await getWebviewWindowApi();
    return await WebviewWindow.getByLabel(label);
  } catch {
    return null;
  }
}

export async function showAndFocusWindow(label: string): Promise<boolean> {
  const win = await getWindowByLabel(label);
  if (!win) {
    return false;
  }
  try {
    await win.show();
  } catch {
    // ignore
  }
  try {
    await win.setFocus();
  } catch {
    // ignore
  }
  return true;
}

export async function closeWindow(label: string): Promise<boolean> {
  const win = await getWindowByLabel(label);
  if (!win) {
    return false;
  }
  try {
    await win.close();
    return true;
  } catch {
    return false;
  }
}

export async function ensureWindow(label: string, options: CreateWindowOptions): Promise<WindowOpenResult> {
  if (!inTauri()) {
    return 'unavailable';
  }
  const existing = await getWindowByLabel(label);
  if (existing) {
    await showAndFocusWindow(label);
    return 'focused';
  }
  const { WebviewWindow } = await getWebviewWindowApi();
  new WebviewWindow(label, options);
  return 'created';
}

export async function listenWindowDestroyed(
  label: string,
  handler: () => void
): Promise<UnlistenFn | null> {
  const win = await getWindowByLabel(label);
  if (!win) {
    return null;
  }
  try {
    return await win.listen('tauri://destroyed', () => handler());
  } catch {
    return null;
  }
}
