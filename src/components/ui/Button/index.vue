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
</script>

<style scoped src="./button.tokens.css"></style>
<style scoped src="./button.presets.css"></style>

