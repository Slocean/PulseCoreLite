import { beforeEach, describe, expect, it, vi } from 'vitest';

import type { SmtpEmailConfig, TaskReminder } from '../types';

const REMINDER_KEY = 'pulsecorelite.toolkit.task-reminders';
const SMTP_CONFIG_KEY = 'pulsecorelite.toolkit.smtp-email-config';

const kvGetMock = vi.fn();
const kvSetMock = vi.fn();

vi.mock('../utils/kv', () => ({
  kvGet: kvGetMock,
  kvSet: kvSetMock
}));

vi.mock('../services/tauri', () => ({
  inTauri: () => false,
  api: {
    getTaskReminderStore: vi.fn(),
    saveTaskReminderStore: vi.fn(),
    triggerTaskReminderNow: vi.fn(),
    sendReminderEmail: vi.fn()
  }
}));

async function loadComposable() {
  const mod = await import('./useTaskReminders');
  return mod.useTaskReminders();
}

describe('useTaskReminders', () => {
  beforeEach(() => {
    vi.resetModules();
    kvGetMock.mockReset();
    kvSetMock.mockReset();
  });

  it('normalizes reminder/smtp payloads on load in non-tauri mode', async () => {
    const rawReminder = {
      id: 'r-1',
      enabled: true,
      title: '  Demo ',
      channel: 'email',
      email: ' hello@example.com ',
      dailyTimes: ['7:3', '07:03', '25:00', 'bad'],
      weeklySlots: [{ weekday: 8, time: '9:1' }, { weekday: 8, time: '9:1' }, { weekday: 0, time: '10:20' }],
      monthlySlots: [{ day: 32, time: '11:02' }, { day: 32, time: '11:02' }, { day: 0, time: '04:05' }],
      contentType: 'not-supported',
      content: 'x',
      createdAt: '2026-01-01T00:00:00.000Z',
      updatedAt: '2026-01-01T00:00:00.000Z'
    } as unknown as TaskReminder;

    const rawSmtp = {
      host: ' smtp.example.com ',
      port: 70000,
      username: 'u',
      password: 'p',
      fromEmail: ' sender@example.com ',
      fromName: 'Pulse',
      security: 'bad-mode'
    } as unknown as SmtpEmailConfig;

    kvGetMock.mockImplementation(async (key: string) => {
      if (key === REMINDER_KEY) return [rawReminder];
      if (key === SMTP_CONFIG_KEY) return rawSmtp;
      return undefined;
    });

    const remindersApi = await loadComposable();
    await remindersApi.load();

    expect(remindersApi.reminders.value).toHaveLength(1);
    expect(remindersApi.reminders.value[0].dailyTimes).toEqual(['07:03']);
    expect(remindersApi.reminders.value[0].weeklySlots).toEqual([{ weekday: 7, time: '09:01' }, { weekday: 1, time: '10:20' }]);
    expect(remindersApi.reminders.value[0].monthlySlots).toEqual([{ day: 31, time: '11:02' }, { day: 1, time: '04:05' }]);
    expect(remindersApi.reminders.value[0].contentType).toBe('text');
    expect(remindersApi.reminders.value[0].updatedAt).toBe('2026-01-01T00:00:00.000Z');

    expect(remindersApi.smtpConfig.value).toEqual({
      host: 'smtp.example.com',
      port: 65535,
      username: 'u',
      password: 'p',
      fromEmail: 'sender@example.com',
      fromName: 'Pulse',
      security: 'none'
    });
  });

  it('rejects invalid reminder input', async () => {
    kvGetMock.mockResolvedValue(undefined);
    const remindersApi = await loadComposable();
    await remindersApi.load();

    const baseReminder: TaskReminder = {
      id: 'r-2',
      enabled: true,
      title: 'Task',
      channel: 'email',
      email: '',
      dailyTimes: [],
      weeklySlots: [],
      monthlySlots: [],
      contentType: 'text',
      content: 'hello',
      createdAt: '2026-01-01T00:00:00.000Z',
      updatedAt: '2026-01-01T00:00:00.000Z'
    };

    await expect(remindersApi.upsertReminder(baseReminder)).rejects.toThrow('toolkit.reminderErrorNoSchedule');

    await expect(
      remindersApi.upsertReminder({
        ...baseReminder,
        dailyTimes: ['08:00']
      })
    ).rejects.toThrow('toolkit.reminderErrorEmailRequired');
  });

  it('persists updates when upserting/toggling/removing reminders', async () => {
    kvGetMock.mockResolvedValue(undefined);
    const remindersApi = await loadComposable();
    await remindersApi.load();

    const reminder: TaskReminder = {
      id: 'r-3',
      enabled: true,
      title: 'Task',
      channel: 'email',
      email: 'ok@example.com',
      dailyTimes: ['08:00'],
      weeklySlots: [],
      monthlySlots: [],
      contentType: 'text',
      content: 'hello',
      createdAt: '2026-01-01T00:00:00.000Z',
      updatedAt: '2026-01-01T00:00:00.000Z'
    };

    await remindersApi.upsertReminder(reminder);
    expect(remindersApi.reminders.value).toHaveLength(1);
    expect(kvSetMock).toHaveBeenCalledWith(REMINDER_KEY, expect.any(Array));
    expect(kvSetMock).toHaveBeenCalledWith(SMTP_CONFIG_KEY, null);

    await remindersApi.toggleReminderEnabled('r-3', false);
    expect(remindersApi.reminders.value[0].enabled).toBe(false);

    await remindersApi.removeReminder('r-3');
    expect(remindersApi.reminders.value).toHaveLength(0);
  });
});
