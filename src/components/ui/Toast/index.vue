<template>
  <Transition name="toast">
    <div v-if="effectiveOpen && effectiveMessage" class="ui-toast-layer" :aria-live="props.ariaLive">
      <div class="ui-toast">
        {{ effectiveMessage }}
      </div>
    </div>
  </Transition>
</template>

<script setup lang="ts">
import { computed } from 'vue';
import type { PropType } from 'vue';
import { useToastService } from '@/composables/useToastService';
import type { ToastProps } from "./types";
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
  ariaLive: {
    type: String as PropType<ToastProps['ariaLive']>,
    default: 'polite'
  }
});

const isServiceMode = computed(() => Boolean(props.channel));
const { toastState } = useToastService(props.channel ?? 'global');

const renderState = computed(() =>
  resolveToastRenderState(
    {
      open: props.open,
      message: props.message,
      channel: isServiceMode.value ? props.channel : undefined
    },
    { open: toastState.value.open, message: toastState.value.message }
  )
);

const effectiveOpen = computed(() => renderState.value.open);
const effectiveMessage = computed(() => renderState.value.message);
</script>

<style scoped>
.ui-toast-layer {
  position: fixed;
  top: 8px;
  left: 0;
  right: 0;
  display: flex;
  justify-content: center;
  align-items: flex-start;
  z-index: 9999;
  pointer-events: none;
}

.ui-toast {
  padding: 6px 10px;
  border-radius: 8px;
  border: 1px solid rgba(255, 255, 255, 0.18);
  background: rgba(0, 0, 0, 0.7);
  color: rgba(255, 255, 255, 0.9);
  font-size: 11px;
  letter-spacing: 0.08em;
  text-transform: uppercase;
  text-align: center;
  box-shadow: 0 8px 20px rgba(0, 0, 0, 0.35);
}
</style>
