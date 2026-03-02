import { computed } from 'vue';
import { useI18n } from 'vue-i18n';

import { useAppStore } from '../stores/app';
import type { DiskMetrics } from '../types';
import type { OverlayPrefs } from './useOverlayPrefs';
import { mapProgressClass, mapUsageClass, type OverlayMetricBaseColor } from './overlayMetricViewMapper';
import {
  formatCpuDetailLabel,
  formatDiskIoLabel,
  formatDiskPercentLabel,
  formatDiskUsageLabel,
  formatGpuDetailLabel,
  formatHardwareLabel,
  formatMemoryUsageLabel,
  resolveDiskHardwareLabel
} from './overlayMetricsFormatter';
import { formatNetworkLatencyMs, formatNetworkSpeedMbps } from '../utils/networkFormatter';

export function useOverlayMetrics(prefs: OverlayPrefs) {
  const { t } = useI18n();
  const store = useAppStore();
  const snapshot = computed(() => store.snapshot);

  const cpuUsagePct = computed(() => snapshot.value.cpu.usage_pct);
  const gpuUsagePct = computed(() => snapshot.value.gpu.usage_pct ?? 0);
  const memoryUsagePct = computed(() => snapshot.value.memory.usage_pct);
  const disks = computed(() => snapshot.value.disks);
  const cpuPercentLabel = computed(() => `${snapshot.value.cpu.usage_pct.toFixed(1)}%`);
  const gpuPercentLabel = computed(() => `${(snapshot.value.gpu.usage_pct ?? 0).toFixed(1)}%`);
  const memoryPercentLabel = computed(() => `${snapshot.value.memory.usage_pct.toFixed(1)}%`);
  const cpuDetailLabel = computed(() =>
    formatCpuDetailLabel({
      frequencyMhz: snapshot.value.cpu.frequency_mhz,
      maxFrequencyMhz: store.hardwareInfo.cpu_max_freq_mhz,
      temperatureC: snapshot.value.cpu.temperature_c,
      t
    })
  );
  const gpuDetailLabel = computed(() =>
    formatGpuDetailLabel({
      memoryUsedMb: snapshot.value.gpu.memory_used_mb,
      memoryTotalMb: snapshot.value.gpu.memory_total_mb,
      frequencyMhz: snapshot.value.gpu.frequency_mhz,
      t
    })
  );
  const memoryUsageLabel = computed(() => formatMemoryUsageLabel(snapshot.value.memory.used_mb, snapshot.value.memory.total_mb));
  const downloadSpeed = computed(() => formatNetworkSpeedMbps(snapshot.value.network.download_bytes_per_sec, 2));
  const uploadSpeed = computed(() => formatNetworkSpeedMbps(snapshot.value.network.upload_bytes_per_sec, 2));
  const latencyLabel = computed(() => formatNetworkLatencyMs(snapshot.value.network.latency_ms, { naLabel: t('common.na') }));
  const cpuHardwareLabel = computed(() => formatHardwareLabel([store.hardwareInfo.cpu_model], t));
  const gpuHardwareLabel = computed(() => formatHardwareLabel([store.hardwareInfo.gpu_model], t));
  const memoryHardwareLabel = computed(() => formatHardwareLabel([store.hardwareInfo.ram_spec], t));

  const getUsageClass = (value: number, baseColor: OverlayMetricBaseColor) =>
    mapUsageClass(value, prefs.showWarning, baseColor);

  const getProgressClass = (value: number, baseColor: OverlayMetricBaseColor) =>
    mapProgressClass(value, prefs.showWarning, baseColor);

  const diskUsageLabel = (disk: { used_gb: number; total_gb: number }) => formatDiskUsageLabel(disk);

  const diskPercentLabel = (disk: { usage_pct: number }) => formatDiskPercentLabel(disk);

  const diskIoLabel = (disk: { read_bytes_per_sec: number | null; write_bytes_per_sec: number | null }) =>
    formatDiskIoLabel(disk);

  const getDiskHardwareLabel = (disk: DiskMetrics) =>
    resolveDiskHardwareLabel({
      diskName: disk.name,
      totalGb: disk.total_gb,
      diskModels: store.hardwareInfo.disk_models,
      t
    });

  return {
    metrics: {
      cpu: {
        usagePct: cpuUsagePct,
        percentLabel: cpuPercentLabel,
        detailLabel: cpuDetailLabel,
        hardwareLabel: cpuHardwareLabel
      },
      gpu: {
        usagePct: gpuUsagePct,
        percentLabel: gpuPercentLabel,
        detailLabel: gpuDetailLabel,
        hardwareLabel: gpuHardwareLabel
      },
      memory: {
        usagePct: memoryUsagePct,
        percentLabel: memoryPercentLabel,
        usageLabel: memoryUsageLabel,
        hardwareLabel: memoryHardwareLabel
      },
      disks,
      network: { downloadSpeed, uploadSpeed, latencyLabel }
    },
    getUsageClass,
    getProgressClass,
    diskUsageLabel,
    diskPercentLabel,
    diskIoLabel,
    getDiskHardwareLabel
  };
}
