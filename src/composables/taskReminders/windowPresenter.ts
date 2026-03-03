import { inTauri } from '../../services/tauri';
import { storageKeys, storageRepository } from '../../services/storageRepository';
import type { ReminderContentType, ReminderScreenEventPayload } from '../../types';
import { nowIso } from './scheduler';

const REMINDER_SCREEN_KEY_PREFIX = storageKeys.reminderScreenPrefix;

export function buildReminderScreenStorageKey(token: string) {
  return `${REMINDER_SCREEN_KEY_PREFIX}${token}`;
}

export function buildReminderCloseSignalKey(token: string) {
  return `${storageKeys.reminderClosePrefix}${token}`;
}

export async function openReminderScreensFromPayload(payload: ReminderScreenEventPayload) {
  if (!inTauri()) {
    return;
  }
  try {
    const [{ WebviewWindow, getAllWebviewWindows }, windowApi] = await Promise.all([
      import('@tauri-apps/api/webviewWindow'),
      import('@tauri-apps/api/window')
    ]);

    const existed = (await getAllWebviewWindows()).filter((win: { label: string }) =>
      win.label.startsWith('reminder-screen-')
    );

    const token = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
    const storagePayload = {
      token,
      title: payload.title ?? 'Task Reminder',
      content: payload.content ?? '',
      contentType: payload.contentType ?? 'text',
      timestamp: nowIso()
    };
    storageRepository.setJsonSync(buildReminderScreenStorageKey(token), storagePayload);

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
        backgroundColor: '#05070b',
        decorations: false,
        resizable: false,
        maximizable: false,
        minimizable: false,
        closable: true,
        alwaysOnTop: true,
        skipTaskbar: true,
        focus: index === 0,
        visible: false
      });
      newWindows.push(win);
    }

    await Promise.all(newWindows.map(win => win.once('tauri://created', async () => {
      await win.show();
    })));

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
