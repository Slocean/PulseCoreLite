<template>
  <div class="ui-progress">
    <span
      class="ui-progress-fill"
      :class="`ui-progress-fill--${props.color ?? 'cyan'}`"
      :style="{ width: `${clampedValue}%` }"></span>
  </div>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import type { ProgressBarProps } from './types'

const props = withDefaults(defineProps<ProgressBarProps>(), {
  color: 'cyan'
})

const clampedValue = computed(() => Math.min(100, Math.max(0, props.value)))
</script>

<style scoped>
.ui-progress {
  position: relative;
  height: 6px;
  border-radius: 999px;
  background: rgba(255, 255, 255, 0.08);
  overflow: hidden;
}

.ui-progress::after {
  content: '';
  position: absolute;
  inset: 0;
  pointer-events: none;
  background-image: linear-gradient(90deg, transparent 75%, rgba(0, 0, 0, 0.55) 75%);
  background-size: 8px 100%;
  opacity: 0.6;
  z-index: 2;
}

.ui-progress-fill {
  display: block;
  height: 100%;
  border-radius: inherit;
  position: relative;
  z-index: 1;
  transition: width 300ms ease;
}

.ui-progress-fill--cyan {
  background: linear-gradient(to right, #2b6cee, var(--cyan));
  box-shadow: 0 0 14px rgba(0, 242, 255, 0.35);
}

.ui-progress-fill--pink {
  background: linear-gradient(to right, #7c3aed, var(--pink));
  box-shadow: 0 0 14px rgba(188, 19, 254, 0.35);
}

.ui-progress-fill--orange {
  background: linear-gradient(to right, #eab308, var(--orange));
  box-shadow: 0 0 14px rgba(255, 165, 0, 0.35);
}

.ui-progress-fill--red {
  background: linear-gradient(to right, #ef4444, var(--red));
  box-shadow: 0 0 14px rgba(255, 59, 59, 0.35);
}
</style>
