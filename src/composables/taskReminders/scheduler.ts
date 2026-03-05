import type {
  MonthlyReminderSlot,
  ReminderChannel,
  ReminderContentType,
  ReminderAdvancedSettings,
  SmtpEmailConfig,
  TaskReminder,
  WeeklyReminderSlot
} from '../../types';

export function nowIso() {
  return new Date().toISOString();
}

export function normalizeSmtpConfig(input: SmtpEmailConfig | null | undefined): SmtpEmailConfig | null {
  if (!input) {
    return null;
  }
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

export function normalizeAdvancedSettings(
  input: Partial<ReminderAdvancedSettings> | null | undefined
): ReminderAdvancedSettings {
  return {
    backgroundType: input?.backgroundType || 'image',
    backgroundImage: (input?.backgroundImage ?? '').trim(),
    backgroundColor: (input?.backgroundColor ?? '').trim(),
    allowClose: input?.allowClose !== false,
    blockAllKeys: Boolean(input?.blockAllKeys),
    requireClosePassword: Boolean(input?.requireClosePassword),
    closePassword: input?.closePassword ?? ''
  };
}

function createId() {
  const random = Math.random().toString(36).slice(2, 10);
  return `rem-${Date.now()}-${random}`;
}

function normalizeTime(value: string) {
  const match = value.trim().match(/^(\d{1,2}):(\d{1,2})$/);
  if (!match) {
    return null;
  }
  const hour = Number(match[1]);
  const minute = Number(match[2]);
  if (!Number.isFinite(hour) || !Number.isFinite(minute)) {
    return null;
  }
  if (hour < 0 || hour > 23 || minute < 0 || minute > 59) {
    return null;
  }
  return `${String(hour).padStart(2, '0')}:${String(minute).padStart(2, '0')}`;
}

function normalizeWeeklySlots(slots: WeeklyReminderSlot[]) {
  const dedupe = new Set<string>();
  const result: WeeklyReminderSlot[] = [];
  for (const item of slots) {
    const weekday = Math.max(1, Math.min(7, Math.round(item.weekday)));
    const time = normalizeTime(item.time);
    if (!time) {
      continue;
    }
    const key = `${weekday}-${time}`;
    if (dedupe.has(key)) {
      continue;
    }
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
    if (!time) {
      continue;
    }
    const key = `${day}-${time}`;
    if (dedupe.has(key)) {
      continue;
    }
    dedupe.add(key);
    result.push({ day, time });
  }
  return result;
}

export function normalizeReminder(input: TaskReminder): TaskReminder {
  const normalizedChannel: ReminderChannel = input.channel === 'fullscreen' ? 'fullscreen' : 'email';
  const normalizedType: ReminderContentType = ['text', 'markdown', 'web', 'image'].includes(input.contentType)
    ? input.contentType
    : 'text';
  const dailyTimes = Array.from(
    new Set(
      (input.dailyTimes ?? []).map(item => normalizeTime(item)).filter((item): item is string => Boolean(item))
    )
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
    advancedSettings: normalizeAdvancedSettings(input.advancedSettings),
    createdAt: input.createdAt || nowIso(),
    updatedAt: nowIso()
  };
}

export function hasAnySchedule(reminder: TaskReminder) {
  return reminder.dailyTimes.length > 0 || reminder.weeklySlots.length > 0 || reminder.monthlySlots.length > 0;
}

export function formatWeekday(weekday: number) {
  const list = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];
  const idx = Math.max(1, Math.min(7, weekday)) - 1;
  return list[idx];
}
