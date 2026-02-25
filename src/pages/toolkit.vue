<template>
  <section class="overlay-widget overlay-widget--cyber toolkit-page">
    <div v-if="prefs.backgroundImage" class="overlay-bg" :style="overlayBackgroundStyle" aria-hidden="true"></div>
    <div
      v-if="showLiquidGlassHighlight"
      class="overlay-bg overlay-bg--liquid-highlight"
      :style="overlayLiquidGlassHighlightStyle"
      aria-hidden="true"></div>

    <header class="toolkit-header">
      <div class="overlay-title toolkit-drag-region" data-tauri-drag-region>
        <h1 class="title">{{ t('toolkit.title') }}</h1>
      </div>
      <div class="overlay-header-actions">
        <button
          type="button"
          class="overlay-action overlay-action--primary"
          :aria-label="t('overlay.minimizeToTray')"
          @click="minimizeToolkitWindow">
          <span class="material-symbols-outlined">remove</span>
        </button>
        <button
          type="button"
          class="overlay-action overlay-action--danger"
          :aria-label="t('overlay.close')"
          @click="closeToolkitWindow">
          <span class="material-symbols-outlined">close</span>
        </button>
      </div>
    </header>

    <nav class="toolkit-tabs" :aria-label="t('toolkit.tabs')">
      <button type="button" class="toolkit-tab toolkit-tab--active">
        {{ t('toolkit.tabShutdown') }}
      </button>
    </nav>

    <div class="toolkit-card">
      <h2 class="toolkit-section-title">{{ t('toolkit.countdownTitle') }}</h2>
      <div class="toolkit-grid toolkit-grid--3">
        <label class="toolkit-field">
          <span>{{ t('toolkit.hours') }}</span>
          <input v-model.number="countdownHours" type="number" min="0" max="999" />
        </label>
        <label class="toolkit-field">
          <span>{{ t('toolkit.minutes') }}</span>
          <input v-model.number="countdownMinutes" type="number" min="0" max="59" />
        </label>
        <label class="toolkit-field">
          <span>{{ t('toolkit.seconds') }}</span>
          <input v-model.number="countdownSeconds" type="number" min="0" max="59" />
        </label>
      </div>
      <button type="button" class="overlay-config-primary" @click="scheduleCountdown">
        {{ t('toolkit.scheduleCountdown') }}
      </button>
    </div>

    <div class="toolkit-card">
      <h2 class="toolkit-section-title">{{ t('toolkit.datetimeTitle') }}</h2>
      <div class="toolkit-grid">
        <label class="toolkit-field">
          <span>{{ t('toolkit.datetime') }}</span>
          <input v-model="appointmentAt" type="datetime-local" />
        </label>
        <label class="toolkit-field">
          <span>{{ t('toolkit.repeat') }}</span>
          <select v-model="repeatMode">
            <option value="none">{{ t('toolkit.repeatNone') }}</option>
            <option value="daily">{{ t('toolkit.repeatDaily') }}</option>
            <option value="weekly">{{ t('toolkit.repeatWeekly') }}</option>
            <option value="monthly">{{ t('toolkit.repeatMonthly') }}</option>
          </select>
        </label>
        <label v-if="repeatMode === 'weekly'" class="toolkit-field">
          <span>{{ t('toolkit.weekday') }}</span>
          <select v-model.number="weeklyDay">
            <option v-for="item in weekdayOptions" :key="item.value" :value="item.value">{{ item.label }}</option>
          </select>
        </label>
        <label v-if="repeatMode === 'monthly'" class="toolkit-field">
          <span>{{ t('toolkit.dayOfMonth') }}</span>
          <input v-model.number="monthlyDay" type="number" min="1" max="31" />
        </label>
      </div>
      <button type="button" class="overlay-config-primary" @click="scheduleByDatetime">
        {{ t('toolkit.scheduleDatetime') }}
      </button>
    </div>

    <div class="toolkit-card">
      <h2 class="toolkit-section-title">{{ t('toolkit.currentPlan') }}</h2>
      <p class="toolkit-plan" :class="{ 'toolkit-plan--muted': !plan }">
        {{ planText }}
      </p>
      <div class="toolkit-actions">
        <button type="button" class="overlay-config-danger" @click="cancelPlan">
          {{ t('toolkit.cancelPlan') }}
        </button>
      </div>
    </div>

    <p v-if="statusMessage" class="toolkit-status">{{ statusMessage }}</p>
    <p v-if="errorMessage" class="toolkit-error">{{ errorMessage }}</p>
  </section>
</template>

<script setup lang="ts">
import { computed, ref, watch } from 'vue';
import { useI18n } from 'vue-i18n';

import { api, inTauri } from '../services/tauri';
import { useOverlayPrefs, type OverlayBackgroundEffect } from '../composables/useOverlayPrefs';
import type { ScheduleShutdownRequest, ShutdownPlan } from '../types';

type RepeatMode = 'none' | 'daily' | 'weekly' | 'monthly';

const { t } = useI18n();
const { prefs } = useOverlayPrefs();

const countdownHours = ref(0);
const countdownMinutes = ref(30);
const countdownSeconds = ref(0);
const appointmentAt = ref(nextQuarterHourLocal());
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

const overlayBackgroundStyle = computed(() => {
  const image = prefs.backgroundImage;
  if (!image) {
    return {};
  }
  const effect = normalizeBackgroundEffect(prefs.backgroundEffect);
  const blurPx = clampBlurPx(prefs.backgroundBlurPx);
  const glassStrength = clampGlassStrength(prefs.backgroundGlassStrength);
  return {
    backgroundImage: `url(${image})`,
    backgroundSize: 'cover',
    backgroundPosition: 'center',
    filter: getBackgroundFilter(effect, blurPx, glassStrength),
    transform: effect === 'liquidGlass' ? 'scale(1.03)' : 'none'
  };
});

const showLiquidGlassHighlight = computed(
  () => Boolean(prefs.backgroundImage) && normalizeBackgroundEffect(prefs.backgroundEffect) === 'liquidGlass'
);

const overlayLiquidGlassHighlightStyle = computed(() => {
  const strength = clampGlassStrength(prefs.backgroundGlassStrength);
  const opacity = 0.14 + strength / 420;
  return {
    background:
      'radial-gradient(120% 90% at 0% 0%, rgba(255,255,255,0.34), rgba(255,255,255,0) 60%), radial-gradient(100% 80% at 100% 0%, rgba(180,220,255,0.18), rgba(180,220,255,0) 70%)',
    opacity: opacity.toFixed(3)
  };
});

watch(
  () => prefs.backgroundOpacity,
  value => {
    if (typeof document === 'undefined') {
      return;
    }
    const safeValue = Math.max(0, Math.min(100, value));
    document.documentElement.style.setProperty('--overlay-bg-opacity', String(safeValue / 100));
  },
  { immediate: true }
);

watch(appointmentAt, value => {
  const date = parseDatetimeLocal(value);
  if (!date) return;
  weeklyDay.value = dayToWeekday(date);
  monthlyDay.value = date.getDate();
});

void refreshPlan();

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

  const date = parseDatetimeLocal(appointmentAt.value);
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

async function closeToolkitWindow() {
  if (!inTauri()) return;
  try {
    const { getCurrentWindow } = await import('@tauri-apps/api/window');
    await getCurrentWindow().close();
  } catch {
    // ignore
  }
}

async function minimizeToolkitWindow() {
  if (!inTauri()) return;
  try {
    const { getCurrentWindow } = await import('@tauri-apps/api/window');
    await getCurrentWindow().minimize();
  } catch {
    // ignore
  }
}

function nextQuarterHourLocal() {
  const now = new Date();
  now.setSeconds(0, 0);
  const nextMinute = Math.ceil((now.getMinutes() + 1) / 15) * 15;
  if (nextMinute >= 60) {
    now.setHours(now.getHours() + 1, 0, 0, 0);
  } else {
    now.setMinutes(nextMinute, 0, 0);
  }
  return formatDatetimeLocal(now);
}

function formatDatetimeLocal(date: Date) {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(
    2,
    '0'
  )}T${String(date.getHours()).padStart(2, '0')}:${String(date.getMinutes()).padStart(2, '0')}`;
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

function parseDatetimeLocal(value: string) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
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

function clampBlurPx(value: unknown) {
  return typeof value === 'number' && Number.isFinite(value) ? Math.max(0, Math.min(40, Math.round(value))) : 0;
}

function clampGlassStrength(value: unknown) {
  return typeof value === 'number' && Number.isFinite(value) ? Math.max(0, Math.min(100, Math.round(value))) : 55;
}

function normalizeBackgroundEffect(value: unknown): OverlayBackgroundEffect {
  return value === 'liquidGlass' ? 'liquidGlass' : 'gaussian';
}

function getBackgroundFilter(effect: OverlayBackgroundEffect, blurPx: number, glassStrength: number) {
  const safeBlur = clampBlurPx(blurPx);
  if (effect === 'liquidGlass') {
    const s = clampGlassStrength(glassStrength);
    const blur = 8 + Math.round((safeBlur / 40) * 14 + (s / 100) * 8);
    const saturate = (130 + Math.round((s / 100) * 70)).toString();
    const brightness = (92 + Math.round((s / 100) * 12)).toString();
    return `blur(${blur}px) saturate(${saturate}%) brightness(${brightness}%)`;
  }
  return safeBlur > 0 ? `blur(${safeBlur}px)` : 'none';
}
</script>
