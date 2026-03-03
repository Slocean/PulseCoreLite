<template>
  <div class="ui-range">
    <slot name="label">
      <span v-if="props.label" class="ui-range-label">{{ props.label }}</span>
    </slot>
    <span class="ui-range-value">
      {{ props.modelValue }}{{ props.unit ?? '' }}
    </span>
    <input
      type="range"
      :min="props.min"
      :max="props.max"
      :step="props.step"
      :value="props.modelValue"
      :disabled="props.disabled"
      :aria-label="props.ariaLabel ?? props.label"
      @input="handleInput" />
  </div>
</template>

<script setup lang="ts">
import type { RangeProps } from './types';

const props = withDefaults(defineProps<RangeProps>(), {
  min: 0,
  max: 100,
  step: 1,
  disabled: false
});

const emit = defineEmits<{
  (e: 'update:modelValue', value: number): void;
}>();

function handleInput(event: Event) {
  const target = event.target as HTMLInputElement;
  emit('update:modelValue', Number(target.value));
}
</script>

<style scoped>
.ui-range {
  --ui-range-label-color: rgba(255, 255, 255, 0.86);
  --ui-range-value-color: rgba(255, 255, 255, 0.6);
  --ui-range-width: 130px;
  --ui-range-accent-color: var(--cyan);
  display: flex;
  flex-direction: row;
  align-items: center;
}

.ui-range-label {
  font-size: 12px;
  color: var(--ui-range-label-color);
}

.ui-range-value {
  font-size: 10px;
  color: var(--ui-range-value-color);
  line-height: 1;
  margin-left: 8px;
  margin-right: 12px;
  width: 40px;
  text-align: right;
  font-variant-numeric: tabular-nums;
  font-feature-settings: 'tnum';
}

.ui-range input[type='range'] {
  width: var(--ui-range-width);
  accent-color: var(--ui-range-accent-color);
  margin: 0;
  display: block;
  cursor: pointer;
}

.ui-range input[type='range']:disabled {
  opacity: 0.45;
  cursor: not-allowed;
}
</style>
