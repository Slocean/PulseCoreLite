<template>
  <Transition name="toast">
    <div v-if="effectiveOpen && effectiveMessage" class="ui-toast-layer" :aria-live="props.ariaLive">
      <div
        ref="toastElement"
        class="ui-toast"
        :class="[`ui-toast--${effectiveVariant}`, { 'ui-toast--pinned': effectivePinned }]"
        :style="toastStyle">
        <div class="ui-toast__message">{{ effectiveMessage }}</div>
        <div class="ui-toast__actions">
          <button type="button" class="ui-toast__action" :aria-label="copyLabel" @click="handleCopy">
            <span class="material-symbols-outlined">content_copy</span>
          </button>
          <button
            v-if="effectivePinnable"
            type="button"
            class="ui-toast__action"
            :class="{ 'ui-toast__action--active': effectivePinned }"
            :aria-label="pinLabel"
            @click="setPinned(!effectivePinned, props.channel ?? 'global')">
            <span class="material-symbols-outlined">push_pin</span>
          </button>
          <button
            v-if="effectiveClosable"
            type="button"
            class="ui-toast__action"
            :aria-label="closeLabel"
            @click="hideToast(props.channel ?? 'global')">
            <span class="material-symbols-outlined">close</span>
          </button>
        </div>
      </div>
    </div>
  </Transition>
</template>

<script setup lang="ts">
import { computed, nextTick, onBeforeUnmount, ref, watch } from 'vue';
import type { PropType } from 'vue';
import { useToastService } from '@/composables/useToastService';
import type { ToastProps } from './types';
import { resolveToastRenderState } from './logic';

const props = defineProps({
  open: {
    type: Boolean,
    default: undefined
  },
  message: {
    type: String,
    default: undefined
  },
  channel: {
    type: String,
    default: undefined
  },
  variant: {
    type: String as PropType<ToastProps['variant']>,
    default: 'info'
  },
  closable: {
    type: Boolean,
    default: undefined
  },
  pinnable: {
    type: Boolean,
    default: undefined
  },
  durationMs: {
    type: Number,
    default: undefined
  },
  ariaLive: {
    type: String as PropType<ToastProps['ariaLive']>,
    default: 'polite'
  }
});

const isServiceMode = computed(() => Boolean(props.channel));
const { toastState, hideToast, setPinned } = useToastService(props.channel ?? 'global');

const renderState = computed(() =>
  resolveToastRenderState(
    {
      open: props.open,
      message: props.message,
      channel: isServiceMode.value ? props.channel : undefined,
      variant: props.variant,
      closable: props.closable,
      pinnable: props.pinnable,
      durationMs: props.durationMs
    },
    {
      open: toastState.value.open,
      message: toastState.value.message,
      variant: toastState.value.variant,
      closable: toastState.value.closable,
      pinnable: toastState.value.pinnable,
      durationMs: toastState.value.durationMs,
      pinned: toastState.value.pinned
    }
  )
);

const effectiveOpen = computed(() => renderState.value.open);
const effectiveMessage = computed(() => renderState.value.message);
const effectiveVariant = computed(() => renderState.value.variant);
const effectiveClosable = computed(() => renderState.value.closable);
const effectivePinnable = computed(() => renderState.value.pinnable);
const effectivePinned = computed(() => renderState.value.pinned ?? false);
const toastElement = ref<HTMLElement | null>(null);
const lockedHeight = ref<number | null>(null);
const toastStyle = computed(() => {
  if (!lockedHeight.value) {
    return undefined;
  }

  return {
    minHeight: `${lockedHeight.value}px`
  };
});
const closeLabel = 'Close notification';
const copyLabel = 'Copy notification';
const pinLabel = computed(() => (effectivePinned.value ? 'Unpin notification' : 'Pin notification'));

let syncHeightToken = 0;

async function syncToastHeight() {
  const token = ++syncHeightToken;
  await nextTick();

  if (token !== syncHeightToken || !effectiveOpen.value) {
    return;
  }

  const height = toastElement.value?.offsetHeight;
  if (!height) {
    return;
  }

  lockedHeight.value = Math.max(lockedHeight.value ?? 0, height);
}

watch(
  [effectiveOpen, effectiveMessage],
  ([open]) => {
    if (!open) {
      lockedHeight.value = null;
      return;
    }

    void syncToastHeight();
  },
  { immediate: true }
);

onBeforeUnmount(() => {
  syncHeightToken += 1;
});

async function handleCopy() {
  const message = effectiveMessage.value;
  if (!message) {
    return;
  }
  try {
    if (typeof navigator !== 'undefined' && navigator.clipboard?.writeText) {
      await navigator.clipboard.writeText(message);
      return;
    }
  } catch {}

  if (typeof document === 'undefined') {
    return;
  }
  const textarea = document.createElement('textarea');
  textarea.value = message;
  textarea.setAttribute('readonly', 'true');
  textarea.style.position = 'fixed';
  textarea.style.opacity = '0';
  document.body.appendChild(textarea);
  textarea.select();
  document.execCommand('copy');
  document.body.removeChild(textarea);
}
</script>

<style scoped>
.ui-toast-layer {
  position: fixed;
  top: 61px;
  left: 0;
  right: 0;
  display: flex;
  justify-content: center;
  align-items: flex-start;
  z-index: 9999;
  pointer-events: none;
  padding: 0 12px;
}

.ui-toast {
  pointer-events: auto;
  width: min(720px, 100%);
  max-height: 400px;
  display: flex;
  align-items: flex-start;
  gap: 10px;
  padding: 10px 12px;
  border-radius: 10px;
  border: 1px solid rgba(255, 255, 255, 0.1);
  color: rgba(255, 255, 255, 0.96);
  font-size: 13px;
  line-height: 1.5;
  letter-spacing: 0.01em;
  box-shadow: 0 8px 20px rgba(0, 0, 0, 0.16);
  backdrop-filter: blur(10px);
  overflow: hidden;
}

.ui-toast__message {
  flex: 1;
  min-width: 0;
  max-height: calc(400px - 20px);
  white-space: pre-wrap;
  word-break: break-word;
  overflow-wrap: anywhere;
  overflow-y: auto;
  padding-right: 4px;
}

.ui-toast__actions {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  flex: 0 0 auto;
}

.ui-toast__action {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 24px;
  height: 24px;
  padding: 0;
  border: 0;
  border-radius: 6px;
  background: transparent;
  color: inherit;
  cursor: pointer;
}

.ui-toast__action:hover {
  background: rgba(255, 255, 255, 0.08);
}

.ui-toast__action--active {
  background: rgba(255, 255, 255, 0.14);
}

.ui-toast__action .material-symbols-outlined {
  font-size: 18px;
}

.ui-toast--pinned {
  border-color: rgba(255, 255, 255, 0.22);
}

.ui-toast--success {
  background: rgba(22, 101, 52, 0.42);
  border-color: rgba(74, 222, 128, 0.22);
}

.ui-toast--primary {
  background: rgba(30, 64, 175, 0.4);
  border-color: rgba(96, 165, 250, 0.24);
}

.ui-toast--info {
  background: rgba(31, 41, 55, 0.36);
  border-color: rgba(148, 163, 184, 0.18);
}

.ui-toast--warning {
  background: rgba(146, 64, 14, 0.42);
  border-color: rgba(251, 191, 36, 0.24);
}

.ui-toast--error {
  background: rgba(127, 29, 29, 0.44);
  border-color: rgba(248, 113, 113, 0.26);
}
</style>
