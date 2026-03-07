<template>
  <Teleport to="body">
    <Transition name="overlay-dialog">
      <div v-if="open" class="overlay-dialog-backdrop" role="presentation" @mousedown.self="handleCancel">
        <div class="overlay-dialog" role="dialog" aria-modal="true" @mousedown.stop>
          <div class="overlay-dialog-header">
            <div class="overlay-dialog-title">{{ props.title }}</div>
            <UiButton
              native-type="button"
              preset="overlay-dialog-close"
              :aria-label="props.closeLabel"
              @click="handleCancel">
              <span class="material-symbols-outlined">close</span>
            </UiButton>
          </div>
          <div class="overlay-dialog-body">
            <slot name="body">
              <div v-if="props.message" class="overlay-dialog-message">{{ props.message }}</div>
            </slot>
          </div>
          <div v-if="props.showActions" class="overlay-dialog-actions">
            <slot name="actions" :confirm="handleConfirm" :cancel="handleCancel">
              <UiButton native-type="button" preset="overlay-chip" @click="handleCancel">
                {{ props.cancelText }}
              </UiButton>
              <UiButton
                native-type="button"
                preset="overlay-danger"
                :autofocus="props.autofocusConfirm"
                @click="handleConfirm">
                {{ props.confirmText }}
              </UiButton>
            </slot>
          </div>
        </div>
      </div>
    </Transition>
  </Teleport>
</template>

<script setup lang="ts">
import { onUnmounted, watch } from 'vue';

import UiButton from '@/components/ui/Button';
import type { DialogProps, DialogSlots } from './types';

const props = withDefaults(defineProps<DialogProps>(), {
  closeLabel: 'Close',
  closeOnEsc: true,
  closeOnConfirm: true,
  autofocusConfirm: true,
  showActions: true,
  confirmText: 'Confirm',
  cancelText: 'Cancel'
});

const open = defineModel<boolean>('open', { required: true });

const emit = defineEmits<{
  (e: 'confirm'): void;
  (e: 'cancel'): void;
}>();

defineSlots<DialogSlots>();

function handleConfirm() {
  if (props.closeOnConfirm) {
    open.value = false;
  }
  emit('confirm');
}

function handleCancel() {
  open.value = false;
  emit('cancel');
}

function onKeydown(event: KeyboardEvent) {
  if (!open.value) return;
  if (event.key === 'Escape' && props.closeOnEsc) {
    event.preventDefault();
    event.stopPropagation();
    handleCancel();
  }
  if (event.key === 'Enter') {
    event.preventDefault();
    event.stopPropagation();
    handleConfirm();
  }
}

watch(
  () => open.value,
  next => {
    if (typeof window === 'undefined') return;
    if (next) {
      window.addEventListener('keydown', onKeydown, true);
    } else {
      window.removeEventListener('keydown', onKeydown, true);
    }
  },
  { immediate: true }
);

onUnmounted(() => {
  if (typeof window === 'undefined') return;
  window.removeEventListener('keydown', onKeydown, true);
});
</script>
