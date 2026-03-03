<template>
  <div class="overlay-metric">
    <div class="overlay-metric-top">
      <div class="overlay-metric-label">
        <span class="material-symbols-outlined overlay-icon" :class="iconClass">{{ icon }}</span>
        <div class="overlay-metric-text">
          <div class="overlay-metric-name-row">
            <span class="overlay-metric-name">{{ name }}</span>
            <span v-if="showValues" class="overlay-metric-detail">{{ detailLabel }}</span>
          </div>
          <div v-if="showValues && ioLabel" class="overlay-metric-io">{{ ioLabel }}</div>
          <span v-if="showHardwareInfo" class="overlay-metric-hardware">
            {{ hardwareLabel }}
          </span>
        </div>
      </div>
      <span v-if="showPercent" class="overlay-metric-value" :class="usageClass">
        {{ percentLabel }}
      </span>
    </div>
    <div class="overlay-progress">
      <span class="overlay-progress-fill" :class="progressClass" :style="{ width: `${usagePct}%` }"></span>
    </div>
  </div>
</template>

<script setup lang="ts">
defineProps<{
  icon: string;
  iconClass?: string;
  name: string;
  detailLabel: string;
  ioLabel?: string;
  hardwareLabel: string;
  percentLabel: string;
  usagePct: number;
  showValues: boolean;
  showHardwareInfo: boolean;
  showPercent: boolean;
  usageClass: string;
  progressClass: string;
}>();
</script>
