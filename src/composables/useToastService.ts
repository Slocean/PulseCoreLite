import { computed, reactive } from 'vue';

import type { ToastVariant } from '@/components/ui/Toast';

export interface ToastState {
  open: boolean;
  message: string;
  variant: ToastVariant;
  closable: boolean;
  pinnable: boolean;
  pinned: boolean;
  durationMs: number;
}

type ShowToastOptions = {
  channel?: string;
  durationMs?: number;
  variant?: ToastVariant;
  closable?: boolean;
  pinnable?: boolean;
  pinned?: boolean;
};

const DEFAULT_CHANNEL = 'global';
const MIN_DURATION_MS = 2200;
const DURATION_BY_VARIANT: Record<ToastVariant, number> = {
  success: 2600,
  primary: 3200,
  info: 4000,
  warning: 5200,
  error: 7000
};
const toastStateMap = reactive<Record<string, ToastState>>({});
const toastTimerMap = new Map<string, ReturnType<typeof globalThis.setTimeout>>();
const timerApi = globalThis;

function ensureToastState(channel: string): ToastState {
  if (!toastStateMap[channel]) {
    toastStateMap[channel] = {
      open: false,
      message: '',
      variant: 'info',
      closable: true,
      pinnable: true,
      pinned: false,
      durationMs: DURATION_BY_VARIANT.info
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

function startToastTimer(channel: string, durationMs: number) {
  clearToastTimer(channel);
  if (durationMs <= 0) {
    return;
  }
  const timer = timerApi.setTimeout(() => {
    const current = ensureToastState(channel);
    if (current.pinned) {
      return;
    }
    current.open = false;
  }, durationMs);
  toastTimerMap.set(channel, timer);
}

function getAutoDuration(message: string, variant: ToastVariant) {
  const base = DURATION_BY_VARIANT[variant];
  const readingBonus = Math.ceil(Math.max(0, message.trim().length - 24) / 18) * 450;
  return Math.max(MIN_DURATION_MS, base + readingBonus);
}

export function useToastService(channel = DEFAULT_CHANNEL) {
  const normalizedChannel = channel || DEFAULT_CHANNEL;

  function showToast(message: string, options: ShowToastOptions = {}) {
    const targetChannel = options.channel || normalizedChannel;
    const variant = options.variant ?? 'info';
    const durationMs = options.durationMs ?? getAutoDuration(message, variant);
    const state = ensureToastState(targetChannel);
    state.message = message;
    state.open = Boolean(message);
    state.variant = variant;
    state.closable = options.closable ?? true;
    state.pinnable = options.pinnable ?? true;
    state.pinned = options.pinned ?? false;
    state.durationMs = durationMs;
    clearToastTimer(targetChannel);
    if (!state.open || durationMs <= 0 || state.pinned) {
      return;
    }
    startToastTimer(targetChannel, durationMs);
  }

  function hideToast(targetChannel = normalizedChannel) {
    const state = ensureToastState(targetChannel);
    state.open = false;
    state.pinned = false;
    clearToastTimer(targetChannel);
  }

  function setPinned(pinned: boolean, targetChannel = normalizedChannel) {
    const state = ensureToastState(targetChannel);
    state.pinned = pinned;
    if (!state.open) {
      return;
    }
    if (pinned) {
      clearToastTimer(targetChannel);
      return;
    }
    startToastTimer(targetChannel, state.durationMs);
  }

  const toastState = computed(() => ensureToastState(normalizedChannel));

  return {
    toastState,
    showToast,
    hideToast,
    setPinned,
    getAutoDuration
  };
}

export function resetToastServiceStateForTests() {
  for (const channel of Object.keys(toastStateMap)) {
    clearToastTimer(channel);
    delete toastStateMap[channel];
  }
}
