import { computed, reactive } from 'vue';

export interface ToastState {
  open: boolean;
  message: string;
}

type ShowToastOptions = {
  channel?: string;
  durationMs?: number;
};

const DEFAULT_CHANNEL = 'global';
const DEFAULT_DURATION_MS = 2000;
const toastStateMap = reactive<Record<string, ToastState>>({});
const toastTimerMap = new Map<string, ReturnType<typeof globalThis.setTimeout>>();
const timerApi = globalThis;

function ensureToastState(channel: string): ToastState {
  if (!toastStateMap[channel]) {
    toastStateMap[channel] = {
      open: false,
      message: ''
    };
  }
  return toastStateMap[channel];
}

function clearToastTimer(channel: string) {
  const timer = toastTimerMap.get(channel);
  if (timer != null) {
    timerApi.clearTimeout(timer);
    toastTimerMap.delete(channel);
  }
}

export function useToastService(channel = DEFAULT_CHANNEL) {
  const normalizedChannel = channel || DEFAULT_CHANNEL;

  function showToast(message: string, options: ShowToastOptions = {}) {
    const targetChannel = options.channel || normalizedChannel;
    const durationMs = options.durationMs ?? DEFAULT_DURATION_MS;
    const state = ensureToastState(targetChannel);
    state.message = message;
    state.open = Boolean(message);
    clearToastTimer(targetChannel);
    if (!state.open || durationMs <= 0) {
      return;
    }
    const timer = timerApi.setTimeout(() => {
      const current = ensureToastState(targetChannel);
      current.open = false;
    }, durationMs);
    toastTimerMap.set(targetChannel, timer);
  }

  function hideToast(targetChannel = normalizedChannel) {
    const state = ensureToastState(targetChannel);
    state.open = false;
    clearToastTimer(targetChannel);
  }

  const toastState = computed(() => ensureToastState(normalizedChannel));

  return {
    toastState,
    showToast,
    hideToast
  };
}

export function resetToastServiceStateForTests() {
  for (const channel of Object.keys(toastStateMap)) {
    clearToastTimer(channel);
    delete toastStateMap[channel];
  }
}
