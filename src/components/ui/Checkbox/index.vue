<template>
  <label class="ui-checkbox" :class="{ 'ui-checkbox--disabled': props.disabled }">
    <input
      type="checkbox"
      :id="props.inputId"
      :checked="isChecked"
      :disabled="props.disabled"
      :aria-label="ariaLabel"
      :aria-description="ariaDescription"
      :aria-describedby="ariaDescribedBy"
      @keydown="handleKeydown"
      @change="handleChange" />
    <span class="ui-checkbox-box" aria-hidden="true">
      <span class="ui-checkbox-check"></span>
    </span>
    <slot />
  </label>
</template>

<script setup lang="ts">
import { computed } from 'vue';

import {
  createNextCheckboxModelValue,
  isCheckboxChecked,
  shouldToggleCheckboxOnKeydown
} from './logic';
import type { CheckboxProps, CheckboxModelValue } from './types';

const props = withDefaults(defineProps<CheckboxProps>(), {
  disabled: false
});

const emit = defineEmits<{
  (e: 'update:modelValue', value: CheckboxModelValue): void;
}>();

const isChecked = computed(() => isCheckboxChecked(props.modelValue, props.value));
const ariaLabel = computed(() => props.ariaLabel ?? props.a11y?.ariaLabel);
const ariaDescription = computed(() => props.ariaDescription ?? props.a11y?.ariaDescription);
const ariaDescribedBy = computed(() => {
  const ids = [props.describedBy ?? props.a11y?.describedBy].filter((value): value is string =>
    Boolean(value?.trim())
  );
  return ids.length ? ids.join(' ') : undefined;
});

function handleChange(event: Event) {
  const checked = (event.target as HTMLInputElement).checked;
  const next = createNextCheckboxModelValue(props.modelValue, props.value, checked);
  emit('update:modelValue', next);
}

function handleKeydown(event: KeyboardEvent) {
  if (!shouldToggleCheckboxOnKeydown(event.key)) return;
  event.preventDefault();
  const input = event.target as HTMLInputElement | null;
  if (!input || input.disabled) return;
  input.checked = !input.checked;
  input.dispatchEvent(new Event('change', { bubbles: true }));
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
