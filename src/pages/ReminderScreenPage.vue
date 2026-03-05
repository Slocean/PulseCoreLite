<template>
  <section class="reminder-screen" :style="screenStyle" @contextmenu.prevent>
    <div class="reminder-screen__inner">
      <div class="reminder-screen__badge">{{ t('toolkit.reminderScreenBadge') }}</div>
      <h1 class="reminder-screen__title">{{ title }}</h1>
      <div class="reminder-screen__content">
        <ReminderContentRenderer :content-type="contentType" :title="title" :content="content" />
      </div>
      <div class="reminder-screen__hint">{{ hintText }}</div>
      <div v-if="showCloseControls" class="reminder-screen__actions">
        <label v-if="requireClosePassword" class="reminder-screen__password">
          <span>{{ t('toolkit.reminderScreenPasswordLabel') }}</span>
          <input
            v-model="closePasswordInput"
            type="password"
            :placeholder="t('toolkit.reminderScreenPasswordPlaceholder')" />
        </label>
        <p v-if="passwordError" class="reminder-screen__password-error">{{ passwordError }}</p>
        <button
          class="reminder-screen__close-btn"
          type="button"
          :disabled="closeButtonDisabled"
          @click="closeReminderWindows">
          {{ closeButtonText }}
        </button>
      </div>
    </div>
  </section>
</template>

<script setup lang="ts">
import { computed, onMounted, onUnmounted, ref, watch } from 'vue';
import { useI18n } from 'vue-i18n';

import ReminderContentRenderer from '../components/reminder/ReminderContentRenderer.vue';
import {
  buildReminderCloseSignalKey,
  buildReminderScreenStorageKey,
  readReminderScreenPayload
} from '../composables/useTaskReminders';
import { storageRepository } from '../services/storageRepository';
import { api, inTauri, listenEvent } from '../services/tauri';
import {
  closeCurrentWindow,
  focusCurrentWindow,
  listenCurrentWindowCloseRequested,
  setCurrentWindowAlwaysOnTop
} from '../services/windowManager';
import type { ReminderAdvancedSettings, ReminderContentType } from '../types';
import { normalizeAdvancedSettings } from '../composables/taskReminders/scheduler';

const { t } = useI18n();
const contentType = ref<ReminderContentType>('text');
const title = ref('Task Reminder');
const content = ref('');
const advancedSettings = ref<ReminderAdvancedSettings>(normalizeAdvancedSettings(null));
const token = ref<string | null>(null);
const canClose = ref(false);
const closeWaitSeconds = ref(5);
const closePasswordInput = ref('');
const passwordError = ref('');
let closeTimer: number | null = null;
let closeDeadlineMs: number | null = null;
let closeCountdownTick: (() => void) | null = null;
let closeReadyTimer: number | null = null;
let unlistenCloseRequested: (() => void) | null = null;
let unlistenReminderCloseEvent: (() => void) | null = null;
let storageSignalHandler: ((event: StorageEvent) => void) | null = null;
let keyBlockHandler: ((event: KeyboardEvent) => void) | null = null;
let emergencyKeydownHandler: ((event: KeyboardEvent) => void) | null = null;
let emergencyKeyupHandler: ((event: KeyboardEvent) => void) | null = null;
let allowSystemClose = false;
const emergencyKeys = { f9: false, f12: false };
let emergencyCloseTriggered = false;
const DEBUG_LOG_KEY = 'reminder_debug_close_logs';

function pushDebugLog(action: string, data?: Record<string, unknown>) {
  try {
    const logs = JSON.parse(localStorage.getItem(DEBUG_LOG_KEY) || '[]');
    logs.push({
      time: new Date().toISOString(),
      action,
      token: token.value,
      data
    });
    localStorage.setItem(DEBUG_LOG_KEY, JSON.stringify(logs.slice(-60)));
  } catch {
    // ignore
  }
}

const allowClose = computed(() => advancedSettings.value.allowClose);
const requireClosePassword = computed(() => advancedSettings.value.requireClosePassword);
const passwordValid = computed(
  () => !requireClosePassword.value || closePasswordInput.value === advancedSettings.value.closePassword
);
const showCloseControls = computed(() => allowClose.value);
const closeButtonDisabled = computed(() => !canClose.value || !passwordValid.value);
const closeButtonText = computed(() =>
  canClose.value
    ? t('toolkit.reminderScreenCloseReady')
    : t('toolkit.reminderScreenCloseWait', { seconds: closeWaitSeconds.value })
);
const hintText = computed(() =>
  allowClose.value ? t('toolkit.reminderScreenLockedHint') : t('toolkit.reminderScreenCloseBlocked')
);
const screenStyle = computed(() => {
  const { backgroundImage, backgroundColor } = advancedSettings.value;
  if (!backgroundImage && !backgroundColor) {
    return {};
  }
  const style: Record<string, string> = {};
  if (backgroundColor) {
    style.backgroundColor = backgroundColor;
  }
  if (backgroundImage) {
    style.backgroundImage = `url("${backgroundImage}")`;
    style.backgroundRepeat = 'no-repeat';
    style.backgroundPosition = 'center';
    style.backgroundSize = 'cover';
  }
  return style;
});

onMounted(async () => {
  const params = new URLSearchParams(window.location.search);
  token.value = params.get('token');
  const payload = readReminderScreenPayload(token.value);
  if (payload) {
    title.value = payload.title || title.value;
    content.value = payload.content || '';
    contentType.value = payload.contentType;
    advancedSettings.value = normalizeAdvancedSettings(payload.advancedSettings);
  }
  pushDebugLog('mounted', {
    idx: params.get('idx'),
    allowClose: advancedSettings.value.allowClose,
    requireClosePassword: advancedSettings.value.requireClosePassword,
    blockAllKeys: advancedSettings.value.blockAllKeys,
    inTauri: inTauri()
  });

  if ('keyboard' in navigator && typeof (navigator as any).keyboard?.lock === 'function') {
    try {
      await (navigator as any).keyboard.lock(['Escape']);
    } catch {
      // ignore
    }
  }

  emergencyKeydownHandler = event => {
    updateEmergencyKeyState(event, true);
  };
  emergencyKeyupHandler = event => {
    updateEmergencyKeyState(event, false);
  };
  window.addEventListener('keydown', emergencyKeydownHandler, { capture: true });
  window.addEventListener('keyup', emergencyKeyupHandler, { capture: true });

  if (advancedSettings.value.blockAllKeys) {
    keyBlockHandler = event => {
      event.preventDefault();
      event.stopPropagation();
      event.stopImmediatePropagation();
      return false;
    };
    window.addEventListener('keydown', keyBlockHandler, { capture: true });
    window.addEventListener('keyup', keyBlockHandler, { capture: true });
    window.addEventListener('keypress', keyBlockHandler, { capture: true });
  }

  void setCurrentWindowAlwaysOnTop(true);
  void focusCurrentWindow();
  unlistenCloseRequested = await listenCurrentWindowCloseRequested(event => {
    if ((!allowClose.value || !canClose.value) && !allowSystemClose) {
      pushDebugLog('closeRequested:blocked', {
        allowClose: allowClose.value,
        canClose: canClose.value,
        allowSystemClose
      });
      event.preventDefault();
    } else {
      pushDebugLog('closeRequested:allowed', {
        allowClose: allowClose.value,
        canClose: canClose.value,
        allowSystemClose
      });
    }
  });

  storageSignalHandler = event => {
    if (!token.value || !event.key || !event.newValue) {
      return;
    }
    const key = buildReminderCloseSignalKey(token.value);
    if (event.key !== key) {
      return;
    }
    pushDebugLog('storageCloseSignal', { key, value: event.newValue });
    void closeCurrentWindowBySignal();
  };
  window.addEventListener('storage', storageSignalHandler);

  if (inTauri()) {
    unlistenReminderCloseEvent = await listenEvent<{ token?: string; reason?: string }>(
      'reminder://close',
      payload => {
        if (!token.value) {
          return;
        }
        if (payload?.token && payload.token !== token.value) {
          return;
        }
        pushDebugLog('reminderClose:event', { reason: payload?.reason });
        void closeCurrentWindowBySignal();
      }
    );
  }

  if (allowClose.value) {
    startCloseCountdown();
  }
});

onUnmounted(() => {
  if (closeTimer != null) {
    window.clearInterval(closeTimer);
    closeTimer = null;
  }
  if (closeReadyTimer != null) {
    window.clearTimeout(closeReadyTimer);
    closeReadyTimer = null;
  }
  if (closeCountdownTick) {
    window.removeEventListener('visibilitychange', closeCountdownTick);
    window.removeEventListener('focus', closeCountdownTick);
    closeCountdownTick = null;
  }
  if (unlistenCloseRequested) {
    unlistenCloseRequested();
    unlistenCloseRequested = null;
  }
  if (unlistenReminderCloseEvent) {
    unlistenReminderCloseEvent();
    unlistenReminderCloseEvent = null;
  }
  if (storageSignalHandler) {
    window.removeEventListener('storage', storageSignalHandler);
    storageSignalHandler = null;
  }
  if (keyBlockHandler) {
    window.removeEventListener('keydown', keyBlockHandler, { capture: true });
    window.removeEventListener('keyup', keyBlockHandler, { capture: true });
    window.removeEventListener('keypress', keyBlockHandler, { capture: true });
    keyBlockHandler = null;
  }
  if (emergencyKeydownHandler) {
    window.removeEventListener('keydown', emergencyKeydownHandler, { capture: true });
    emergencyKeydownHandler = null;
  }
  if (emergencyKeyupHandler) {
    window.removeEventListener('keyup', emergencyKeyupHandler, { capture: true });
    emergencyKeyupHandler = null;
  }
});

function startCloseCountdown() {
  canClose.value = false;
  if (closeCountdownTick) {
    window.removeEventListener('visibilitychange', closeCountdownTick);
    window.removeEventListener('focus', closeCountdownTick);
    closeCountdownTick = null;
  }
  closeDeadlineMs = Date.now() + closeWaitSeconds.value * 1000;
  if (closeReadyTimer != null) {
    window.clearTimeout(closeReadyTimer);
  }
  closeReadyTimer = window.setTimeout(() => {
    closeWaitSeconds.value = 0;
    canClose.value = true;
    closeDeadlineMs = null;
    pushDebugLog('closeReady');
    if (closeTimer != null) {
      window.clearInterval(closeTimer);
      closeTimer = null;
    }
  }, Math.max(0, closeWaitSeconds.value * 1000) + 50);
  const tick = () => {
    if (closeDeadlineMs == null) {
      return;
    }
    const remaining = Math.max(0, Math.ceil((closeDeadlineMs - Date.now()) / 1000));
    closeWaitSeconds.value = remaining;
    if (remaining <= 0) {
      canClose.value = true;
      closeDeadlineMs = null;
      pushDebugLog('closeReady');
      if (closeTimer != null) {
        window.clearInterval(closeTimer);
        closeTimer = null;
      }
      if (closeReadyTimer != null) {
        window.clearTimeout(closeReadyTimer);
        closeReadyTimer = null;
      }
    }
  };
  closeCountdownTick = tick;
  tick();
  if (closeTimer != null) {
    window.clearInterval(closeTimer);
  }
  closeTimer = window.setInterval(tick, 300);
  window.addEventListener('visibilitychange', tick);
  window.addEventListener('focus', tick);
}

function updateEmergencyKeyState(event: KeyboardEvent, pressed: boolean) {
  const key = event.key.toLowerCase();
  if (key === 'f9') {
    emergencyKeys.f9 = pressed;
  } else if (key === 'f12') {
    emergencyKeys.f12 = pressed;
  } else {
    return;
  }

  if (emergencyKeys.f9 && emergencyKeys.f12 && !emergencyCloseTriggered) {
    emergencyCloseTriggered = true;
    event.preventDefault();
    event.stopPropagation();
    event.stopImmediatePropagation();
    pushDebugLog('emergencyClose:triggered');
    void emergencyCloseReminderWindows();
    return;
  }

  if (!emergencyKeys.f9 || !emergencyKeys.f12) {
    emergencyCloseTriggered = false;
  }
}

async function closeReminderWindows() {
  pushDebugLog('closeButton:clicked', {
    allowClose: allowClose.value,
    canClose: canClose.value,
    requireClosePassword: requireClosePassword.value,
    passwordValid: passwordValid.value
  });
  if (!canClose.value || !allowClose.value || !token.value) {
    pushDebugLog('closeButton:blocked', {
      allowClose: allowClose.value,
      canClose: canClose.value,
      hasToken: Boolean(token.value)
    });
    return;
  }
  if (requireClosePassword.value && !passwordValid.value) {
    passwordError.value = t('toolkit.reminderScreenPasswordInvalid');
    pushDebugLog('closeButton:passwordInvalid');
    return;
  }
  allowSystemClose = true;
  void emitReminderCloseEvent('closeButton');
  if (inTauri()) {
    try {
      void api.forceCloseReminderScreens(token.value);
      pushDebugLog('forceClose:invoked');
    } catch {
      // ignore backend close failures and continue with frontend signal fallback
      pushDebugLog('forceClose:failed');
    }
  }
  try {
    storageRepository.setStringSync(buildReminderCloseSignalKey(token.value), String(Date.now()));
    pushDebugLog('closeSignal:sent');
  } catch {
    // ignore
    pushDebugLog('closeSignal:failed');
  }
  await closeCurrentWindowBySignal();
}

async function emergencyCloseReminderWindows() {
  pushDebugLog('emergencyClose:begin', {
    hasToken: Boolean(token.value),
    allowClose: allowClose.value,
    canClose: canClose.value
  });
  if (!token.value) {
    allowSystemClose = true;
    pushDebugLog('emergencyClose:noToken');
    await closeCurrentWindow();
    return;
  }
  allowSystemClose = true;
  void emitReminderCloseEvent('emergency');
  if (inTauri()) {
    try {
      void api.forceCloseReminderScreens(token.value);
      pushDebugLog('forceClose:invoked');
    } catch {
      // ignore backend close failures and continue with frontend signal fallback
      pushDebugLog('forceClose:failed');
    }
  }
  try {
    storageRepository.setStringSync(buildReminderCloseSignalKey(token.value), String(Date.now()));
    pushDebugLog('closeSignal:sent');
  } catch {
    // ignore
    pushDebugLog('closeSignal:failed');
  }
  await closeCurrentWindowBySignal();
}

async function emitReminderCloseEvent(reason: string) {
  if (!token.value || !inTauri()) {
    return;
  }
  try {
    const { getAllWebviewWindows } = await import('@tauri-apps/api/webviewWindow');
    const windows = await getAllWebviewWindows();
    const prefix = `reminder-screen-${token.value}-`;
    const targets = windows.filter(win => win.label.startsWith(prefix));
    await Promise.allSettled(
      targets.map(win => win.emit('reminder://close', { token: token.value, reason }))
    );
    pushDebugLog('reminderClose:emitted', { reason, count: targets.length });
  } catch {
    pushDebugLog('reminderClose:emitFailed', { reason });
  }
}

async function closeCurrentWindowBySignal() {
  allowSystemClose = true;
  pushDebugLog('closeCurrentWindowBySignal:begin');
  if (token.value) {
    try {
      const closeKey = buildReminderCloseSignalKey(token.value);
      const screenKey = buildReminderScreenStorageKey(token.value);
      // Delay cleanup so other reminder windows can receive the storage close signal.
      window.setTimeout(() => {
        try {
          storageRepository.removeSync(closeKey);
          storageRepository.removeSync(screenKey);
          pushDebugLog('closeSignal:cleared');
        } catch {
          // ignore
          pushDebugLog('closeSignal:clearFailed');
        }
      }, 1200);
    } catch {
      // ignore
      pushDebugLog('closeSignal:clearFailed');
    }
  }
  await closeCurrentWindow();
  pushDebugLog('closeCurrentWindowBySignal:requested');
}

watch(closePasswordInput, () => {
  if (passwordError.value) {
    passwordError.value = '';
  }
});

watch(
  allowClose,
  enabled => {
    if (enabled && !canClose.value) {
      startCloseCountdown();
    }
  },
  { immediate: false }
);
</script>

<style scoped>
.reminder-screen {
  position: fixed;
  inset: 0;
  min-height: 100vh;
  width: 100vw;
  height: 100vh;
  display: grid;
  place-items: center;
  background:
    radial-gradient(140% 120% at 20% 10%, rgba(0, 242, 255, 0.18), rgba(0, 0, 0, 0) 60%),
    radial-gradient(140% 120% at 80% 90%, rgba(255, 72, 112, 0.2), rgba(0, 0, 0, 0) 62%), #05070b;
  color: rgba(243, 247, 255, 0.96);
  padding: 0;
}

.reminder-screen__inner {
  width: min(1100px, 100%);
  max-height: 100%;
  display: grid;
  gap: 20px;
  padding: clamp(16px, 3vw, 36px);
  box-sizing: border-box;
}

.reminder-screen__badge {
  width: fit-content;
  padding: 6px 12px;
  border-radius: 999px;
  border: 1px dashed rgba(0, 242, 255, 0.68);
  color: rgba(0, 242, 255, 0.92);
  letter-spacing: 0.18em;
  font-size: clamp(11px, 1vw, 14px);
}

.reminder-screen__title {
  margin: 0;
  font-size: clamp(30px, 5vw, 64px);
  line-height: 1.04;
  letter-spacing: 0.04em;
  text-transform: uppercase;
}

.reminder-screen__content {
  min-height: 45vh;
  border-radius: 18px;
  border: 1px solid rgba(255, 255, 255, 0.18);
  background: rgba(0, 0, 0, 0.5);
  padding: clamp(16px, 2.2vw, 28px);
  overflow: auto;
}

.reminder-screen__hint {
  justify-self: center;
  padding: 8px 12px;
  font-size: 13px;
  border-radius: 999px;
  letter-spacing: 0.08em;
  color: rgba(255, 173, 173, 0.95);
  border: 1px dashed rgba(255, 140, 140, 0.68);
  background: rgba(255, 72, 112, 0.08);
}

.reminder-screen__actions {
  display: flex;
  justify-content: center;
  flex-direction: column;
  align-items: center;
  gap: 10px;
}

.reminder-screen__password {
  display: grid;
  gap: 6px;
  font-size: 12px;
  letter-spacing: 0.06em;
  color: rgba(255, 255, 255, 0.86);
}

.reminder-screen__password input {
  min-width: min(320px, 90vw);
  height: 36px;
  border-radius: 8px;
  border: 1px solid rgba(255, 255, 255, 0.2);
  background: rgba(0, 0, 0, 0.45);
  color: rgba(255, 255, 255, 0.96);
  padding: 6px 10px;
  font-size: 13px;
}

.reminder-screen__password-error {
  margin: 0;
  font-size: 12px;
  color: rgba(255, 120, 120, 0.95);
}

.reminder-screen__close-btn {
  min-width: 190px;
  height: 42px;
  border-radius: 10px;
  border: 1px dashed rgba(255, 255, 255, 0.28);
  background: rgba(255, 255, 255, 0.06);
  color: rgba(255, 255, 255, 0.9);
  letter-spacing: 0.08em;
  cursor: pointer;
}

.reminder-screen__close-btn:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}

.reminder-screen__close-btn:not(:disabled):hover {
  border-color: rgba(0, 242, 255, 0.66);
  color: rgba(0, 242, 255, 0.96);
}
</style>
