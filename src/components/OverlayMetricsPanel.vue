<template>
  <div class="overlay-metrics">
    <div v-if="prefs.showCpu" class="overlay-metric">
      <div class="overlay-metric-top">
        <div class="overlay-metric-label">
          <span class="material-symbols-outlined overlay-icon overlay-icon--cpu">memory</span>
          <div class="overlay-metric-text">
            <div class="overlay-metric-name-row">
              <span class="overlay-metric-name">{{ t('overlay.cpu') }}</span>
              <span v-if="prefs.showValues" class="overlay-metric-detail">{{ metrics.cpu.detailLabel }}</span>
            </div>
            <span v-if="prefs.showHardwareInfo" class="overlay-metric-hardware">
              {{ metrics.cpu.hardwareLabel }}
            </span>
          </div>
        </div>
        <span
          v-if="prefs.showPercent"
          class="overlay-metric-value"
          :class="usageClass(metrics.cpu.usagePct, 'cyan')">
          {{ metrics.cpu.percentLabel }}
        </span>
      </div>
      <div class="overlay-progress">
        <span
          class="overlay-progress-fill"
          :class="progressClass(metrics.cpu.usagePct, 'cyan')"
          :style="{ width: `${usageValue(metrics.cpu.usagePct)}%` }"></span>
      </div>
    </div>

    <div v-if="prefs.showGpu" class="overlay-metric">
      <div class="overlay-metric-top">
        <div class="overlay-metric-label">
          <span class="material-symbols-outlined overlay-icon overlay-icon--gpu">developer_board</span>
          <div class="overlay-metric-text">
            <div class="overlay-metric-name-row">
              <span class="overlay-metric-name">{{ t('overlay.gpu') }}</span>
              <span v-if="prefs.showValues" class="overlay-metric-detail">{{ metrics.gpu.detailLabel }}</span>
            </div>
            <span v-if="prefs.showHardwareInfo" class="overlay-metric-hardware">
              {{ metrics.gpu.hardwareLabel }}
            </span>
          </div>
        </div>
        <span
          v-if="prefs.showPercent"
          class="overlay-metric-value"
          :class="usageClass(metrics.gpu.usagePct, 'pink')">
          {{ metrics.gpu.percentLabel }}
        </span>
      </div>
      <div class="overlay-progress">
        <span
          class="overlay-progress-fill"
          :class="progressClass(metrics.gpu.usagePct, 'pink')"
          :style="{ width: `${usageValue(metrics.gpu.usagePct)}%` }"></span>
      </div>
    </div>

    <div v-if="prefs.showMemory" class="overlay-metric">
      <div class="overlay-metric-top">
        <div class="overlay-metric-label">
          <span class="material-symbols-outlined overlay-icon overlay-icon--cpu">memory_alt</span>
          <div class="overlay-metric-text">
            <div class="overlay-metric-name-row">
              <span class="overlay-metric-name">{{ t('overlay.memory') }}</span>
              <span v-if="prefs.showValues" class="overlay-metric-detail">{{ metrics.memory.usageLabel }}</span>
            </div>
            <span v-if="prefs.showHardwareInfo" class="overlay-metric-hardware">
              {{ metrics.memory.hardwareLabel }}
            </span>
          </div>
        </div>
        <span
          v-if="prefs.showPercent"
          class="overlay-metric-value"
          :class="usageClass(metrics.memory.usagePct, 'cyan')">
          {{ metrics.memory.percentLabel }}
        </span>
      </div>
      <div class="overlay-progress">
        <span
          class="overlay-progress-fill"
          :class="progressClass(metrics.memory.usagePct, 'cyan')"
          :style="{ width: `${usageValue(metrics.memory.usagePct)}%` }"></span>
      </div>
    </div>

    <template v-if="prefs.showDisk">
      <div v-for="disk in diskList" :key="disk.name" class="overlay-metric">
        <div class="overlay-metric-top">
          <div class="overlay-metric-label">
            <span class="material-symbols-outlined overlay-icon overlay-icon--cpu">hard_drive</span>
            <div class="overlay-metric-text">
              <div class="overlay-metric-name-row">
                <span class="overlay-metric-name">{{ disk.name }}</span>
                <span v-if="prefs.showValues" class="overlay-metric-detail">{{ diskUsageLabel(disk) }}</span>
              </div>
              <div v-if="prefs.showValues" class="overlay-metric-io">{{ diskIoLabel(disk) }}</div>
              <span v-if="prefs.showHardwareInfo" class="overlay-metric-hardware">
                {{ getDiskHardwareLabel(disk) }}
              </span>
            </div>
          </div>
          <span v-if="prefs.showPercent" class="overlay-metric-value" :class="usageClass(disk.usage_pct, 'pink')">
            {{ diskPercentLabel(disk) }}
          </span>
        </div>
        <div class="overlay-progress">
          <span
            class="overlay-progress-fill"
            :class="progressClass(disk.usage_pct, 'pink')"
            :style="{ width: `${disk.usage_pct}%` }"></span>
        </div>
      </div>
    </template>
  </div>
</template>

<script setup lang="ts">
import { computed, unref } from 'vue'
import { useI18n } from 'vue-i18n'
import type { ComputedRef } from 'vue'

import type { DiskMetrics } from '../types'
import type { OverlayPrefs } from '../composables/useOverlayPrefs'

interface MetricsPack {
  cpu: {
    usagePct: ComputedRef<number>
    percentLabel: ComputedRef<string>
    detailLabel: ComputedRef<string>
    hardwareLabel: ComputedRef<string>
  }
  gpu: {
    usagePct: ComputedRef<number>
    percentLabel: ComputedRef<string>
    detailLabel: ComputedRef<string>
    hardwareLabel: ComputedRef<string>
  }
  memory: {
    usagePct: ComputedRef<number>
    percentLabel: ComputedRef<string>
    usageLabel: ComputedRef<string>
    hardwareLabel: ComputedRef<string>
  }
  disks: ComputedRef<DiskMetrics[]>
}

const props = defineProps<{
  prefs: OverlayPrefs
  metrics: MetricsPack
  getUsageClass: (value: number, baseColor: 'cyan' | 'pink') => string
  getProgressClass: (value: number, baseColor: 'cyan' | 'pink') => string
  diskUsageLabel: (disk: { used_gb: number; total_gb: number }) => string
  diskPercentLabel: (disk: { usage_pct: number }) => string
  diskIoLabel: (disk: { read_bytes_per_sec: number | null; write_bytes_per_sec: number | null }) => string
  getDiskHardwareLabel: (disk: DiskMetrics) => string
}>()

const { t } = useI18n()
const diskList = computed(() => unref(props.metrics.disks))
const usageValue = (value: number | ComputedRef<number>) => unref(value)
const usageClass = (value: number | ComputedRef<number>, color: 'cyan' | 'pink') =>
  props.getUsageClass(unref(value), color)
const progressClass = (value: number | ComputedRef<number>, color: 'cyan' | 'pink') =>
  props.getProgressClass(unref(value), color)
</script>
