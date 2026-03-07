import { computed, nextTick, onMounted, ref, watch } from 'vue';

import { api, inTauri } from '../services/tauri';
import type { ScheduleShutdownRequest, ShutdownPlan } from '../types';

type RepeatMode = 'none' | 'daily' | 'weekly' | 'monthly';

type Translate = (key: string, params?: Record<string, unknown>) => string;

type UseToolkitShutdownFormOptions = {
  t: Translate;
  onContentChange: () => void;
};

export function useToolkitShutdownForm(options: UseToolkitShutdownFormOptions) {
  const { t, onContentChange } = options;
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
  const suspendDateSync = ref(false);

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
      nextTick(onContentChange);
    },
    { immediate: true }
  );

  watch([appointmentDate, appointmentTime], ([dateValue, timeValue]) => {
    if (suspendDateSync.value) {
      return;
    }
    const date = parseAppointment(dateValue, timeValue);
    if (!date) return;
    weeklyDay.value = dayToWeekday(date);
    monthlyDay.value = date.getDate();
  });

  onMounted(() => {
    void refreshPlan();
    nextTick(onContentChange);
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
    if (!inTauri()) return false;

    const totalSeconds =
      sanitizeNonNegative(countdownHours.value) * 3600 +
      sanitizeNonNegative(countdownMinutes.value) * 60 +
      sanitizeNonNegative(countdownSeconds.value);

    if (totalSeconds <= 0) {
      errorMessage.value = t('toolkit.invalidCountdown');
      return false;
    }

    return await submitSchedule({
      mode: 'countdown',
      delaySeconds: totalSeconds
    });
  }

  async function scheduleByDatetime() {
    clearTips();
    if (!inTauri()) return false;

    const date = parseAppointment(appointmentDate.value, appointmentTime.value);
    if (!date) {
      errorMessage.value = t('toolkit.invalidDatetime');
      return false;
    }

    const hhmm = `${String(date.getHours()).padStart(2, '0')}:${String(date.getMinutes()).padStart(2, '0')}`;
    let request: ScheduleShutdownRequest | null = null;

    if (repeatMode.value === 'none') {
      if (date.getTime() <= Date.now()) {
        errorMessage.value = t('toolkit.datetimeMustFuture');
        return false;
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

    return await submitSchedule(request);
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
      return true;
    } catch (error) {
      errorMessage.value = error instanceof Error && error.message ? error.message : t('toolkit.scheduleFailed');
      return false;
    }
  }

  function withDateSyncSuspended(callback: () => void) {
    suspendDateSync.value = true;
    try {
      callback();
    } finally {
      suspendDateSync.value = false;
    }
  }

  function setAppointmentFromDate(date: Date) {
    appointmentDate.value = formatDateLocal(date);
    appointmentTime.value = formatTimeLocal(date);
  }

  function resetForm() {
    clearTips();
    const initial = nextQuarterHourDate();
    withDateSyncSuspended(() => {
      countdownHours.value = 0;
      countdownMinutes.value = 30;
      countdownSeconds.value = 0;
      setAppointmentFromDate(initial);
      repeatMode.value = 'none';
      weeklyDay.value = dayToWeekday(initial);
      monthlyDay.value = initial.getDate();
    });
  }

  function applyPlanToForm(currentPlan: ShutdownPlan | null) {
    if (!currentPlan) {
      resetForm();
      return;
    }

    clearTips();
    const initial = nextQuarterHourDate();
    withDateSyncSuspended(() => {
      countdownHours.value = 0;
      countdownMinutes.value = 30;
      countdownSeconds.value = 0;
      setAppointmentFromDate(initial);
      repeatMode.value = 'none';
      weeklyDay.value = dayToWeekday(initial);
      monthlyDay.value = initial.getDate();
    });

    if (currentPlan.mode === 'countdown') {
      const total = Math.max(0, Math.round(currentPlan.countdownSeconds ?? 0));
      countdownHours.value = Math.min(999, Math.floor(total / 3600));
      countdownMinutes.value = Math.min(59, Math.floor((total % 3600) / 60));
      countdownSeconds.value = Math.min(59, total % 60);
      return;
    }

    if (currentPlan.mode === 'once') {
      const target = currentPlan.executeAt ? new Date(currentPlan.executeAt) : null;
      if (target && !Number.isNaN(target.getTime())) {
        withDateSyncSuspended(() => {
          setAppointmentFromDate(target);
          weeklyDay.value = dayToWeekday(target);
          monthlyDay.value = target.getDate();
          repeatMode.value = 'none';
        });
      }
      return;
    }

    const timeParts = parseTimeParts(currentPlan.time);
    const base = new Date();
    if (timeParts) {
      base.setHours(timeParts.hour, timeParts.minute, 0, 0);
    }
    withDateSyncSuspended(() => {
      setAppointmentFromDate(base);
      repeatMode.value = currentPlan.mode;
      if (currentPlan.mode === 'weekly') {
        weeklyDay.value = clampInt(currentPlan.weekday ?? weeklyDay.value, 1, 7);
      }
      if (currentPlan.mode === 'monthly') {
        monthlyDay.value = clampInt(currentPlan.dayOfMonth ?? monthlyDay.value, 1, 31);
      }
    });
  }

  function onNumberWheel(event: WheelEvent, field: 'hours' | 'minutes' | 'seconds', min: number, max: number) {
    const element = event.currentTarget as HTMLInputElement | null;
    if (!element || document.activeElement !== element) {
      return;
    }
    event.preventDefault();
    const model = field === 'hours' ? countdownHours : field === 'minutes' ? countdownMinutes : countdownSeconds;
    const dir = event.deltaY > 0 ? -1 : 1;
    const current = sanitizeNonNegative(model.value);
    const next = Math.max(min, Math.min(max, current + dir));
    model.value = next;
  }

  function clearTips() {
    statusMessage.value = '';
    errorMessage.value = '';
  }

  return {
    countdownHours,
    countdownMinutes,
    countdownSeconds,
    appointmentDate,
    appointmentTime,
    minAppointmentDate,
    repeatMode,
    weeklyDay,
    monthlyDay,
    plan,
    statusMessage,
    errorMessage,
    weekdayOptions,
    repeatOptions,
    planText,
    scheduleCountdown,
    scheduleByDatetime,
    cancelPlan,
    resetForm,
    applyPlanToForm,
    onNumberWheel
  };
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

function parseTimeParts(value: string | null) {
  if (!value) return null;
  const match = value.match(/^(\d{2}):(\d{2})$/);
  if (!match) return null;
  const hour = Number.parseInt(match[1], 10);
  const minute = Number.parseInt(match[2], 10);
  if (!Number.isFinite(hour) || !Number.isFinite(minute)) return null;
  if (hour < 0 || hour > 23 || minute < 0 || minute > 59) return null;
  return { hour, minute };
}

function clampInt(value: number, min: number, max: number) {
  if (!Number.isFinite(value)) return min;
  return Math.min(max, Math.max(min, Math.round(value)));
}
