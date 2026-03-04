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
import { buildReminderCloseSignalKey, buildReminderScreenStorageKey, readReminderScreenPayload } from '../composables/useTaskReminders';
import { storageRepository } from '../services/storageRepository';
import { api, inTauri } from '../services/tauri';
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
let unlistenCloseRequested: (() => void) | null = null;
let storageSignalHandler: ((event: StorageEvent) => void) | null = null;
let keyBlockHandler: ((event: KeyboardEvent) => void) | null = null;
let allowSystemClose = false;

const allowClose = computed(() => advancedSettings.value.allowClose && !advancedSettings.value.blockAllKeys);
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
  if (backgroundImage && backgroundColor) {
    return { background: `url("${backgroundImage}") center / cover no-repeat, ${backgroundColor}` };
  }
  if (backgroundImage) {
    return { background: `url("${backgroundImage}") center / cover no-repeat` };
  }
  return { background: backgroundColor };
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

  if ('keyboard' in navigator && typeof (navigator as any).keyboard?.lock === 'function') {
    try {
      await (navigator as any).keyboard.lock(['Escape']);
    } catch {
      // ignore
    }
  }

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
      event.preventDefault();
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
    void closeCurrentWindowBySignal();
  };
  window.addEventListener('storage', storageSignalHandler);

  if (allowClose.value) {
    closeTimer = window.setInterval(() => {
      if (closeWaitSeconds.value <= 1) {
        closeWaitSeconds.value = 0;
        canClose.value = true;
        if (closeTimer != null) {
          window.clearInterval(closeTimer);
          closeTimer = null;
        }
        return;
      }
      closeWaitSeconds.value -= 1;
    }, 1000);
  }
});

onUnmounted(() => {
  if (closeTimer != null) {
    window.clearInterval(closeTimer);
    closeTimer = null;
  }
  if (unlistenCloseRequested) {
    unlistenCloseRequested();
    unlistenCloseRequested = null;
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
});

async function closeReminderWindows() {
  if (!canClose.value || !allowClose.value || !token.value) {
    return;
  }
  if (requireClosePassword.value && !passwordValid.value) {
    passwordError.value = t('toolkit.reminderScreenPasswordInvalid');
    return;
  }
  allowSystemClose = true;
  if (inTauri()) {
    try {
      void api.forceCloseReminderScreens(token.value);
    } catch {
      // ignore backend close failures and continue with frontend signal fallback
    }
  }
  try {
    storageRepository.setStringSync(buildReminderCloseSignalKey(token.value), String(Date.now()));
  } catch {
    // ignore
  }
  await closeCurrentWindowBySignal();
}

async function closeCurrentWindowBySignal() {
  allowSystemClose = true;
  if (token.value) {
    try {
      storageRepository.removeSync(buildReminderCloseSignalKey(token.value));
      storageRepository.removeSync(buildReminderScreenStorageKey(token.value));
    } catch {
      // ignore
    }
  }
  await closeCurrentWindow();
}

watch(closePasswordInput, () => {
  if (passwordError.value) {
    passwordError.value = '';
  }
});
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
