<template>
  <div class="toolkit-card">
    <UiButton native-type="button" preset="toolkit-collapse" @click="toggleSection('summary')">
      <span class="toolkit-section-title">{{ t('toolkit.reminderTitle') }}</span>
      <span class="toolkit-collapse-indicator material-symbols-outlined" :class="{ 'is-open': sections.summary }">
        expand_more
      </span>
    </UiButton>
    <div v-if="sections.summary" class="toolkit-reminder-count">
      <span>{{ t('toolkit.reminderSummary', { total: reminderCount, enabled: enabledCount }) }}</span>
    </div>
  </div>

  <div class="toolkit-card">
    <UiButton native-type="button" preset="toolkit-collapse" @click="toggleSection('task')">
      <span class="toolkit-section-title">{{ editingId ? t('toolkit.reminderEdit') : t('toolkit.reminderCreate') }}</span>
      <span class="toolkit-collapse-indicator material-symbols-outlined" :class="{ 'is-open': sections.task }">
        expand_more
      </span>
    </UiButton>
    <div v-if="sections.task" class="toolkit-actions">
      <UiButton native-type="button" preset="toolkit-link" @click="openSmtpDialog">
        {{ t('toolkit.reminderSmtpConfig') }}
      </UiButton>
    </div>
    <div v-if="sections.task" class="toolkit-grid">
      <label class="toolkit-field">
        <span>{{ t('toolkit.reminderTaskTitle') }}</span>
        <input v-model.trim="form.title" type="text" maxlength="80" />
      </label>
      <label class="toolkit-field">
        <span>{{ t('toolkit.reminderChannel') }}</span>
        <UiSelect v-model="form.channel" :options="channelOptions" />
      </label>
      <label v-if="form.channel === 'email'" class="toolkit-field">
        <span>{{ t('toolkit.reminderEmail') }}</span>
        <input v-model.trim="form.email" type="email" placeholder="name@example.com" />
      </label>
      <p v-if="form.channel === 'email'" class="toolkit-profile-hint">{{ t('toolkit.reminderEmailHint') }}</p>
      <div class="overlay-config-row">
        <span class="overlay-config-label">{{ t('toolkit.reminderEnabled') }}</span>
        <UiSwitch v-model="form.enabled" :aria-label="t('toolkit.reminderEnabled')" />
      </div>
    </div>
  </div>

  <div class="toolkit-card">
    <UiButton native-type="button" preset="toolkit-collapse" @click="toggleSection('schedule')">
      <span class="toolkit-section-title">{{ t('toolkit.reminderSchedule') }}</span>
      <span class="toolkit-collapse-indicator material-symbols-outlined" :class="{ 'is-open': sections.schedule }">
        expand_more
      </span>
    </UiButton>

    <div v-if="sections.schedule" class="toolkit-reminder-block">
      <div class="toolkit-reminder-subtitle">{{ t('toolkit.repeatDaily') }}</div>
      <div class="toolkit-reminder-inline">
        <UiTimeInput v-model="dailyInputTime" />
        <UiButton native-type="button" preset="overlay-primary" @click="addDailyTime">
          {{ t('toolkit.reminderAddTime') }}
        </UiButton>
      </div>
      <div class="toolkit-reminder-chip-list">
        <button
          v-for="time in form.dailyTimes"
          :key="`daily-${time}`"
          class="toolkit-reminder-chip"
          type="button"
          @click="removeDailyTime(time)">
          {{ time }} ×
        </button>
      </div>
    </div>

    <div v-if="sections.schedule" class="toolkit-reminder-block">
      <div class="toolkit-reminder-subtitle">{{ t('toolkit.repeatWeekly') }}</div>
      <div class="toolkit-reminder-inline toolkit-reminder-inline--weekly">
        <UiSelect v-model="weeklyInputDays" :options="weekdayOptions" multiple />
        <UiTimeInput v-model="weeklyInputTime" class="toolkit-reminder-time-input" />
        <UiButton native-type="button" preset="overlay-primary" @click="addWeeklySlot">
          {{ t('toolkit.reminderAddSlot') }}
        </UiButton>
      </div>
      <div class="toolkit-reminder-chip-list">
        <button
          v-for="slot in form.weeklySlots"
          :key="`weekly-${slot.weekday}-${slot.time}`"
          class="toolkit-reminder-chip"
          type="button"
          @click="removeWeeklySlot(slot.weekday, slot.time)">
          {{ formatWeekday(slot.weekday) }} {{ slot.time }} ×
        </button>
      </div>
    </div>

    <div v-if="sections.schedule" class="toolkit-reminder-block">
      <div class="toolkit-reminder-subtitle">{{ t('toolkit.repeatMonthly') }}</div>
      <div class="toolkit-reminder-inline toolkit-reminder-inline--triple">
        <input v-model.number="monthlyInputDay" type="number" min="1" max="31" />
        <UiTimeInput v-model="monthlyInputTime" />
        <UiButton native-type="button" preset="overlay-primary" @click="addMonthlySlot">
          {{ t('toolkit.reminderAddSlot') }}
        </UiButton>
      </div>
      <div class="toolkit-reminder-chip-list">
        <button
          v-for="slot in form.monthlySlots"
          :key="`monthly-${slot.day}-${slot.time}`"
          class="toolkit-reminder-chip"
          type="button"
          @click="removeMonthlySlot(slot.day, slot.time)">
          {{ t('toolkit.reminderDayOfMonth', { day: slot.day }) }} {{ slot.time }} ×
        </button>
      </div>
    </div>
  </div>

  <div class="toolkit-card">
    <UiButton native-type="button" preset="toolkit-collapse" @click="toggleSection('content')">
      <span class="toolkit-section-title">{{ t('toolkit.reminderContent') }}</span>
      <span class="toolkit-collapse-indicator material-symbols-outlined" :class="{ 'is-open': sections.content }">
        expand_more
      </span>
    </UiButton>
    <div v-if="sections.content" class="toolkit-grid">
      <label class="toolkit-field">
        <span>{{ t('toolkit.reminderContentType') }}</span>
        <UiSelect v-model="form.contentType" :options="contentTypeOptions" />
      </label>

      <label class="toolkit-field">
        <span>{{ t('toolkit.reminderContentValue') }}</span>
        <textarea v-if="form.contentType === 'text' || form.contentType === 'markdown'" v-model="form.content" rows="4" />
        <input v-else v-model.trim="form.content" type="text" />
      </label>
    </div>

    <div v-if="sections.content" class="toolkit-profile-actions">
      <UiButton native-type="button" preset="overlay-primary" @click="saveReminder">
        {{ t('toolkit.reminderSave') }}
      </UiButton>
      <UiButton native-type="button" preset="overlay-danger" @click="resetForm">
        {{ t('toolkit.reminderReset') }}
      </UiButton>
    </div>
  </div>

  <div class="toolkit-card">
    <UiButton native-type="button" preset="toolkit-collapse" @click="toggleSection('list')">
      <span class="toolkit-section-title">{{ t('toolkit.reminderList') }}</span>
      <span class="toolkit-collapse-indicator material-symbols-outlined" :class="{ 'is-open': sections.list }">
        expand_more
      </span>
    </UiButton>
    <div v-if="sections.list && !reminders.length" class="toolkit-plan toolkit-plan--muted">
      {{ t('toolkit.reminderListEmpty') }}
    </div>
    <div v-else-if="sections.list" class="toolkit-reminder-list">
      <div v-for="item in reminders" :key="item.id" class="toolkit-reminder-item">
        <div class="toolkit-reminder-item-header">
          <div class="toolkit-reminder-item-title">{{ item.title }}</div>
          <UiSwitch
            :model-value="item.enabled"
            :aria-label="t('toolkit.reminderEnabled')"
            @update:model-value="(value: boolean) => toggleReminderEnabled(item.id, value)" />
        </div>
        <div class="toolkit-reminder-item-meta">
          <span>{{ item.channel === 'email' ? t('toolkit.reminderChannelEmail') : t('toolkit.reminderChannelFullscreen') }}</span>
          <span v-if="item.channel === 'email'">{{ item.email }}</span>
        </div>
        <div class="toolkit-reminder-item-actions">
          <UiButton native-type="button" preset="toolkit-link" @click="editReminder(item)">
            {{ t('toolkit.reminderEditAction') }}
          </UiButton>
          <UiButton native-type="button" preset="toolkit-link" @click="triggerNow(item)">
            {{ t('toolkit.reminderTriggerNow') }}
          </UiButton>
          <UiButton native-type="button" preset="toolkit-link" @click="deleteReminder(item.id)">
            {{ t('toolkit.reminderDelete') }}
          </UiButton>
        </div>
      </div>
    </div>
  </div>

  <p v-if="statusMessage" class="toolkit-status">{{ statusMessage }}</p>
  <p v-if="errorMessage" class="toolkit-error">{{ errorMessage }}</p>

  <OverlayDialog
    v-model:open="smtpDialogOpen"
    :title="t('toolkit.reminderSmtpConfig')"
    :confirm-text="t('overlay.dialogConfirm')"
    :cancel-text="t('overlay.dialogCancel')"
    :close-label="t('overlay.dialogClose')"
    :autofocus-confirm="false"
    @confirm="saveSmtpSettings">
    <template #body>
      <div class="toolkit-grid">
        <label class="toolkit-field">
          <span>{{ t('toolkit.reminderSmtpHost') }}</span>
          <input v-model.trim="smtpForm.host" type="text" />
        </label>
        <label class="toolkit-field">
          <span>{{ t('toolkit.reminderSmtpPort') }}</span>
          <input v-model.number="smtpForm.port" type="number" min="1" max="65535" />
        </label>
        <label class="toolkit-field">
          <span>{{ t('toolkit.reminderSmtpSecurity') }}</span>
          <UiSelect v-model="smtpForm.security" :options="smtpSecurityOptions" />
        </label>
        <label class="toolkit-field">
          <span>{{ t('toolkit.reminderSmtpUsername') }}</span>
          <input v-model="smtpForm.username" type="text" />
        </label>
        <label class="toolkit-field">
          <span>{{ t('toolkit.reminderSmtpPassword') }}</span>
          <input v-model="smtpForm.password" type="password" />
        </label>
        <label class="toolkit-field">
          <span>{{ t('toolkit.reminderSmtpFromEmail') }}</span>
          <input v-model.trim="smtpForm.fromEmail" type="email" />
        </label>
        <label class="toolkit-field">
          <span>{{ t('toolkit.reminderSmtpFromName') }}</span>
          <input v-model="smtpForm.fromName" type="text" />
        </label>
        <label class="toolkit-field">
          <span>{{ t('toolkit.reminderSmtpTestTo') }}</span>
          <input v-model.trim="smtpTestTo" type="email" />
        </label>
        <div class="toolkit-actions">
          <UiButton native-type="button" preset="overlay-primary" @click="sendSmtpTestEmail">
            {{ t('toolkit.reminderSmtpSendTest') }}
          </UiButton>
        </div>
      </div>
    </template>
  </OverlayDialog>
</template>

<script setup lang="ts">
import { computed, nextTick, onMounted, reactive, ref, watch } from 'vue';
import { useI18n } from 'vue-i18n';

import UiButton from '@/components/ui/Button';
import UiSelect from '@/components/ui/Select';
import UiSwitch from '@/components/ui/Switch';
import UiTimeInput from '@/components/ui/TimeInput';
import OverlayDialog from '../OverlayDialog.vue';
import { useTaskReminders } from '../../composables/useTaskReminders';
import type { MonthlyReminderSlot, SmtpEmailConfig, TaskReminder, WeeklyReminderSlot } from '../../types';

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
  summary: true,
  task: true,
  schedule: true,
  content: true,
  list: true
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
const monthlyInputDay = ref(1);
const monthlyInputTime = ref('09:00');
const smtpTestTo = ref('');
const smtpForm = reactive<SmtpEmailConfig>({
  host: '',
  port: 587,
  username: '',
  password: '',
  fromEmail: '',
  fromName: '',
  security: 'starttls'
});

const weekdayOptions = computed(() => [
  { value: 1, label: t('toolkit.weekdayMon') },
  { value: 2, label: t('toolkit.weekdayTue') },
  { value: 3, label: t('toolkit.weekdayWed') },
  { value: 4, label: t('toolkit.weekdayThu') },
  { value: 5, label: t('toolkit.weekdayFri') },
  { value: 6, label: t('toolkit.weekdaySat') },
  { value: 7, label: t('toolkit.weekdaySun') }
]);

const channelOptions = computed(() => [
  { value: 'email', label: t('toolkit.reminderChannelEmail') },
  { value: 'fullscreen', label: t('toolkit.reminderChannelFullscreen') }
]);

const contentTypeOptions = computed(() => [
  { value: 'text', label: t('toolkit.reminderContentText') },
  { value: 'markdown', label: t('toolkit.reminderContentMarkdown') },
  { value: 'web', label: t('toolkit.reminderContentWeb') },
  { value: 'image', label: t('toolkit.reminderContentImage') }
]);

const smtpSecurityOptions = computed(() => [
  { value: 'none', label: t('toolkit.reminderSmtpSecurityNone') },
  { value: 'starttls', label: t('toolkit.reminderSmtpSecurityStarttls') },
  { value: 'tls', label: t('toolkit.reminderSmtpSecurityTls') }
]);

watch(
  [reminders, statusMessage, errorMessage, sections],
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

function toggleSection(key: 'summary' | 'task' | 'schedule' | 'content' | 'list') {
  sections[key] = !sections[key];
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
  const slot = { day: monthlyInputDay.value, time: monthlyInputTime.value };
  if (!slot.time) return;
  if (form.monthlySlots.some(item => item.day === slot.day && item.time === slot.time)) {
    return;
  }
  form.monthlySlots.push(slot);
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
  weeklyInputDays.value = [1];
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
  const editDays = [...new Set(item.weeklySlots.map(slot => slot.weekday))]
    .map(value => Math.round(value))
    .filter(value => value >= 1 && value <= 7)
    .sort((a, b) => a - b);
  weeklyInputDays.value = editDays.length ? editDays : [1];
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
