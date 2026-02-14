<template>
  <Teleport to="body">
    <Transition name="overlay-dialog">
      <div v-if="open" class="overlay-dialog-backdrop" role="presentation" @mousedown.self="handleCancel">
        <div class="overlay-dialog" role="dialog" aria-modal="true" @mousedown.stop>
          <div class="overlay-dialog-header">
            <div class="overlay-dialog-title">{{ title }}</div>
            <button type="button" class="overlay-dialog-close" :aria-label="closeLabel" @click="handleCancel">
              <span class="material-symbols-outlined">close</span>
            </button>
          </div>
          <div class="overlay-dialog-body">
            <slot name="body">
              <div v-if="message" class="overlay-dialog-message">{{ message }}</div>
            </slot>
          </div>
          <div v-if="showActions" class="overlay-dialog-actions">
            <slot name="actions">
              <button type="button" class="overlay-lang-button" @click="handleCancel">
                {{ cancelText }}
              </button>
              <button
                type="button"
                class="overlay-config-danger"
                :autofocus="autofocusConfirm"
                @click="handleConfirm">
                {{ confirmText }}
              </button>
            </slot>
          </div>
        </div>
      </div>
    </Transition>
  </Teleport>
</template>

<script setup lang="ts">
import { onUnmounted, watch } from 'vue';

const open = defineModel<boolean>('open', { required: true });

withDefaults(
  defineProps<{
    title: string;
    message?: string;
    confirmText?: string;
    cancelText?: string;
    closeLabel?: string;
    closeOnEsc?: boolean;
    autofocusConfirm?: boolean;
    showActions?: boolean;
  }>(),
  {
    closeLabel: 'Close',
    closeOnEsc: true,
    autofocusConfirm: true,
    showActions: true,
    confirmText: 'Confirm',
    cancelText: 'Cancel'
  }
);

const emit = defineEmits<{
  (e: 'confirm'): void;
  (e: 'cancel'): void;
}>();

const handleConfirm = () => {
  open.value = false;
  emit('confirm');
};

const handleCancel = () => {
  open.value = false;
  emit('cancel');
};

const onKeydown = (event: KeyboardEvent) => {
  if (!open.value) return;
  if (event.key === 'Escape') {
    event.preventDefault();
    event.stopPropagation();
    handleCancel();
  }
  if (event.key === 'Enter') {
    event.preventDefault();
    event.stopPropagation();
    handleConfirm();
  }
};

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
