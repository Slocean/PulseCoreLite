import { computed } from 'vue';
import { useI18n } from 'vue-i18n';

import { useAppStore } from '../stores/app';
import type { DiskMetrics } from '../types';
import type { OverlayPrefs } from './useOverlayPrefs';

export function useOverlayMetrics(prefs: OverlayPrefs) {
  const { t } = useI18n();
  const store = useAppStore();
  const snapshot = computed(() => store.snapshot);

  const cpuUsagePct = computed(() => snapshot.value.cpu.usage_pct);
  const gpuUsagePct = computed(() => snapshot.value.gpu.usage_pct ?? 0);
  const memoryUsagePct = computed(() => snapshot.value.memory.usage_pct);
  const disks = computed(() => snapshot.value.disks);
  const cpuPercentLabel = computed(() => `${snapshot.value.cpu.usage_pct.toFixed(1)}%`);
  const gpuPercentLabel = computed(() =>
    snapshot.value.gpu.usage_pct == null ? t('common.na') : `${snapshot.value.gpu.usage_pct.toFixed(1)}%`
  );
  const memoryPercentLabel = computed(() => `${snapshot.value.memory.usage_pct.toFixed(1)}%`);
  const cpuDetailLabel = computed(() => {
    const parts: string[] = [];
    const freq = snapshot.value.cpu.frequency_mhz;
    const maxFreq = store.hardwareInfo.cpu_max_freq_mhz;

    if (typeof freq === 'number' && typeof maxFreq === 'number') {
      parts.push(formatCpuFreqPair(freq, maxFreq));
    } else if (typeof freq === 'number') {
      parts.push(formatCpuFreq(freq));
    }

    if (snapshot.value.cpu.temperature_c) {
      parts.push(`${snapshot.value.cpu.temperature_c.toFixed(0)}°C`);
    }
    return parts.length > 0 ? parts.join(' · ') : t('common.na');
  });
  const gpuDetailLabel = computed(() => {
    const parts: string[] = [];
    if (snapshot.value.gpu.memory_used_mb != null && snapshot.value.gpu.memory_total_mb != null) {
      parts.push(
        `${t('overlay.vram')} ${snapshot.value.gpu.memory_used_mb.toFixed(0)}/${snapshot.value.gpu.memory_total_mb.toFixed(0)} MB`
      );
    }
    if (snapshot.value.gpu.frequency_mhz != null && Number.isFinite(snapshot.value.gpu.frequency_mhz)) {
      parts.push(`${t('overlay.freq')} ${formatGpuFreq(snapshot.value.gpu.frequency_mhz)}`);
    }
    return parts.length > 0 ? parts.join(' · ') : t('common.na');
  });
  const memoryUsageLabel = computed(() => {
    const used = (snapshot.value.memory.used_mb / 1024).toFixed(1);
    const total = (snapshot.value.memory.total_mb / 1024).toFixed(0);
    return `${used}/${total} GB`;
  });
  const downloadSpeed = computed(() => (snapshot.value.network.download_bytes_per_sec / 1024 / 1024).toFixed(2));
  const uploadSpeed = computed(() => (snapshot.value.network.upload_bytes_per_sec / 1024 / 1024).toFixed(2));
  const latencyLabel = computed(() => {
    const value = snapshot.value.network.latency_ms ?? null;
    return value == null ? t('common.na') : `${value.toFixed(0)} ms`;
  });
  const cpuHardwareLabel = computed(() => formatHardwareLabel([store.hardwareInfo.cpu_model], t));
  const gpuHardwareLabel = computed(() => formatHardwareLabel([store.hardwareInfo.gpu_model], t));
  const memoryHardwareLabel = computed(() => formatHardwareLabel([store.hardwareInfo.ram_spec], t));

  const getUsageClass = (value: number, baseColor: 'cyan' | 'pink') => {
    if (!prefs.showWarning) {
      return `overlay-glow-${baseColor}`;
    }
    if (value > 85) {
      return 'overlay-glow-red';
    }
    if (value > 75) {
      return 'overlay-glow-orange';
    }
    return `overlay-glow-${baseColor}`;
  };

  const getProgressClass = (value: number, baseColor: 'cyan' | 'pink') => {
    if (!prefs.showWarning) {
      return `overlay-progress-fill--${baseColor}`;
    }
    if (value > 85) {
      return 'overlay-progress-fill--red';
    }
    if (value > 75) {
      return 'overlay-progress-fill--orange';
    }
    return `overlay-progress-fill--${baseColor}`;
  };

  const diskUsageLabel = (disk: { used_gb: number; total_gb: number }) =>
    `${disk.used_gb.toFixed(0)}/${disk.total_gb.toFixed(0)} GB`;

  const diskPercentLabel = (disk: { usage_pct: number }) => `${disk.usage_pct.toFixed(1)}%`;

  const diskIoLabel = (disk: { read_bytes_per_sec: number | null; write_bytes_per_sec: number | null }) => {
    const read = ((disk.read_bytes_per_sec || 0) / 1024 / 1024).toFixed(1);
    const write = ((disk.write_bytes_per_sec || 0) / 1024 / 1024).toFixed(1);
    return `R: ${read} MB/s · W: ${write} MB/s`;
  };

  const getDiskHardwareLabel = (disk: DiskMetrics) => {
    const mountPoint = disk.name;
    const driveLetter = mountPoint.replace(/[\\/]$/, '');
    const match = store.hardwareInfo.disk_models.find(
      modelStr => modelStr.startsWith(driveLetter + ' ') || modelStr.startsWith(driveLetter + '·')
    );

    let modelName = t('common.na');

    if (match) {
      const parts = match.split('·');
      if (parts.length > 1) {
        const rawModel = parts.slice(1).join('·');
        modelName = normalizeHardwareModel(rawModel);
      } else {
        modelName = normalizeHardwareModel(match);
      }
    }

    return `${modelName} · ${disk.total_gb.toFixed(0)} GB`;
  };

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

function formatGpuFreq(value: number) {
  return `${(value / 1000).toFixed(2)} GHz`;
}

function formatCpuFreq(valueMhz: number) {
  if (valueMhz >= 1000) return `${(valueMhz / 1000).toFixed(1)}GHz`;
  return `${valueMhz.toFixed(0)}MHz`;
}

function formatCpuFreqPair(freqMhz: number, maxMhz: number) {
  // If the "current" reading is effectively equal to max, don't show a redundant pair.
  // Some platforms only report max frequency here, which would otherwise render like "3.2/3.2".
  if (Math.abs(freqMhz - maxMhz) < 1) {
    return formatCpuFreq(freqMhz);
  }
  const useGhz = Math.max(freqMhz, maxMhz) >= 1000;
  if (useGhz) return `${(freqMhz / 1000).toFixed(1)}GHz/${(maxMhz / 1000).toFixed(1)}GHz`;
  return `${freqMhz.toFixed(0)}MHz/${maxMhz.toFixed(0)}MHz`;
}

function normalizeHardwareModel(value: string) {
  const trimmed = value.trim();
  if (!trimmed) {
    return '';
  }
  const segments = trimmed
    .split(' / ')
    .map(part => part.trim())
    .filter(Boolean);
  return segments.length > 0 ? segments[segments.length - 1] : trimmed;
}

function formatHardwareLabel(parts: Array<string | null | undefined>, t: (key: string) => string) {
  const cleaned = parts
    .filter(part => part && part.trim().length > 0)
    .map(part => normalizeHardwareModel(part as string))
    .filter(part => part.length > 0);
  return cleaned.length > 0 ? cleaned.join(' · ') : t('common.na');
}
