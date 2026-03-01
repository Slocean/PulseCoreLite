<template>
  <label class="ui-checkbox" :class="{ 'ui-checkbox--disabled': props.disabled }">
    <input
      type="checkbox"
      :checked="isChecked"
      :disabled="props.disabled"
      @change="handleChange" />
    <span class="ui-checkbox-box" aria-hidden="true">
      <span class="ui-checkbox-check"></span>
    </span>
    <slot />
  </label>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import type { CheckboxProps, CheckboxModelValue, CheckboxValue } from './types'

const props = withDefaults(defineProps<CheckboxProps>(), {
  disabled: false
})

const emit = defineEmits<{
  (e: 'update:modelValue', value: CheckboxModelValue): void
}>()

const isChecked = computed(() => {
  if (Array.isArray(props.modelValue)) {
    return props.value !== undefined && props.modelValue.includes(props.value)
  }
  return props.modelValue === true
})

function handleChange(event: Event) {
  const checked = (event.target as HTMLInputElement).checked
  if (Array.isArray(props.modelValue)) {
    const next = [...props.modelValue] as CheckboxValue[]
    if (checked && props.value !== undefined) {
      next.push(props.value)
    } else {
      const idx = props.value !== undefined ? next.indexOf(props.value) : -1
      if (idx !== -1) next.splice(idx, 1)
    }
    emit('update:modelValue', next)
  } else {
    emit('update:modelValue', checked)
  }
}
</script>

<style scoped>
.ui-checkbox {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  font-size: 12px;
  color: rgba(255, 255, 255, 0.86);
  cursor: pointer;
  user-select: none;
}

.ui-checkbox--disabled {
  opacity: 0.45;
  cursor: not-allowed;
}

.ui-checkbox input {
  position: absolute;
  opacity: 0;
  width: 0;
  height: 0;
  margin: 0;
  pointer-events: none;
}

.ui-checkbox-box {
  position: relative;
  flex-shrink: 0;
  width: 14px;
  height: 14px;
  border-radius: 3px;
  border: 1px solid rgba(255, 255, 255, 0.3);
  background: rgba(0, 0, 0, 0.2);
  transition: all 160ms ease;
}

.ui-checkbox input:checked ~ .ui-checkbox-box {
  border-color: rgba(0, 242, 255, 0.7);
  background: rgba(0, 242, 255, 0.18);
}

.ui-checkbox input:focus-visible ~ .ui-checkbox-box {
  outline: 2px solid rgba(0, 242, 255, 0.55);
  outline-offset: 2px;
}

.ui-checkbox-check {
  display: block;
  position: absolute;
  inset: 0;
  margin: auto;
  width: 8px;
  height: 5px;
  border-left: 1.5px solid rgba(0, 242, 255, 0.95);
  border-bottom: 1.5px solid rgba(0, 242, 255, 0.95);
  transform: rotate(-45deg) translateY(-1px);
  opacity: 0;
  transition: opacity 120ms ease;
}

.ui-checkbox input:checked ~ .ui-checkbox-box .ui-checkbox-check {
  opacity: 1;
}
</style>
