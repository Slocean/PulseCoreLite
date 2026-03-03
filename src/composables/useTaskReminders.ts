import { computed, ref } from 'vue';

import { api, inTauri } from '../services/tauri';
import type { SmtpEmailConfig, TaskReminder, TaskReminderStore } from '../types';
import { loadReminderStore, saveReminderStore } from './taskReminders/repository';
import {
  formatWeekday,
  hasAnySchedule,
  normalizeReminder,
  normalizeSmtpConfig,
  nowIso
} from './taskReminders/scheduler';
import {
  buildReminderCloseSignalKey,
  openReminderScreensFromPayload,
  readReminderScreenPayload
} from './taskReminders/windowPresenter';

const reminders = ref<TaskReminder[]>([]);
const loaded = ref(false);
const running = ref(true);
const smtpConfig = ref<SmtpEmailConfig | null>(null);

function toStorePayload(): TaskReminderStore {
  return {
    reminders: reminders.value,
    smtpConfig: smtpConfig.value
  };
}

export { buildReminderCloseSignalKey, formatWeekday, openReminderScreensFromPayload, readReminderScreenPayload };

export function useTaskReminders() {
  const reminderCount = computed(() => reminders.value.length);
  const enabledCount = computed(() => reminders.value.filter(item => item.enabled).length);

  async function load() {
    if (loaded.value) {
      return;
    }

    const store = await loadReminderStore();
    reminders.value = store.reminders;
    smtpConfig.value = store.smtpConfig;
    loaded.value = true;
  }

  async function persist() {
    const store = await saveReminderStore(toStorePayload());
    reminders.value = store.reminders;
    smtpConfig.value = store.smtpConfig;
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
    if (!item) {
      return;
    }
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
