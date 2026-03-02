<template>
  <UiCollapsiblePanel class="toolkit-card" :title="t('toolkit.countdownTitle')" :collapsible="false" title-class="toolkit-section-title">
    <div class="toolkit-grid toolkit-grid--3">
      <label class="toolkit-field">
        <span>{{ t('toolkit.hours') }}</span>
        <input
          v-model.number="countdownHours"
          type="number"
          min="0"
          max="999"
          @wheel="onNumberWheel($event, 'hours', 0, 999)" />
      </label>
      <label class="toolkit-field">
        <span>{{ t('toolkit.minutes') }}</span>
        <input
          v-model.number="countdownMinutes"
          type="number"
          min="0"
          max="59"
          @wheel="onNumberWheel($event, 'minutes', 0, 59)" />
      </label>
      <label class="toolkit-field">
        <span>{{ t('toolkit.seconds') }}</span>
        <input
          v-model.number="countdownSeconds"
          type="number"
          min="0"
          max="59"
          @wheel="onNumberWheel($event, 'seconds', 0, 59)" />
      </label>
    </div>
    <UiButton native-type="button" preset="overlay-primary" @click="scheduleCountdown">
      {{ t('toolkit.scheduleCountdown') }}
    </UiButton>
  </UiCollapsiblePanel>

  <UiCollapsiblePanel class="toolkit-card" :title="t('toolkit.datetimeTitle')" :collapsible="false" title-class="toolkit-section-title">
    <div class="toolkit-grid">
      <div class="toolkit-field">
        <span class="toolkit-field-label">{{ t('toolkit.datetime') }}</span>
        <div class="toolkit-datetime-row">
          <UiDateInput v-model="appointmentDate" :min="minAppointmentDate" />
          <UiTimeInput v-model="appointmentTime" />
        </div>
      </div>
      <label class="toolkit-field">
        <span>{{ t('toolkit.repeat') }}</span>
        <UiSelect v-model="repeatMode" :options="repeatOptions" />
      </label>
      <label v-if="repeatMode === 'weekly'" class="toolkit-field">
        <span>{{ t('toolkit.weekday') }}</span>
        <UiSelect v-model="weeklyDay" :options="weekdayOptions" />
      </label>
      <label v-if="repeatMode === 'monthly'" class="toolkit-field">
        <span>{{ t('toolkit.dayOfMonth') }}</span>
        <input v-model.number="monthlyDay" type="number" min="1" max="31" />
      </label>
    </div>
    <UiButton native-type="button" preset="overlay-primary" @click="scheduleByDatetime">
      {{ t('toolkit.scheduleDatetime') }}
    </UiButton>
  </UiCollapsiblePanel>

  <UiCollapsiblePanel class="toolkit-card" :title="t('toolkit.currentPlan')" :collapsible="false" title-class="toolkit-section-title">
    <p class="toolkit-plan" :class="{ 'toolkit-plan--muted': !plan }">
      {{ planText }}
    </p>
    <div class="toolkit-actions">
      <UiButton native-type="button" preset="overlay-danger" @click="cancelPlan">
        {{ t('toolkit.cancelPlan') }}
      </UiButton>
    </div>
  </UiCollapsiblePanel>

  <p v-if="statusMessage" class="toolkit-status">{{ statusMessage }}</p>
  <p v-if="errorMessage" class="toolkit-error">{{ errorMessage }}</p>
</template>

<script setup lang="ts">
import { computed, nextTick, onMounted, ref, watch } from 'vue';
import { useI18n } from 'vue-i18n';

import UiButton from '@/components/ui/Button';
import UiDateInput from '@/components/ui/DateInput';
import UiSelect from '@/components/ui/Select';
import UiCollapsiblePanel from '@/components/ui/CollapsiblePanel';
import UiTimeInput from '@/components/ui/TimeInput';
import { api, inTauri } from '../../services/tauri';
import type { ScheduleShutdownRequest, ShutdownPlan } from '../../types';

type RepeatMode = 'none' | 'daily' | 'weekly' | 'monthly';

const emit = defineEmits<{
  (event: 'contentChange'): void;
}>();

const { t } = useI18n();

const countdownHours = ref(0);
const countdownMinutes = ref(30);
const countdownSeconds = ref(0);
const initialAppointment = nextQuarterHourDate();
const appointmentDate = ref(formatDateLocal(initialAppointment));
const appointmentTime = ref(formatTimeLocal(initialAppointment));
const minAppointmentDate = formatDateLocal(new Date());
const repeatMode = ref<RepeatMode>('none');
const weeklyDay = ref(dayToWeekday(new Date()));
const monthlyDay = ref(new Date().getDate());
const plan = ref<ShutdownPlan | null>(null);
const statusMessage = ref('');
const errorMessage = ref('');

const weekdayOptions = computed(() => [
  { value: 1, label: t('toolkit.weekdayMon') },
  { value: 2, label: t('toolkit.weekdayTue') },
  { value: 3, label: t('toolkit.weekdayWed') },
  { value: 4, label: t('toolkit.weekdayThu') },
  { value: 5, label: t('toolkit.weekdayFri') },
  { value: 6, label: t('toolkit.weekdaySat') },
  { value: 7, label: t('toolkit.weekdaySun') }
]);

const repeatOptions = computed(() => [
  { value: 'none', label: t('toolkit.repeatNone') },
  { value: 'daily', label: t('toolkit.repeatDaily') },
  { value: 'weekly', label: t('toolkit.repeatWeekly') },
  { value: 'monthly', label: t('toolkit.repeatMonthly') }
]);

const planText = computed(() => {
  if (!plan.value) {
    return t('toolkit.currentPlanNone');
  }
  const current = plan.value;
  const localDate = current.executeAt ? formatLocalDate(current.executeAt) : null;
  if (current.mode === 'countdown') {
    return t('toolkit.planCountdown', { datetime: localDate ?? '-' });
  }
  if (current.mode === 'once') {
    return t('toolkit.planOnce', { datetime: localDate ?? '-' });
  }
  if (current.mode === 'daily') {
    return t('toolkit.planDaily', { time: current.time ?? '-' });
  }
  if (current.mode === 'weekly') {
    const weekday = weekdayOptions.value.find(item => item.value === current.weekday)?.label ?? '-';
    return t('toolkit.planWeekly', { weekday, time: current.time ?? '-' });
  }
  return t('toolkit.planMonthly', { day: String(current.dayOfMonth ?? '-'), time: current.time ?? '-' });
});

watch(
  [repeatMode, plan, statusMessage, errorMessage],
  () => {
    nextTick(() => emit('contentChange'));
  },
  { immediate: true }
);

watch([appointmentDate, appointmentTime], ([dateValue, timeValue]) => {
  const date = parseAppointment(dateValue, timeValue);
  if (!date) return;
  weeklyDay.value = dayToWeekday(date);
  monthlyDay.value = date.getDate();
});

onMounted(() => {
  void refreshPlan();
  nextTick(() => emit('contentChange'));
});

async function refreshPlan() {
  if (!inTauri()) {
    plan.value = null;
    return;
  }
  try {
    plan.value = await api.getShutdownPlan();
  } catch {
    errorMessage.value = t('toolkit.loadFailed');
  }
}

async function scheduleCountdown() {
  clearTips();
  if (!inTauri()) return;

  const totalSeconds =
    sanitizeNonNegative(countdownHours.value) * 3600 +
    sanitizeNonNegative(countdownMinutes.value) * 60 +
    sanitizeNonNegative(countdownSeconds.value);

  if (totalSeconds <= 0) {
    errorMessage.value = t('toolkit.invalidCountdown');
    return;
  }

  const request: ScheduleShutdownRequest = {
    mode: 'countdown',
    delaySeconds: totalSeconds
  };

  await submitSchedule(request);
}

async function scheduleByDatetime() {
  clearTips();
  if (!inTauri()) return;

  const date = parseAppointment(appointmentDate.value, appointmentTime.value);
  if (!date) {
    errorMessage.value = t('toolkit.invalidDatetime');
    return;
  }

  const hhmm = `${String(date.getHours()).padStart(2, '0')}:${String(date.getMinutes()).padStart(2, '0')}`;
  let request: ScheduleShutdownRequest | null = null;

  if (repeatMode.value === 'none') {
    if (date.getTime() <= Date.now()) {
      errorMessage.value = t('toolkit.datetimeMustFuture');
      return;
    }
    request = {
      mode: 'once',
      executeAt: date.toISOString()
    };
  } else if (repeatMode.value === 'daily') {
    request = {
      mode: 'daily',
      time: hhmm
    };
  } else if (repeatMode.value === 'weekly') {
    request = {
      mode: 'weekly',
      time: hhmm,
      weekday: Math.max(1, Math.min(7, Math.round(weeklyDay.value)))
    };
  } else {
    request = {
      mode: 'monthly',
      time: hhmm,
      dayOfMonth: Math.max(1, Math.min(31, Math.round(monthlyDay.value)))
    };
  }

  await submitSchedule(request);
}

async function cancelPlan() {
  clearTips();
  if (!inTauri()) return;

  try {
    await api.cancelShutdownSchedule();
    plan.value = null;
    statusMessage.value = t('toolkit.cancelSuccess');
  } catch {
    errorMessage.value = t('toolkit.cancelFailed');
  }
}

async function submitSchedule(request: ScheduleShutdownRequest) {
  try {
    plan.value = await api.scheduleShutdown(request);
    statusMessage.value = t('toolkit.scheduleSuccess');
  } catch (error) {
    const message = error instanceof Error && error.message ? error.message : t('toolkit.scheduleFailed');
    errorMessage.value = message;
  }
}

function onNumberWheel(event: WheelEvent, field: 'hours' | 'minutes' | 'seconds', min: number, max: number) {
  const el = event.currentTarget as HTMLInputElement | null;
  if (!el || document.activeElement !== el) {
    return;
  }
  event.preventDefault();
  const model = field === 'hours' ? countdownHours : field === 'minutes' ? countdownMinutes : countdownSeconds;
  const dir = event.deltaY > 0 ? -1 : 1;
  const current = sanitizeNonNegative(model.value);
  const next = Math.max(min, Math.min(max, current + dir));
  model.value = next;
}

function nextQuarterHourDate() {
  const now = new Date();
  now.setSeconds(0, 0);
  const nextMinute = Math.ceil((now.getMinutes() + 1) / 15) * 15;
  if (nextMinute >= 60) {
    now.setHours(now.getHours() + 1, 0, 0, 0);
  } else {
    now.setMinutes(nextMinute, 0, 0);
  }
  return now;
}

function formatDateLocal(date: Date) {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(
    2,
    '0'
  )}`;
}

function formatTimeLocal(date: Date) {
  return `${String(date.getHours()).padStart(2, '0')}:${String(date.getMinutes()).padStart(2, '0')}`;
}

function formatLocalDate(iso: string) {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) {
    return iso;
  }
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(
    2,
    '0'
  )} ${String(date.getHours()).padStart(2, '0')}:${String(date.getMinutes()).padStart(2, '0')}:${String(
    date.getSeconds()
  ).padStart(2, '0')}`;
}

function parseAppointment(dateValue: string, timeValue: string) {
  const dateMatch = dateValue.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  const timeMatch = timeValue.match(/^(\d{2}):(\d{2})$/);
  if (!dateMatch || !timeMatch) return null;

  const year = Number.parseInt(dateMatch[1], 10);
  const month = Number.parseInt(dateMatch[2], 10);
  const day = Number.parseInt(dateMatch[3], 10);
  const hour = Number.parseInt(timeMatch[1], 10);
  const minute = Number.parseInt(timeMatch[2], 10);
  if ([year, month, day, hour, minute].some(item => !Number.isFinite(item))) return null;

  const date = new Date(year, month - 1, day, hour, minute, 0, 0);
  if (
    date.getFullYear() !== year ||
    date.getMonth() !== month - 1 ||
    date.getDate() !== day ||
    date.getHours() !== hour ||
    date.getMinutes() !== minute
  ) {
    return null;
  }
  return date;
}

function dayToWeekday(date: Date) {
  const day = date.getDay();
  return day === 0 ? 7 : day;
}

function sanitizeNonNegative(value: number) {
  if (!Number.isFinite(value)) return 0;
  return Math.max(0, Math.round(value));
}

function clearTips() {
  statusMessage.value = '';
  errorMessage.value = '';
}
</script>

