<template>
  <input
    class="ui-time-input"
    type="time"
    :value="props.modelValue"
    :disabled="props.disabled"
    :aria-label="props.ariaLabel"
    @input="handleInput" />
</template>

<script setup lang="ts">
import type { TimeInputProps } from './types';

const props = withDefaults(defineProps<TimeInputProps>(), {
  disabled: false
});

const emit = defineEmits<{
  (e: 'update:modelValue', value: string): void;
}>();

function handleInput(event: Event) {
  const target = event.target as HTMLInputElement;
  emit('update:modelValue', target.value);
}
</script>

<style scoped>
.ui-time-input {
  appearance: none;
  width: 100%;
  min-width: 76px;
  min-height: 30px;
  border-radius: 6px;
  border: 1px solid rgba(255, 255, 255, 0.2);
  background: linear-gradient(180deg, rgba(255, 255, 255, 0.06), rgba(0, 0, 0, 0.24));
  color: rgba(255, 255, 255, 0.92);
  padding: 5px 6px;
  font-size: 12px;
  outline: none;
  transition: all 160ms ease;
  -webkit-app-region: no-drag;
}

.ui-time-input:focus {
  border-color: rgba(0, 242, 255, 0.58);
  box-shadow: 0 0 0 2px rgba(0, 242, 255, 0.16);
}

.ui-time-input:disabled {
  opacity: 0.45;
  cursor: not-allowed;
}
</style>
