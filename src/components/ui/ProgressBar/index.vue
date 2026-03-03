<template>
  <div class="ui-progress">
    <span
      class="ui-progress-fill"
      :class="`ui-progress-fill--${props.color ?? 'cyan'}`"
      :style="{ width: `${clampedValue}%` }"></span>
  </div>
</template>

<script setup lang="ts">
import { computed } from 'vue';
import type { ProgressBarProps } from './types';

const props = withDefaults(defineProps<ProgressBarProps>(), {
  color: 'cyan'
});

const clampedValue = computed(() => Math.min(100, Math.max(0, props.value)));
</script>

<style scoped>
.ui-progress {
  position: relative;
  height: 6px;
  border-radius: 999px;
  background: var(--ui-progress-track-bg);
  overflow: hidden;
}

.ui-progress::after {
  content: '';
  position: absolute;
  inset: 0;
  pointer-events: none;
  background-image: var(--ui-progress-track-overlay);
  background-size: 8px 100%;
  opacity: var(--ui-progress-track-overlay-opacity);
  z-index: 2;
}

.ui-progress-fill {
  display: block;
  height: 100%;
  border-radius: inherit;
  position: relative;
  z-index: 1;
  transition: width 300ms ease;
  background: var(--ui-progress-fill);
  box-shadow: var(--ui-progress-glow);
}
</style>

<style scoped src="./progress.tokens.css"></style>
