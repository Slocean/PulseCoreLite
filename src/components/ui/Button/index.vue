<template>
  <button
    class="ui-button"
    :class="[
      `ui-button--${props.type}`,
      `ui-button--${props.size}`,
      `ui-button--${props.variant}`,
      presetClass,
      {
        'ui-button--loading': props.loading,
        'ui-button--active': props.active
      }
    ]"
    :style="buttonStyle"
    :type="props.nativeType"
    :disabled="isDisabled">
    <span v-if="props.loading" class="ui-button__spinner" aria-hidden="true"></span>
    <span class="ui-button__content">
      <slot />
    </span>
  </button>
</template>

<script setup lang="ts">
import { computed } from 'vue';
import type { CSSProperties } from 'vue';
import type { ButtonProps } from './types';
import { resolveButtonPresetClass } from './presets';

const props = withDefaults(defineProps<ButtonProps>(), {
  type: 'default',
  size: 'md',
  variant: 'solid',
  preset: 'default',
  nativeType: 'button',
  disabled: false,
  loading: false,
  active: false
});

const isDisabled = computed(() => props.disabled || props.loading);
const presetClass = computed(() => resolveButtonPresetClass(props.preset));
const buttonStyle = computed<CSSProperties | undefined>(() => {
  if (props.width === undefined || props.width === null || props.width === '') return undefined;
  return {
    width: typeof props.width === 'number' ? `${props.width}px` : props.width
  } as CSSProperties;
});
</script>

<style scoped src="./button.tokens.css"></style>
<style scoped src="./button.presets.css"></style>
