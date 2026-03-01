<template>
  <label class="ui-switch" :aria-label="props.ariaLabel">
    <input
      type="checkbox"
      role="switch"
      :checked="props.modelValue"
      :disabled="props.disabled"
      @change="handleChange" />
    <span class="ui-switch-track" aria-hidden="true"></span>
  </label>
</template>

<script setup lang="ts">
import type { SwitchProps } from './types'

const props = withDefaults(defineProps<SwitchProps>(), {
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
  position: relative;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 42px;
  height: 22px;
  cursor: pointer;
  user-select: none;
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
  outline: 2px solid rgba(0, 242, 255, 0.55);
  outline-offset: 2px;
}
</style>
