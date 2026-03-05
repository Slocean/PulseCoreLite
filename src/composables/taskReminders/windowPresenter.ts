import { api, inTauri } from '../../services/tauri';
import { storageKeys, storageRepository } from '../../services/storageRepository';
import { emitSyncEvent } from '../../services/syncBus';
import type { ReminderContentType, ReminderScreenEventPayload } from '../../types';
import { nowIso } from './scheduler';

const REMINDER_SCREEN_KEY_PREFIX = storageKeys.reminderScreenPrefix;
const REMINDER_CLOSE_KEY_PREFIX = storageKeys.reminderClosePrefix;
let closeSignalListenerReady = false;

function cleanupStaleReminderStorage(maxAgeMinutes = 60) {
  if (typeof window === 'undefined') {
    return;
  }
  try {
    const cutoff = Date.now() - maxAgeMinutes * 60 * 1000;
    const keys: string[] = [];
    for (let i = 0; i < window.localStorage.length; i += 1) {
      const key = window.localStorage.key(i);
      if (key) keys.push(key);
    }
    for (const key of keys) {
      if (key.startsWith(REMINDER_SCREEN_KEY_PREFIX)) {
        const raw = window.localStorage.getItem(key);
        if (!raw) {
          window.localStorage.removeItem(key);
          continue;
        }
        try {
          const parsed = JSON.parse(raw) as { timestamp?: string };
          if (!parsed.timestamp || Date.parse(parsed.timestamp) < cutoff) {
            window.localStorage.removeItem(key);
          }
        } catch {
          window.localStorage.removeItem(key);
        }
      } else if (key.startsWith(REMINDER_CLOSE_KEY_PREFIX)) {
        window.localStorage.removeItem(key);
      }
    }
  } catch {
    // ignore cleanup failures
  }
}

export function buildReminderScreenStorageKey(token: string) {
  return `${REMINDER_SCREEN_KEY_PREFIX}${token}`;
}

export function buildReminderCloseSignalKey(token: string) {
  return `${REMINDER_CLOSE_KEY_PREFIX}${token}`;
}

function ensureCloseSignalCleanup() {
  if (closeSignalListenerReady || typeof window === 'undefined') {
    return;
  }
  closeSignalListenerReady = true;
  window.addEventListener('storage', event => {
    if (!event.key || !event.newValue) {
      return;
    }
    if (!event.key.startsWith(REMINDER_CLOSE_KEY_PREFIX)) {
      return;
    }
    // Delay cleanup so all reminder windows can react to the close signal first.
    window.setTimeout(() => {
      try {
        storageRepository.removeSync(event.key as string);
      } catch {
        // ignore
      }
    }, 1500);
  });
}

export async function openReminderScreensFromPayload(payload: ReminderScreenEventPayload) {
  if (!inTauri()) {
    return;
  }
  cleanupStaleReminderStorage();
  ensureCloseSignalCleanup();
  try {
    const [{ WebviewWindow, getAllWebviewWindows }, windowApi] = await Promise.all([
      import('@tauri-apps/api/webviewWindow'),
      import('@tauri-apps/api/window')
    ]);

    const existed = (await getAllWebviewWindows()).filter((win: { label: string }) =>
      win.label.startsWith('reminder-screen-')
    );

    const token = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
    const screenKey = buildReminderScreenStorageKey(token);
    const closeKey = buildReminderCloseSignalKey(token);
    const storagePayload = {
      token,
      title: payload.title ?? 'Task Reminder',
      content: payload.content ?? '',
      contentType: payload.contentType ?? 'text',
      advancedSettings: payload.advancedSettings,
      timestamp: nowIso()
    };
    storageRepository.setJsonSync(screenKey, storagePayload);

    const monitors = await windowApi.availableMonitors();
    const fallback = await windowApi.primaryMonitor();
    const targetMonitors = monitors && monitors.length > 0 ? monitors : fallback ? [fallback] : [];

    const logs = JSON.parse(localStorage.getItem('reminder_debug_logs') || '[]');
    targetMonitors.forEach((m, i) => {
      logs.push({
        time: new Date().toISOString(),
        action: `Monitor ${i}: pos(${m.position.x}, ${m.position.y}) size(${m.size.width}x${m.size.height}) scale(${m.scaleFactor})`
      });
    });
    localStorage.setItem('reminder_debug_logs', JSON.stringify(logs.slice(-20)));

    const newWindows = [];
    const backgroundColor = payload.advancedSettings?.backgroundColor || '#05070b';
    const activeState = { remaining: targetMonitors.length, cleaned: false };
    const finishCleanup = () => {
      if (activeState.cleaned) {
        return;
      }
      activeState.cleaned = true;
      try {
        storageRepository.removeSync(closeKey);
        storageRepository.removeSync(screenKey);
      } catch {
        // ignore
      }
      void emitSyncEvent('reminder://fullscreen', { active: false, token }, { labels: ['taskbar'] });
    };
    if (activeState.remaining <= 0) {
      finishCleanup();
      return;
    }
    void emitSyncEvent('reminder://fullscreen', { active: true, token }, { labels: ['taskbar'] });
    for (let index = 0; index < targetMonitors.length; index += 1) {
      const monitor = targetMonitors[index];
      const label = `reminder-screen-${token}-${index}`;

      const windowConfig = {
        x: Math.round(monitor.position.x / monitor.scaleFactor),
        y: Math.round(monitor.position.y / monitor.scaleFactor),
        width: Math.round(monitor.size.width / monitor.scaleFactor),
        height: Math.round(monitor.size.height / monitor.scaleFactor)
      };

      const logs2 = JSON.parse(localStorage.getItem('reminder_debug_logs') || '[]');
      logs2.push({
        time: new Date().toISOString(),
        action: `Window ${index}: x=${windowConfig.x} y=${windowConfig.y} w=${windowConfig.width} h=${windowConfig.height}`
      });
      localStorage.setItem('reminder_debug_logs', JSON.stringify(logs2.slice(-20)));

      const win = new WebviewWindow(label, {
        url: `toolkit.html?reminderScreen=1&token=${encodeURIComponent(token)}&idx=${index}`,
        title: `Reminder Screen ${index + 1}`,
        ...windowConfig,
        backgroundColor,
        decorations: false,
        transparent: false,
        resizable: false,
        maximizable: false,
        minimizable: false,
        closable: true,
        alwaysOnTop: true,
        skipTaskbar: true,
        focus: index === 0,
        visible: false,
        fullscreen: true
      });
      void win.listen('tauri://destroyed', () => {
        activeState.remaining = Math.max(0, activeState.remaining - 1);
        if (activeState.remaining === 0) {
          finishCleanup();
        }
      });
      newWindows.push(win);
    }

    await Promise.all(
      newWindows.map(win =>
        win.once('tauri://created', async () => {
          await win.show();
          try {
            await api.setWindowSystemTopmost(win.label, true);
          } catch {
            // ignore
          }
        })
      )
    );

    setTimeout(async () => {
      for (const win of existed) {
        try {
          await win.hide();
          await win.close();
        } catch {
          // ignore
        }
      }
    }, 200);
  } catch {
    // ignore
  }
}

export function readReminderScreenPayload(token: string | null) {
  if (!token || typeof window === 'undefined') {
    return null;
  }
  try {
    const raw = storageRepository.getJsonSync<{
      token: string;
      title: string;
      content: string;
      contentType: ReminderContentType;
      advancedSettings?: ReminderScreenEventPayload['advancedSettings'];
      timestamp: string;
    }>(buildReminderScreenStorageKey(token));
    if (!raw) {
      return null;
    }
    return raw;
  } catch {
    return null;
  }
}

