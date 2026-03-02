<template>
  <Teleport to="body">
    <Transition name="ui-dialog">
      <div v-if="open" class="ui-dialog-backdrop" role="presentation" @mousedown.self="handleCancel">
        <div class="ui-dialog" role="dialog" aria-modal="true" @mousedown.stop>
          <div class="ui-dialog-header">
            <div class="ui-dialog-title">{{ props.title }}</div>
            <UiButton
              native-type="button"
              preset="ui-dialog-close"
              :aria-label="props.closeLabel"
              @click="handleCancel">
              <span class="material-symbols-outlined">close</span>
            </UiButton>
          </div>
          <div class="ui-dialog-body">
            <slot name="body">
              <div v-if="props.message" class="ui-dialog-message">{{ props.message }}</div>
            </slot>
          </div>
          <div v-if="props.showActions" class="ui-dialog-actions">
            <slot name="actions">
              <UiButton
                native-type="button"
                preset="ui-dialog-cancel"
                @click="handleCancel">
                {{ props.cancelText }}
              </UiButton>
              <UiButton
                native-type="button"
                preset="ui-dialog-confirm"
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
import { onUnmounted, watch } from 'vue'
import type { DialogProps } from './types'
import UiButton from '@/components/ui/Button'

const props = withDefaults(defineProps<DialogProps>(), {
  closeLabel: 'Close',
  closeOnEsc: true,
  autofocusConfirm: true,
  showActions: true,
  confirmText: 'Confirm',
  cancelText: 'Cancel'
})

const open = defineModel<boolean>('open', { required: true })

const emit = defineEmits<{
  (e: 'confirm'): void
  (e: 'cancel'): void
}>()

function handleConfirm() {
  open.value = false
  emit('confirm')
}

function handleCancel() {
  open.value = false
  emit('cancel')
}

function onKeydown(event: KeyboardEvent) {
  if (!open.value) return
  if (event.key === 'Escape' && props.closeOnEsc) {
    event.preventDefault()
    event.stopPropagation()
    handleCancel()
  }
  if (event.key === 'Enter') {
    event.preventDefault()
    event.stopPropagation()
    handleConfirm()
  }
}

watch(
  () => open.value,
  next => {
    if (typeof window === 'undefined') return
    if (next) {
      window.addEventListener('keydown', onKeydown, true)
    } else {
      window.removeEventListener('keydown', onKeydown, true)
    }
  },
  { immediate: true }
)

onUnmounted(() => {
  if (typeof window === 'undefined') return
  window.removeEventListener('keydown', onKeydown, true)
})
</script>

<style scoped>
.ui-dialog-backdrop {
  position: fixed;
  inset: 0;
  z-index: 1000;
  background: rgba(0, 0, 0, 0.55);
  display: flex;
  align-items: center;
  justify-content: center;
  backdrop-filter: blur(4px);
}

.ui-dialog {
  min-width: 260px;
  max-width: 420px;
  width: 90%;
  border-radius: 14px;
  border: 1px solid rgba(255, 255, 255, 0.14);
  background: rgba(14, 18, 26, 0.96);
  box-shadow:
    0 8px 40px rgba(0, 0, 0, 0.6),
    0 0 0 1px rgba(255, 255, 255, 0.06) inset;
  display: grid;
  gap: 0;
  overflow: hidden;
}

.ui-dialog-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 8px;
  padding: 14px 16px 10px;
  border-bottom: 1px solid rgba(255, 255, 255, 0.08);
}

.ui-dialog-title {
  font-size: 13px;
  font-weight: 600;
  letter-spacing: 0.06em;
  color: rgba(255, 255, 255, 0.92);
}

.ui-button--preset-ui-dialog-close .material-symbols-outlined {
  font-size: 18px;
  line-height: 1;
}

.ui-dialog-body {
  padding: 14px 16px;
}

.ui-dialog-message {
  font-size: 12px;
  line-height: 1.5;
  color: rgba(255, 255, 255, 0.78);
}

.ui-dialog-actions {
  display: flex;
  align-items: center;
  justify-content: flex-end;
  gap: 8px;
  padding: 10px 16px 14px;
  border-top: 1px solid rgba(255, 255, 255, 0.08);
}

.ui-dialog-enter-active,
.ui-dialog-leave-active {
  transition: opacity 160ms ease;
}

.ui-dialog-enter-active .ui-dialog,
.ui-dialog-leave-active .ui-dialog {
  transition: transform 160ms ease, opacity 160ms ease;
}

.ui-dialog-enter-from,
.ui-dialog-leave-to {
  opacity: 0;
}

.ui-dialog-enter-from .ui-dialog,
.ui-dialog-leave-to .ui-dialog {
  transform: scale(0.96) translateY(6px);
  opacity: 0;
}
</style>

