export { inTauri, listenEvent } from './tauri/core';
import { telemetryApi } from './tauri/telemetry';
import { systemApi } from './tauri/system';
import { windowApi } from './tauri/window';
import { shutdownApi } from './tauri/shutdown';
import { profileApi } from './tauri/profile';
import { reminderApi } from './tauri/reminder';
import { aiApi } from './tauri/ai';
import { gameSyncApi } from './tauri/gameSync';
import { investApi } from './tauri/invest';

export const tauriApi = {
  telemetry: telemetryApi,
  system: systemApi,
  window: windowApi,
  shutdown: shutdownApi,
  profile: profileApi,
  reminder: reminderApi,
  ai: aiApi,
  gameSync: gameSyncApi,
  invest: investApi
};

export const api = {
  ...telemetryApi,
  ...systemApi,
  ...windowApi,
  ...shutdownApi,
  ...profileApi,
  ...reminderApi,
  ...aiApi,
  ...gameSyncApi,
  ...investApi
};
