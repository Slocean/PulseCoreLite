import { computed, ref } from 'vue';

import { kvGet, kvSet } from '../utils/kv';
import { api, inTauri } from '../services/tauri';
import type {
  MonthlyReminderSlot,
  ReminderChannel,
  ReminderContentType,
  ReminderScreenEventPayload,
  SmtpEmailConfig,
  TaskReminder,
  TaskReminderStore,
  WeeklyReminderSlot
} from '../types';

const REMINDER_KEY = 'pulsecorelite.toolkit.task-reminders';
const SMTP_CONFIG_KEY = 'pulsecorelite.toolkit.smtp-email-config';
const REMINDER_SCREEN_KEY_PREFIX = 'pulsecorelite.reminder-screen.';

const reminders = ref<TaskReminder[]>([]);
const loaded = ref(false);
const running = ref(true);
const smtpConfig = ref<SmtpEmailConfig | null>(null);

function nowIso() {
  return new Date().toISOString();
}

function normalizeSmtpConfig(input: SmtpEmailConfig | null | undefined): SmtpEmailConfig | null {
  if (!input) return null;
  const port = Number.isFinite(input.port) ? Math.max(1, Math.min(65535, Math.round(input.port))) : 25;
  const security = input.security === 'tls' || input.security === 'starttls' ? input.security : 'none';
  return {
    host: (input.host ?? '').trim(),
    port,
    username: input.username ?? '',
    password: input.password ?? '',
    fromEmail: (input.fromEmail ?? '').trim(),
    fromName: input.fromName ?? '',
    security
  };
}

function createId() {
  const random = Math.random().toString(36).slice(2, 10);
  return `rem-${Date.now()}-${random}`;
}

function normalizeTime(value: string) {
  const match = value.trim().match(/^(\d{1,2}):(\d{1,2})$/);
  if (!match) return null;
  const hour = Number(match[1]);
  const minute = Number(match[2]);
  if (!Number.isFinite(hour) || !Number.isFinite(minute)) return null;
  if (hour < 0 || hour > 23 || minute < 0 || minute > 59) return null;
  return `${String(hour).padStart(2, '0')}:${String(minute).padStart(2, '0')}`;
}

function normalizeWeeklySlots(slots: WeeklyReminderSlot[]) {
  const dedupe = new Set<string>();
  const result: WeeklyReminderSlot[] = [];
  for (const item of slots) {
    const weekday = Math.max(1, Math.min(7, Math.round(item.weekday)));
    const time = normalizeTime(item.time);
    if (!time) continue;
    const key = `${weekday}-${time}`;
    if (dedupe.has(key)) continue;
    dedupe.add(key);
    result.push({ weekday, time });
  }
  return result;
}

function normalizeMonthlySlots(slots: MonthlyReminderSlot[]) {
  const dedupe = new Set<string>();
  const result: MonthlyReminderSlot[] = [];
  for (const item of slots) {
    const day = Math.max(1, Math.min(31, Math.round(item.day)));
    const time = normalizeTime(item.time);
    if (!time) continue;
    const key = `${day}-${time}`;
    if (dedupe.has(key)) continue;
    dedupe.add(key);
    result.push({ day, time });
  }
  return result;
}

function normalizeReminder(input: TaskReminder): TaskReminder {
  const normalizedChannel: ReminderChannel = input.channel === 'fullscreen' ? 'fullscreen' : 'email';
  const normalizedType: ReminderContentType = ['text', 'markdown', 'web', 'image'].includes(input.contentType)
    ? input.contentType
    : 'text';
  const dailyTimes = Array.from(
    new Set((input.dailyTimes ?? []).map(item => normalizeTime(item)).filter((item): item is string => Boolean(item)))
  );
  return {
    id: input.id || createId(),
    enabled: Boolean(input.enabled),
    title: (input.title ?? '').trim() || 'Untitled Reminder',
    channel: normalizedChannel,
    email: (input.email ?? '').trim(),
    dailyTimes,
    weeklySlots: normalizeWeeklySlots(input.weeklySlots ?? []),
    monthlySlots: normalizeMonthlySlots(input.monthlySlots ?? []),
    contentType: normalizedType,
    content: input.content ?? '',
    createdAt: input.createdAt || nowIso(),
    updatedAt: nowIso()
  };
}

function toStorePayload(): TaskReminderStore {
  return {
    reminders: reminders.value,
    smtpConfig: smtpConfig.value
  };
}

export function formatWeekday(weekday: number) {
  const list = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];
  const idx = Math.max(1, Math.min(7, weekday)) - 1;
  return list[idx];
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
  if (!token || typeof window === 'undefined') return null;
  try {
    const raw = window.localStorage.getItem(`${REMINDER_SCREEN_KEY_PREFIX}${token}`);
    if (!raw) return null;
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

export function useTaskReminders() {
  const reminderCount = computed(() => reminders.value.length);
  const enabledCount = computed(() => reminders.value.filter(item => item.enabled).length);

  async function load() {
    if (loaded.value) return;
    if (inTauri()) {
      const store = await api.getTaskReminderStore();
      reminders.value = Array.isArray(store.reminders) ? store.reminders.map(normalizeReminder) : [];
      smtpConfig.value = normalizeSmtpConfig(store.smtpConfig);
      loaded.value = true;
      return;
    }
    const saved = await kvGet<TaskReminder[]>(REMINDER_KEY);
    reminders.value = Array.isArray(saved) ? saved.map(normalizeReminder) : [];
    smtpConfig.value = normalizeSmtpConfig(await kvGet<SmtpEmailConfig>(SMTP_CONFIG_KEY));
    loaded.value = true;
  }

  async function persist() {
    if (inTauri()) {
      const store = await api.saveTaskReminderStore(toStorePayload());
      reminders.value = Array.isArray(store.reminders) ? store.reminders.map(normalizeReminder) : [];
      smtpConfig.value = normalizeSmtpConfig(store.smtpConfig);
      return;
    }
    await kvSet(REMINDER_KEY, reminders.value);
    await kvSet(SMTP_CONFIG_KEY, smtpConfig.value);
  }

  function hasAnySchedule(reminder: TaskReminder) {
    return reminder.dailyTimes.length > 0 || reminder.weeklySlots.length > 0 || reminder.monthlySlots.length > 0;
  }

  async function upsertReminder(input: TaskReminder) {
    const normalized = normalizeReminder(input);
    if (!hasAnySchedule(normalized)) {
      throw new Error('At least one schedule is required.');
    }
    if (normalized.channel === 'email' && !normalized.email.trim()) {
      throw new Error('Email is required for email reminder.');
    }

    const idx = reminders.value.findIndex(item => item.id === normalized.id);
    if (idx >= 0) {
      reminders.value.splice(idx, 1, { ...normalized, createdAt: reminders.value[idx].createdAt, updatedAt: nowIso() });
    } else {
      reminders.value.unshift(normalized);
    }
    await persist();
  }

  async function removeReminder(id: string) {
    reminders.value = reminders.value.filter(item => item.id !== id);
    await persist();
  }

  async function toggleReminderEnabled(id: string, enabled: boolean) {
    const item = reminders.value.find(entry => entry.id === id);
    if (!item) return;
    item.enabled = enabled;
    item.updatedAt = nowIso();
    await persist();
  }

  async function runReminderNow(reminder: TaskReminder) {
    const normalized = normalizeReminder(reminder);
    if (inTauri()) {
      await api.triggerTaskReminderNow(normalized);
      return;
    }
    if (normalized.channel === 'fullscreen') {
      await openReminderScreensFromPayload({
        title: normalized.title,
        content: normalized.content,
        contentType: normalized.contentType
      });
    }
  }

  async function saveSmtpConfig(config: SmtpEmailConfig) {
    const normalized = normalizeSmtpConfig(config);
    if (!normalized) {
      throw new Error('Invalid SMTP config.');
    }
    if (!normalized.host || !normalized.username || !normalized.password || !normalized.fromEmail) {
      throw new Error('SMTP config is incomplete.');
    }
    smtpConfig.value = normalized;
    await persist();
  }

  async function testSmtpConfig(config: SmtpEmailConfig, testTo?: string) {
    const normalized = normalizeSmtpConfig(config);
    if (!normalized) {
      throw new Error('Invalid SMTP config.');
    }
    if (!normalized.host || !normalized.username || !normalized.password || !normalized.fromEmail) {
      throw new Error('SMTP config is incomplete.');
    }
    const to = (testTo ?? '').trim() || normalized.fromEmail;
    await api.sendReminderEmail({
      smtp: normalized,
      to,
      subject: '[PulseCore] SMTP Test',
      body: 'This is a test email from PulseCore reminder module.'
    });
  }

  function stop() {
    running.value = false;
  }

  return {
    reminders,
    smtpConfig,
    reminderCount,
    enabledCount,
    loaded,
    running,
    load,
    stop,
    upsertReminder,
    removeReminder,
    toggleReminderEnabled,
    runReminderNow,
    saveSmtpConfig,
    testSmtpConfig,
    formatWeekday
  };
}
