import { api, inTauri } from '../../services/tauri';
import type { SmtpEmailConfig, TaskReminder, TaskReminderStore } from '../../types';
import { kvGet, kvSet } from '../../utils/kv';
import { normalizeReminder, normalizeSmtpConfig } from './scheduler';

export const REMINDER_KEY = 'pulsecorelite.toolkit.task-reminders';
export const SMTP_CONFIG_KEY = 'pulsecorelite.toolkit.smtp-email-config';

export async function loadReminderStore(): Promise<TaskReminderStore> {
  if (inTauri()) {
    const store = await api.getTaskReminderStore();
    return {
      reminders: Array.isArray(store.reminders) ? store.reminders.map(normalizeReminder) : [],
      smtpConfig: normalizeSmtpConfig(store.smtpConfig)
    };
  }

  const reminders = await kvGet<TaskReminder[]>(REMINDER_KEY);
  const smtpConfig = await kvGet<SmtpEmailConfig>(SMTP_CONFIG_KEY);
  return {
    reminders: Array.isArray(reminders) ? reminders.map(normalizeReminder) : [],
    smtpConfig: normalizeSmtpConfig(smtpConfig)
  };
}

export async function saveReminderStore(payload: TaskReminderStore): Promise<TaskReminderStore> {
  if (inTauri()) {
    const store = await api.saveTaskReminderStore(payload);
    return {
      reminders: Array.isArray(store.reminders) ? store.reminders.map(normalizeReminder) : [],
      smtpConfig: normalizeSmtpConfig(store.smtpConfig)
    };
  }

  await kvSet(REMINDER_KEY, payload.reminders);
  await kvSet(SMTP_CONFIG_KEY, payload.smtpConfig);
  return payload;
}
