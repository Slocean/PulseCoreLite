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
      @input="handleInput" />
  </div>
</template>

<script setup lang="ts">
import type { RangeProps } from './types'

const props = withDefaults(defineProps<RangeProps>(), {
  min: 0,
  max: 100,
  step: 1,
  disabled: false
})

const emit = defineEmits<{
  (e: 'update:modelValue', value: number): void
}>()

function handleInput(event: Event) {
  const target = event.target as HTMLInputElement
  emit('update:modelValue', Number(target.value))
}
</script>

<style scoped>
.ui-range {
  display: flex;
  flex-direction: row;
  align-items: center;
}

.ui-range-label {
  font-size: 12px;
  color: rgba(255, 255, 255, 0.86);
}

.ui-range-value {
  font-size: 10px;
  color: rgba(255, 255, 255, 0.6);
  line-height: 1;
  margin-left: 8px;
  margin-right: 12px;
  width: 40px;
  text-align: right;
  font-variant-numeric: tabular-nums;
  font-feature-settings: 'tnum';
}

.ui-range input[type='range'] {
  width: 130px;
  accent-color: var(--cyan);
  margin: 0;
  display: block;
  cursor: pointer;
}

.ui-range input[type='range']:disabled {
  opacity: 0.45;
  cursor: not-allowed;
}
</style>
