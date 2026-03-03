<template>
  <section class="reminder-screen" @contextmenu.prevent>
    <div class="reminder-screen__inner">
      <div class="reminder-screen__badge">{{ t('toolkit.reminderScreenBadge') }}</div>
      <h1 class="reminder-screen__title">{{ title }}</h1>
      <div class="reminder-screen__content">
        <ReminderContentRenderer :content-type="contentType" :title="title" :content="content" />
      </div>
      <div class="reminder-screen__hint">{{ t('toolkit.reminderScreenLockedHint') }}</div>
      <div class="reminder-screen__actions">
        <button
          class="reminder-screen__close-btn"
          type="button"
          :disabled="!canClose"
          @click="closeReminderWindows">
          {{ closeButtonText }}
        </button>
      </div>
    </div>
  </section>
</template>

<script setup lang="ts">
import { computed, onMounted, onUnmounted, ref } from 'vue';
import { useI18n } from 'vue-i18n';

import ReminderContentRenderer from '../components/reminder/ReminderContentRenderer.vue';
import { buildReminderCloseSignalKey, readReminderScreenPayload } from '../composables/useTaskReminders';
import { storageRepository } from '../services/storageRepository';
import { api, inTauri } from '../services/tauri';
import type { ReminderContentType } from '../types';

const { t } = useI18n();
const contentType = ref<ReminderContentType>('text');
const title = ref('Task Reminder');
const content = ref('');
const token = ref<string | null>(null);
const canClose = ref(false);
const closeWaitSeconds = ref(5);
let closeTimer: number | null = null;
let unlistenCloseRequested: (() => void) | null = null;
let storageSignalHandler: ((event: StorageEvent) => void) | null = null;
let allowSystemClose = false;

const closeButtonText = computed(() =>
  canClose.value
    ? t('toolkit.reminderScreenCloseReady')
    : t('toolkit.reminderScreenCloseWait', { seconds: closeWaitSeconds.value })
);

onMounted(async () => {
  const params = new URLSearchParams(window.location.search);
  token.value = params.get('token');
  const payload = readReminderScreenPayload(token.value);
  if (payload) {
    title.value = payload.title || title.value;
    content.value = payload.content || '';
    contentType.value = payload.contentType;
  }

  if ('keyboard' in navigator && typeof (navigator as any).keyboard?.lock === 'function') {
    try {
      await (navigator as any).keyboard.lock(['Escape']);
    } catch {
      // ignore
    }
  }

  try {
    const { getCurrentWindow } = await import('@tauri-apps/api/window');
    const current = getCurrentWindow();
    await current.setAlwaysOnTop(true);
    await current.setFocus();
    unlistenCloseRequested = await current.onCloseRequested(event => {
      if (!canClose.value && !allowSystemClose) {
        event.preventDefault();
      }
    });
  } catch {
    // ignore
  }

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
});

async function closeReminderWindows() {
  if (!canClose.value || !token.value) {
    return;
  }
  if (inTauri()) {
    try {
      await api.forceCloseReminderScreens(token.value);
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
  try {
    const { getCurrentWindow } = await import('@tauri-apps/api/window');
    await getCurrentWindow().close();
  } catch {
    // ignore
  }
}
</script>

<style scoped>
.reminder-screen {
  min-height: 100vh;
  width: 100vw;
  display: grid;
  place-items: center;
  background:
    radial-gradient(140% 120% at 20% 10%, rgba(0, 242, 255, 0.18), rgba(0, 0, 0, 0) 60%),
    radial-gradient(140% 120% at 80% 90%, rgba(255, 72, 112, 0.2), rgba(0, 0, 0, 0) 62%),
    #05070b;
  color: rgba(243, 247, 255, 0.96);
  padding: 3vw;
}

.reminder-screen__inner {
  width: min(1100px, 100%);
  max-height: 100%;
  display: grid;
  gap: 20px;
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
