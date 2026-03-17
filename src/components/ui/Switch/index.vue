<template>
  <label class="ui-switch" :class="`ui-switch--${props.variant}`" :aria-label="props.ariaLabel">
    <input
      type="checkbox"
      role="switch"
      :checked="props.modelValue"
      :disabled="props.disabled"
      :aria-labelledby="props.ariaLabelledby"
      :aria-describedby="props.ariaDescribedby"
      @change="handleChange" />
    <span v-if="props.variant === 'button'" class="ui-switch-button" aria-hidden="true">
      <slot>{{ props.ariaLabel }}</slot>
    </span>
    <span v-else class="ui-switch-track" aria-hidden="true"></span>
  </label>
</template>

<script setup lang="ts">
import type { SwitchProps } from './types'

const props = withDefaults(defineProps<SwitchProps>(), {
  variant: 'track',
  disabled: false
})

const emit = defineEmits<{
  (e: 'update:modelValue', value: boolean): void
}>()

function handleChange(event: Event) {
  const target = event.target as HTMLInputElement
  emit('update:modelValue', target.checked)
}
</script>

<style scoped>
.ui-switch {
  --ui-switch-focus-ring-color: rgba(0, 242, 255, 0.55);
  --ui-switch-focus-ring-offset: 2px;
  position: relative;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  cursor: pointer;
  user-select: none;
}

.ui-switch--track {
  width: 42px;
  height: 22px;
}

.ui-switch input {
  position: absolute;
  inset: 0;
  opacity: 0;
  margin: 0;
  cursor: pointer;
}

.ui-switch input:disabled {
  cursor: not-allowed;
}

.ui-switch input:disabled + .ui-switch-track {
  opacity: 0.45;
}

.ui-switch input:disabled + .ui-switch-button {
  opacity: 0.45;
}

.ui-switch-track {
  position: relative;
  width: 100%;
  height: 100%;
  border-radius: 999px;
  border: 1px solid rgba(255, 255, 255, 0.18);
  background: rgba(0, 0, 0, 0.18);
  transition: all 160ms ease;
}

.ui-switch-track::after {
  content: '';
  position: absolute;
  top: 2px;
  left: 2px;
  width: 18px;
  height: 18px;
  border-radius: 999px;
  background: rgba(255, 255, 255, 0.82);
  transition: all 160ms ease;
  box-shadow: 0 6px 14px rgba(0, 0, 0, 0.35);
}

.ui-switch input:checked + .ui-switch-track {
  border-color: rgba(0, 242, 255, 0.55);
  background: rgba(0, 242, 255, 0.16);
  box-shadow: 0 0 12px rgba(0, 242, 255, 0.12);
}

.ui-switch input:checked + .ui-switch-track::after {
  transform: translateX(20px);
  background: rgba(0, 242, 255, 0.95);
}

.ui-switch input:focus-visible + .ui-switch-track {
  outline: 2px solid var(--ui-switch-focus-ring-color);
  outline-offset: var(--ui-switch-focus-ring-offset);
}

.ui-switch--button {
  width: auto;
  height: auto;
}

.ui-switch-button {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  min-height: 28px;
  padding: 0 10px;
  border: 1px solid rgba(255, 255, 255, 0.14);
  border-radius: 999px;
  background: rgba(255, 255, 255, 0.04);
  color: rgba(255, 255, 255, 0.82);
  font-size: 11px;
  line-height: 1;
  transition:
    border-color 160ms ease,
    background 160ms ease,
    color 160ms ease,
    box-shadow 160ms ease,
    opacity 160ms ease;
}

.ui-switch-button :deep(.material-symbols-outlined) {
  font-size: 14px;
}

.ui-switch input:checked + .ui-switch-button {
  border-color: rgba(96, 165, 250, 0.7);
  background: rgba(37, 99, 235, 0.24);
  color: rgba(191, 219, 254, 0.98);
  box-shadow: 0 0 0 1px rgba(59, 130, 246, 0.18);
}

.ui-switch input:focus-visible + .ui-switch-button {
  outline: 2px solid var(--ui-switch-focus-ring-color);
  outline-offset: var(--ui-switch-focus-ring-offset);
}
</style>
