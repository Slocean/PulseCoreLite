import { inTauri } from '../../services/tauri';
import type { ReminderContentType, ReminderScreenEventPayload } from '../../types';
import { nowIso } from './scheduler';

const REMINDER_SCREEN_KEY_PREFIX = 'pulsecorelite.reminder-screen.';

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
    for (const win of existed) {
      try {
        await win.close();
      } catch {
        // ignore
      }
    }

    const token = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
    const storagePayload = {
      token,
      title: payload.title ?? 'Task Reminder',
      content: payload.content ?? '',
      contentType: payload.contentType ?? 'text',
      timestamp: nowIso()
    };
    window.localStorage.setItem(`${REMINDER_SCREEN_KEY_PREFIX}${token}`, JSON.stringify(storagePayload));

    const monitors = await windowApi.availableMonitors();
    const fallback = await windowApi.primaryMonitor();
    const targetMonitors = monitors.length > 0 ? monitors : fallback ? [fallback] : [];
    for (let index = 0; index < targetMonitors.length; index += 1) {
      const monitor = targetMonitors[index];
      const label = `reminder-screen-${token}-${index}`;
      new WebviewWindow(label, {
        url: `toolkit.html?reminderScreen=1&token=${encodeURIComponent(token)}&idx=${index}`,
        title: `Reminder Screen ${index + 1}`,
        x: monitor.position.x,
        y: monitor.position.y,
        width: monitor.size.width,
        height: monitor.size.height,
        decorations: false,
        resizable: false,
        maximizable: false,
        minimizable: false,
        closable: true,
        alwaysOnTop: true,
        skipTaskbar: true,
        focus: true,
        visible: true
      });
    }
  } catch {
    // ignore
  }
}

export function readReminderScreenPayload(token: string | null) {
  if (!token || typeof window === 'undefined') {
    return null;
  }
  try {
    const raw = window.localStorage.getItem(`${REMINDER_SCREEN_KEY_PREFIX}${token}`);
    if (!raw) {
      return null;
    }
    return JSON.parse(raw) as {
      token: string;
      title: string;
      content: string;
      contentType: ReminderContentType;
      timestamp: string;
    };
  } catch {
    return null;
  }
}
