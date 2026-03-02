<template>
  <div class="overlay-metrics">
    <MetricCard
      v-for="metric in coreMetricCards"
      :key="metric.id"
      :icon="metric.icon"
      :icon-class="metric.iconClass"
      :name="metric.name"
      :detail-label="metric.detailLabel"
      :hardware-label="metric.hardwareLabel"
      :percent-label="metric.percentLabel"
      :usage-pct="metric.usagePct"
      :show-values="prefs.showValues"
      :show-hardware-info="prefs.showHardwareInfo"
      :show-percent="prefs.showPercent"
      :usage-class="props.getUsageClass(metric.usagePct, metric.baseColor)"
      :progress-class="props.getProgressClass(metric.usagePct, metric.baseColor)" />

    <MetricCard
      v-for="metric in diskMetricCards"
      :key="metric.id"
      :icon="metric.icon"
      :icon-class="metric.iconClass"
      :name="metric.name"
      :detail-label="metric.detailLabel"
      :io-label="metric.ioLabel"
      :hardware-label="metric.hardwareLabel"
      :percent-label="metric.percentLabel"
      :usage-pct="metric.usagePct"
      :show-values="prefs.showValues"
      :show-hardware-info="prefs.showHardwareInfo"
      :show-percent="prefs.showPercent"
      :usage-class="props.getUsageClass(metric.usagePct, metric.baseColor)"
      :progress-class="props.getProgressClass(metric.usagePct, metric.baseColor)" />
  </div>
</template>

<script setup lang="ts">
import { computed, unref } from 'vue';
import { useI18n } from 'vue-i18n';
import type { ComputedRef } from 'vue';

import MetricCard from '@/components/overlay/MetricCard.vue';
import type { DiskMetrics } from '../types';
import type { OverlayPrefs } from '../composables/useOverlayPrefs';

type MetricBaseColor = 'cyan' | 'pink';
type MetricCardData = {
  id: string;
  icon: string;
  iconClass: string;
  name: string;
  detailLabel: string;
  hardwareLabel: string;
  percentLabel: string;
  usagePct: number;
  baseColor: MetricBaseColor;
  ioLabel?: string;
};

interface MetricsPack {
  cpu: {
    usagePct: ComputedRef<number>;
    percentLabel: ComputedRef<string>;
    detailLabel: ComputedRef<string>;
    hardwareLabel: ComputedRef<string>;
  };
  gpu: {
    usagePct: ComputedRef<number>;
    percentLabel: ComputedRef<string>;
    detailLabel: ComputedRef<string>;
    hardwareLabel: ComputedRef<string>;
  };
  memory: {
    usagePct: ComputedRef<number>;
    percentLabel: ComputedRef<string>;
    usageLabel: ComputedRef<string>;
    hardwareLabel: ComputedRef<string>;
  };
  disks: ComputedRef<DiskMetrics[]>;
}

const props = defineProps<{
  prefs: OverlayPrefs;
  metrics: MetricsPack;
  getUsageClass: (value: number, baseColor: MetricBaseColor) => string;
  getProgressClass: (value: number, baseColor: MetricBaseColor) => string;
  diskUsageLabel: (disk: { used_gb: number; total_gb: number }) => string;
  diskPercentLabel: (disk: { usage_pct: number }) => string;
  diskIoLabel: (disk: { read_bytes_per_sec: number | null; write_bytes_per_sec: number | null }) => string;
  getDiskHardwareLabel: (disk: DiskMetrics) => string;
}>();

const { t } = useI18n();
const diskList = computed(() => unref(props.metrics.disks));

const coreMetricCards = computed<MetricCardData[]>(() => {
  const cards: MetricCardData[] = [];
  if (props.prefs.showCpu) {
    cards.push({
      id: 'cpu',
      icon: 'memory',
      iconClass: 'overlay-icon--cpu',
      name: t('overlay.cpu'),
      detailLabel: unref(props.metrics.cpu.detailLabel),
      hardwareLabel: unref(props.metrics.cpu.hardwareLabel),
      percentLabel: unref(props.metrics.cpu.percentLabel),
      usagePct: unref(props.metrics.cpu.usagePct),
      baseColor: 'cyan'
    });
  }
  if (props.prefs.showGpu) {
    cards.push({
      id: 'gpu',
      icon: 'developer_board',
      iconClass: 'overlay-icon--gpu',
      name: t('overlay.gpu'),
      detailLabel: unref(props.metrics.gpu.detailLabel),
      hardwareLabel: unref(props.metrics.gpu.hardwareLabel),
      percentLabel: unref(props.metrics.gpu.percentLabel),
      usagePct: unref(props.metrics.gpu.usagePct),
      baseColor: 'pink'
    });
  }
  if (props.prefs.showMemory) {
    cards.push({
      id: 'memory',
      icon: 'memory_alt',
      iconClass: 'overlay-icon--cpu',
      name: t('overlay.memory'),
      detailLabel: unref(props.metrics.memory.usageLabel),
      hardwareLabel: unref(props.metrics.memory.hardwareLabel),
      percentLabel: unref(props.metrics.memory.percentLabel),
      usagePct: unref(props.metrics.memory.usagePct),
      baseColor: 'cyan'
    });
  }
  return cards;
});

const diskMetricCards = computed<MetricCardData[]>(() => {
  if (!props.prefs.showDisk) {
    return [];
  }
  return diskList.value.map(disk => ({
    id: `disk-${disk.name}`,
    icon: 'hard_drive',
    iconClass: 'overlay-icon--cpu',
    name: disk.name,
    detailLabel: props.diskUsageLabel(disk),
    ioLabel: props.diskIoLabel(disk),
    hardwareLabel: props.getDiskHardwareLabel(disk),
    percentLabel: props.diskPercentLabel(disk),
    usagePct: disk.usage_pct,
    baseColor: 'pink'
  }));
});
</script>
