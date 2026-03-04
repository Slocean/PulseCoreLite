<template>
  <ReminderListPanel
    v-model="sections.list"
    :reminders="reminders"
    :title="reminderListTitle"
    :editing-id="editingId"
    @content-change="emit('contentChange')"
    @edit-reminder="editReminder"
    @trigger-now="triggerNow"
    @delete-reminder="deleteReminder"
    @toggle-enabled="toggleReminderEnabled" />

  <ReminderEditorPanels
    :editing-id="editingId"
    :form="form"
    :sections="sections"
    :daily-input-time="dailyInputTime"
    :weekly-input-days="weeklyInputDays"
    :weekly-input-time="weeklyInputTime"
    :monthly-input-days="monthlyInputDays"
    :monthly-input-time="monthlyInputTime"
    :channel-options="channelOptions"
    :weekday-options="weekdayOptions"
    :monthly-day-options="monthlyDayOptions"
    :content-type-options="contentTypeOptions"
    :format-weekday="formatWeekday"
    @content-change="emit('contentChange')"
    @open-smtp-dialog="openSmtpDialog"
    @add-daily-time="addDailyTime"
    @remove-daily-time="removeDailyTime"
    @add-weekly-slot="addWeeklySlot"
    @remove-weekly-slot="removeWeeklySlot"
    @add-monthly-slot="addMonthlySlot"
    @remove-monthly-slot="removeMonthlySlot"
    @update:daily-input-time="updateDailyInputTime"
    @update:weekly-input-days="updateWeeklyInputDays"
    @update:weekly-input-time="updateWeeklyInputTime"
    @update:monthly-input-days="updateMonthlyInputDays"
    @update:monthly-input-time="updateMonthlyInputTime" />

  <UiCollapsiblePanel
    class="toolkit-card"
    :title="t('toolkit.reminderAdvancedTitle')"
    v-model="sections.advanced"
    single-header-preset="toolkit-collapse"
    title-class="toolkit-section-title"
    indicator-class="toolkit-collapse-indicator"
    @toggle="emit('contentChange')">
    <div class="toolkit-grid">
      <label class="toolkit-field toolkit-field--inline">
        <span>{{ t('toolkit.reminderAdvancedImage') }}</span>
        <div class="toolkit-reminder-advanced-input">
          <input v-model.trim="advancedSettings.backgroundImage" type="text" />
          <input
            ref="advancedImageInput"
            class="toolkit-hidden-file"
            type="file"
            accept="image/*"
            @change="handleAdvancedImageChange" />
          <UiButton
            native-type="button"
            preset="overlay-primary"
            class="toolkit-reminder-advanced-upload"
            @click="triggerAdvancedImageSelect">
            {{ t('toolkit.reminderAdvancedUpload') }}
          </UiButton>
        </div>
      </label>
      <p class="toolkit-reminder-advanced-hint">{{ t('toolkit.reminderAdvancedUploadHint') }}</p>
      <label class="toolkit-field toolkit-field--inline">
        <span>{{ t('toolkit.reminderAdvancedColor') }}</span>
        <input v-model.trim="advancedSettings.backgroundColor" type="text" />
      </label>
      <div class="overlay-config-row">
        <span class="overlay-config-label">{{ t('toolkit.reminderAdvancedAllowClose') }}</span>
        <UiSwitch v-model="advancedSettings.allowClose" :aria-label="t('toolkit.reminderAdvancedAllowClose')" />
      </div>
      <div class="overlay-config-row">
        <span class="overlay-config-label">{{ t('toolkit.reminderAdvancedBlockButtons') }}</span>
        <UiSwitch v-model="advancedSettings.blockAllKeys" :aria-label="t('toolkit.reminderAdvancedBlockButtons')" />
      </div>
      <div class="overlay-config-row">
        <span class="overlay-config-label">{{ t('toolkit.reminderAdvancedRequirePassword') }}</span>
        <UiSwitch v-model="advancedSettings.requireClosePassword" :aria-label="t('toolkit.reminderAdvancedRequirePassword')" />
      </div>
      <label v-if="advancedSettings.requireClosePassword" class="toolkit-field">
        <span>{{ t('toolkit.reminderAdvancedClosePassword') }}</span>
        <input v-model.trim="advancedSettings.closePassword" type="password" />
      </label>
    </div>
  </UiCollapsiblePanel>

  <p v-if="statusMessage" class="toolkit-status">{{ statusMessage }}</p>
  <p v-if="errorMessage" class="toolkit-error">{{ errorMessage }}</p>

  <div class="toolkit-profile-actions">
    <UiButton native-type="button" preset="overlay-primary" @click="saveReminder">
      {{ t('toolkit.reminderSave') }}
    </UiButton>
    <UiButton native-type="button" preset="overlay-danger" @click="resetForm">
      {{ t('toolkit.reminderReset') }}
    </UiButton>
  </div>

  <ReminderSmtpDialog
    v-model:open="smtpDialogOpen"
    :smtp-form="smtpForm"
    :smtp-test-to="smtpTestTo"
    :smtp-security-options="smtpSecurityOptions"
    @update:smtp-test-to="updateSmtpTestTo"
    @save="saveSmtpSettings"
    @test="sendSmtpTestEmail" />
</template>

<script setup lang="ts">
import { computed, nextTick, onMounted, reactive, ref, watch } from 'vue';
import { useI18n } from 'vue-i18n';

import UiCollapsiblePanel from '@/components/ui/CollapsiblePanel';
import UiButton from '@/components/ui/Button';
import type { SelectOption } from '@/components/ui/Select/types';
import UiSwitch from '@/components/ui/Switch';
import { useTaskReminders } from '../../composables/useTaskReminders';
import ReminderEditorPanels from './reminder/ReminderEditorPanels.vue';
import ReminderListPanel from './reminder/ReminderListPanel.vue';
import ReminderSmtpDialog from './reminder/ReminderSmtpDialog.vue';
import type { MonthlyReminderSlot, ReminderAdvancedSettings, SmtpEmailConfig, TaskReminder, WeeklyReminderSlot } from '../../types';

const emit = defineEmits<{
  (event: 'contentChange'): void;
}>();

const { t } = useI18n();
const {
  reminders,
  smtpConfig,
  reminderCount,
  enabledCount,
  load,
  upsertReminder,
  removeReminder,
  toggleReminderEnabled,
  runReminderNow,
  saveSmtpConfig,
  testSmtpConfig,
  formatWeekday
} = useTaskReminders();

const editingId = ref<string | null>(null);
const smtpDialogOpen = ref(false);
const statusMessage = ref('');
const errorMessage = ref('');
const sections = reactive({
  task: true,
  schedule: true,
  content: true,
  list: false,
  advanced: false
});

const form = reactive({
  id: '',
  enabled: true,
  title: '',
  channel: 'fullscreen' as 'email' | 'fullscreen',
  email: '',
  dailyTimes: [] as string[],
  weeklySlots: [] as WeeklyReminderSlot[],
  monthlySlots: [] as MonthlyReminderSlot[],
  contentType: 'text' as 'text' | 'markdown' | 'web' | 'image',
  content: ''
});

const dailyInputTime = ref('09:00');
const weeklyInputDays = ref<number[]>([1]);
const weeklyInputTime = ref('09:00');
const monthlyInputDays = ref<number[]>([new Date().getDate()]);
const monthlyInputTime = ref('09:00');
const smtpTestTo = ref('');
const advancedImageInput = ref<HTMLInputElement | null>(null);
const smtpForm = reactive<SmtpEmailConfig>({
  host: '',
  port: 587,
  username: '',
  password: '',
  fromEmail: '',
  fromName: '',
  security: 'starttls'
});

const defaultAdvancedSettings = (): ReminderAdvancedSettings => ({
  backgroundImage: '',
  backgroundColor: '',
  allowClose: true,
  blockAllKeys: false,
  requireClosePassword: false,
  closePassword: ''
});

const advancedSettings = reactive<ReminderAdvancedSettings>(defaultAdvancedSettings());

const weekdayOptions = computed<SelectOption[]>(() => [
  { value: 1, label: t('toolkit.weekdayMon') },
  { value: 2, label: t('toolkit.weekdayTue') },
  { value: 3, label: t('toolkit.weekdayWed') },
  { value: 4, label: t('toolkit.weekdayThu') },
  { value: 5, label: t('toolkit.weekdayFri') },
  { value: 6, label: t('toolkit.weekdaySat') },
  { value: 7, label: t('toolkit.weekdaySun') }
]);

const channelOptions = computed<SelectOption[]>(() => [
  { value: 'email', label: t('toolkit.reminderChannelEmail') },
  { value: 'fullscreen', label: t('toolkit.reminderChannelFullscreen') }
]);

const contentTypeOptions = computed<SelectOption[]>(() => [
  { value: 'text', label: t('toolkit.reminderContentText') },
  { value: 'markdown', label: t('toolkit.reminderContentMarkdown') },
  { value: 'web', label: t('toolkit.reminderContentWeb') },
  { value: 'image', label: t('toolkit.reminderContentImage') }
]);

const smtpSecurityOptions = computed<SelectOption[]>(() => [
  { value: 'none', label: t('toolkit.reminderSmtpSecurityNone') },
  { value: 'starttls', label: t('toolkit.reminderSmtpSecurityStarttls') },
  { value: 'tls', label: t('toolkit.reminderSmtpSecurityTls') }
]);

const reminderListTitle = computed(() => {
  const summary = t('toolkit.reminderSummary', { total: reminderCount.value, enabled: enabledCount.value });
  return `${t('toolkit.reminderTitle')} · ${summary}`;
});

const monthlyDayOptions = computed<SelectOption[]>(() =>
  Array.from({ length: 31 }, (_, index) => {
    const day = index + 1;
    return {
      value: day,
      label: t('toolkit.reminderDayOfMonth', { day })
    };
  })
);

watch(
  [reminders, statusMessage, errorMessage, sections, advancedSettings],
  () => {
    nextTick(() => emit('contentChange'));
  },
  { deep: true, immediate: true }
);

onMounted(async () => {
  await load();
  if (smtpConfig.value) {
    Object.assign(smtpForm, smtpConfig.value);
    smtpTestTo.value = smtpConfig.value.fromEmail ?? '';
  }
  nextTick(() => emit('contentChange'));
});

function clearTip() {
  statusMessage.value = '';
  errorMessage.value = '';
}

function updateDailyInputTime(value: string) {
  dailyInputTime.value = value;
}

function updateWeeklyInputDays(value: number[]) {
  weeklyInputDays.value = value;
}

function updateWeeklyInputTime(value: string) {
  weeklyInputTime.value = value;
}

function updateMonthlyInputDays(value: number[]) {
  monthlyInputDays.value = value;
}

function updateMonthlyInputTime(value: string) {
  monthlyInputTime.value = value;
}

function updateSmtpTestTo(value: string) {
  smtpTestTo.value = value;
}

function triggerAdvancedImageSelect() {
  advancedImageInput.value?.click();
}

async function handleAdvancedImageChange(event: Event) {
  const input = event.target as HTMLInputElement | null;
  const file = input?.files?.[0];
  if (!file) {
    return;
  }
  if (!file.type.startsWith('image/')) {
    errorMessage.value = t('toolkit.reminderAdvancedUploadInvalid');
    return;
  }
  try {
    clearTip();
    const bitmap = await createImageBitmap(file);
    const maxSize = 1920;
    const scale = Math.min(1, maxSize / Math.max(bitmap.width, bitmap.height));
    const canvas = document.createElement('canvas');
    canvas.width = Math.max(1, Math.round(bitmap.width * scale));
    canvas.height = Math.max(1, Math.round(bitmap.height * scale));
    const ctx = canvas.getContext('2d');
    if (!ctx) {
      throw new Error('Canvas context unavailable');
    }
    ctx.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
    const blob: Blob =
      (await new Promise(resolve => canvas.toBlob(resolve, 'image/webp', 0.86))) ||
      (await new Promise(resolve => canvas.toBlob(resolve, 'image/png')));
    if (!blob) {
      throw new Error('Failed to encode image');
    }
    const dataUrl = await new Promise<string>((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(String(reader.result || ''));
      reader.onerror = () => reject(new Error('Failed to read image'));
      reader.readAsDataURL(blob);
    });
    advancedSettings.backgroundImage = dataUrl;
    statusMessage.value = t('toolkit.reminderAdvancedUploadSuccess');
  } catch (error) {
    errorMessage.value = error instanceof Error ? error.message : t('toolkit.reminderAdvancedUploadFailed');
  } finally {
    if (input) {
      input.value = '';
    }
  }
}

function addDailyTime() {
  clearTip();
  if (!dailyInputTime.value || form.dailyTimes.includes(dailyInputTime.value)) {
    return;
  }
  form.dailyTimes.push(dailyInputTime.value);
  form.dailyTimes.sort();
}

function removeDailyTime(time: string) {
  form.dailyTimes = form.dailyTimes.filter(item => item !== time);
}

function addWeeklySlot() {
  clearTip();
  if (!weeklyInputTime.value) return;
  const days = [...new Set(weeklyInputDays.value)]
    .map(value => Math.round(value))
    .filter(value => value >= 1 && value <= 7);
  if (!days.length) return;

  let changed = false;
  for (const weekday of days) {
    if (form.weeklySlots.some(item => item.weekday === weekday && item.time === weeklyInputTime.value)) {
      continue;
    }
    form.weeklySlots.push({ weekday, time: weeklyInputTime.value });
    changed = true;
  }
  if (!changed) return;
  form.weeklySlots.sort((a, b) => (a.weekday === b.weekday ? a.time.localeCompare(b.time) : a.weekday - b.weekday));
}

function removeWeeklySlot(weekday: number, time: string) {
  form.weeklySlots = form.weeklySlots.filter(item => !(item.weekday === weekday && item.time === time));
}

function addMonthlySlot() {
  clearTip();
  if (!monthlyInputTime.value) return;
  const days = [...new Set(monthlyInputDays.value)]
    .map(value => Math.round(value))
    .filter(value => value >= 1 && value <= 31);
  if (!days.length) return;

  let changed = false;
  for (const day of days) {
    if (form.monthlySlots.some(item => item.day === day && item.time === monthlyInputTime.value)) {
      continue;
    }
    form.monthlySlots.push({ day, time: monthlyInputTime.value });
    changed = true;
  }
  if (!changed) return;

  form.monthlySlots.sort((a, b) => (a.day === b.day ? a.time.localeCompare(b.time) : a.day - b.day));
}

function removeMonthlySlot(day: number, time: string) {
  form.monthlySlots = form.monthlySlots.filter(item => !(item.day === day && item.time === time));
}

function resetForm() {
  clearTip();
  editingId.value = null;
  form.id = '';
  form.enabled = true;
  form.title = '';
  form.channel = 'fullscreen';
  form.email = '';
  form.dailyTimes = [];
  form.weeklySlots = [];
  form.monthlySlots = [];
  form.contentType = 'text';
  form.content = '';
  Object.assign(advancedSettings, defaultAdvancedSettings());
  weeklyInputDays.value = [1];
  monthlyInputDays.value = [new Date().getDate()];
}

function openSmtpDialog() {
  clearTip();
  if (smtpConfig.value) {
    Object.assign(smtpForm, smtpConfig.value);
    smtpTestTo.value = smtpConfig.value.fromEmail ?? '';
  }
  smtpDialogOpen.value = true;
}

async function saveSmtpSettings() {
  clearTip();
  try {
    await saveSmtpConfig({ ...smtpForm });
    statusMessage.value = t('toolkit.reminderSmtpSaveSuccess');
  } catch (error) {
    errorMessage.value = error instanceof Error ? error.message : t('toolkit.reminderSmtpSaveFailed');
  }
}

async function sendSmtpTestEmail() {
  clearTip();
  try {
    await testSmtpConfig({ ...smtpForm }, smtpTestTo.value);
    statusMessage.value = t('toolkit.reminderSmtpTestSuccess');
  } catch (error) {
    errorMessage.value = error instanceof Error ? error.message : t('toolkit.reminderSmtpTestFailed');
  }
}

async function saveReminder() {
  clearTip();
  try {
    const payload: TaskReminder = {
      id: editingId.value ?? '',
      enabled: form.enabled,
      title: form.title,
      channel: form.channel,
      email: form.email,
      dailyTimes: [...form.dailyTimes],
      weeklySlots: [...form.weeklySlots],
      monthlySlots: [...form.monthlySlots],
      contentType: form.contentType,
      content: form.content,
      advancedSettings: { ...advancedSettings },
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    };
    await upsertReminder(payload);
    statusMessage.value = t('toolkit.reminderSaveSuccess');
    resetForm();
  } catch (error) {
    errorMessage.value = error instanceof Error ? error.message : t('toolkit.reminderSaveFailed');
  }
}

function editReminder(item: TaskReminder) {
  clearTip();
  editingId.value = item.id;
  form.id = item.id;
  form.enabled = item.enabled;
  form.title = item.title;
  form.channel = item.channel;
  form.email = item.email;
  form.dailyTimes = [...item.dailyTimes];
  form.weeklySlots = [...item.weeklySlots];
  form.monthlySlots = [...item.monthlySlots];
  form.contentType = item.contentType;
  form.content = item.content;
  Object.assign(advancedSettings, item.advancedSettings ?? defaultAdvancedSettings());
  const editDays = [...new Set(item.weeklySlots.map(slot => slot.weekday))]
    .map(value => Math.round(value))
    .filter(value => value >= 1 && value <= 7)
    .sort((a, b) => a - b);
  weeklyInputDays.value = editDays.length ? editDays : [1];
  const editMonthDays = [...new Set(item.monthlySlots.map(slot => slot.day))]
    .map(value => Math.round(value))
    .filter(value => value >= 1 && value <= 31)
    .sort((a, b) => a - b);
  monthlyInputDays.value = editMonthDays.length ? editMonthDays : [new Date().getDate()];
}

async function deleteReminder(id: string) {
  clearTip();
  await removeReminder(id);
  if (editingId.value === id) {
    resetForm();
  }
  statusMessage.value = t('toolkit.reminderDeleteSuccess');
}

async function triggerNow(item: TaskReminder) {
  clearTip();
  try {
    await runReminderNow(item);
    statusMessage.value = t('toolkit.reminderTriggerSuccess');
  } catch (error) {
    errorMessage.value = error instanceof Error ? error.message : t('toolkit.reminderTriggerFailed');
  }
}
</script>
