<template>
  <button
    class="ui-button"
    :class="[
      `ui-button--${props.type}`,
      `ui-button--${props.size}`,
      `ui-button--${props.variant}`,
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
import { computed } from 'vue'
import type { ButtonProps } from './types'

const props = withDefaults(defineProps<ButtonProps>(), {
  type: 'default',
  size: 'md',
  variant: 'solid',
  nativeType: 'button',
  disabled: false,
  loading: false,
  active: false
})

const isDisabled = computed(() => props.disabled || props.loading)
</script>

<style scoped>
:where(.ui-button) {
  --btn-height: 28px;
  --btn-padding: 0 10px;
  --btn-radius: 8px;
  --btn-bg: rgba(255, 255, 255, 0.08);
  --btn-border-color: rgba(255, 255, 255, 0.18);
  --btn-border-style: solid;
  --btn-border-width: 1px;
  --btn-color: rgba(255, 255, 255, 0.85);
  --btn-font-size: 12px;
  --btn-letter-spacing: 0.05em;
  --btn-text-transform: none;
  --btn-gap: 6px;

  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: var(--btn-gap);
  height: var(--btn-height);
  padding: var(--btn-padding);
  border-radius: var(--btn-radius);
  border: var(--btn-border-width) var(--btn-border-style) var(--btn-border-color);
  background: var(--btn-bg);
  color: var(--btn-color);
  font-size: var(--btn-font-size);
  letter-spacing: var(--btn-letter-spacing);
  text-transform: var(--btn-text-transform);
  cursor: pointer;
  transition: opacity 0.2s, transform 0.1s, border-color 0.16s, color 0.16s, background 0.16s;
}

:where(.ui-button--sm) {
  --btn-height: 24px;
  --btn-padding: 0 8px;
  --btn-font-size: 11px;
}

:where(.ui-button--lg) {
  --btn-height: 34px;
  --btn-padding: 0 14px;
  --btn-font-size: 13px;
}

:where(.ui-button--solid) {
  --btn-border-style: solid;
}

:where(.ui-button--dashed) {
  --btn-border-style: dashed;
  --btn-bg: transparent;
  --btn-text-transform: uppercase;
  --btn-letter-spacing: 0.1em;
}

:where(.ui-button--text) {
  --btn-border-color: transparent;
  --btn-bg: transparent;
  --btn-padding: 0;
  --btn-height: auto;
}

:where(.ui-button--icon) {
  --btn-border-color: transparent;
  --btn-bg: transparent;
  --btn-padding: 0;
  width: var(--btn-height);
}

:where(.ui-button--default) {
  --btn-border-color: rgba(255, 255, 255, 0.18);
  --btn-color: rgba(255, 255, 255, 0.7);
}

:where(.ui-button--primary) {
  --btn-border-color: rgba(59, 130, 246, 0.6);
  --btn-color: #93c5fd;
  --btn-bg: rgba(59, 130, 246, 0.12);
}

:where(.ui-button--danger) {
  --btn-border-color: rgba(255, 59, 59, 0.45);
  --btn-color: #ff9a9a;
  --btn-bg: rgba(255, 59, 59, 0.08);
}

:where(.ui-button--ghost) {
  --btn-border-color: rgba(255, 255, 255, 0.18);
  --btn-color: rgba(255, 255, 255, 0.6);
  --btn-bg: transparent;
}

:where(.ui-button--active) {
  border-color: var(--btn-active-border, var(--cyan, #00f2ff));
  color: var(--btn-active-color, var(--cyan, #00f2ff));
}

:where(.ui-button):hover:not(:disabled) {
  opacity: 0.9;
}

:where(.ui-button--primary):hover:not(:disabled) {
  border-color: rgba(59, 130, 246, 0.85);
  color: #dbeafe;
}

:where(.ui-button--danger):hover:not(:disabled) {
  border-color: rgba(255, 59, 59, 0.7);
  color: #ffd2d2;
}

:where(.ui-button):disabled {
  opacity: 0.45;
  cursor: not-allowed;
}

.ui-button__spinner {
  width: 12px;
  height: 12px;
  border-radius: 999px;
  border: 2px solid currentColor;
  border-right-color: transparent;
  animation: ui-button-spin 0.8s linear infinite;
}

.ui-button__content {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: 6px;
}

@keyframes ui-button-spin {
  to {
    transform: rotate(360deg);
  }
}
</style>
