<template>
  <span class="ui-usage-value" :class="glowClass">{{ props.label }}</span>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import { DEFAULT_METRIC_WARNING_THRESHOLDS, resolveMetricWarningLevel } from '@/composables/metricWarningPolicy'
import type { UsageValueProps } from './types'

const props = withDefaults(defineProps<UsageValueProps>(), {
  baseColor: 'cyan',
  showWarning: true,
  warningThresholds: () => ({ ...DEFAULT_METRIC_WARNING_THRESHOLDS })
})

const glowClass = computed(() => {
  if (!props.showWarning) return `ui-glow-${props.baseColor}`
  const level = resolveMetricWarningLevel(props.value, props.warningThresholds)
  if (level === 'danger') return 'ui-glow-red'
  if (level === 'warning') return 'ui-glow-orange'
  return `ui-glow-${props.baseColor}`
})
</script>

<style scoped>
.ui-usage-value {
  font-size: 14px;
  font-weight: 700;
  font-variant-numeric: tabular-nums;
  font-feature-settings: 'tnum';
}

.ui-glow-cyan {
  color: var(--cyan);
  text-shadow: 0 0 10px rgba(0, 242, 255, 0.7);
}

.ui-glow-pink {
  color: var(--pink);
  text-shadow: 0 0 10px rgba(188, 19, 254, 0.7);
}

.ui-glow-orange {
  color: var(--orange);
  text-shadow: 0 0 10px rgba(255, 165, 0, 0.7);
}

.ui-glow-red {
  color: var(--red);
  text-shadow: 0 0 10px rgba(255, 59, 59, 0.7);
}
</style>
