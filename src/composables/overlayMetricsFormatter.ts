export function formatGpuFreq(value: number) {
  return `${(value / 1000).toFixed(2)} GHz`;
}

export function formatCpuFreq(valueMhz: number) {
  if (valueMhz >= 1000) return `${(valueMhz / 1000).toFixed(1)}GHz`;
  return `${valueMhz.toFixed(0)}MHz`;
}

export function formatCpuFreqPair(freqMhz: number, maxMhz: number) {
  if (Math.abs(freqMhz - maxMhz) < 1) {
    return formatCpuFreq(freqMhz);
  }
  const useGhz = Math.max(freqMhz, maxMhz) >= 1000;
  if (useGhz) return `${(freqMhz / 1000).toFixed(1)}GHz/${(maxMhz / 1000).toFixed(1)}GHz`;
  return `${freqMhz.toFixed(0)}MHz/${maxMhz.toFixed(0)}MHz`;
}

export function normalizeHardwareModel(value: string) {
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

export function formatHardwareLabel(parts: Array<string | null | undefined>, t: (key: string) => string) {
  const cleaned = parts
    .filter(part => part && part.trim().length > 0)
    .map(part => normalizeHardwareModel(part as string))
    .filter(part => part.length > 0);
  return cleaned.length > 0 ? cleaned.join(' · ') : t('common.na');
}

export function formatCpuDetailLabel(input: {
  frequencyMhz: number | null;
  maxFrequencyMhz: number | null;
  temperatureC: number | null;
  t: (key: string) => string;
}) {
  const parts: string[] = [];
  const { frequencyMhz, maxFrequencyMhz, temperatureC, t } = input;
  if (typeof frequencyMhz === 'number' && typeof maxFrequencyMhz === 'number') {
    parts.push(formatCpuFreqPair(frequencyMhz, maxFrequencyMhz));
  } else if (typeof frequencyMhz === 'number') {
    parts.push(formatCpuFreq(frequencyMhz));
  }
  if (typeof temperatureC === 'number' && Number.isFinite(temperatureC)) {
    parts.push(`${temperatureC.toFixed(0)}°C`);
  }
  return parts.length > 0 ? parts.join(' · ') : t('common.na');
}

export function formatGpuDetailLabel(input: {
  memoryUsedMb: number | null;
  memoryTotalMb: number | null;
  frequencyMhz: number | null;
  t: (key: string) => string;
}) {
  const parts: string[] = [];
  const { memoryUsedMb, memoryTotalMb, frequencyMhz, t } = input;
  if (memoryUsedMb != null && memoryTotalMb != null) {
    parts.push(`${t('overlay.vram')} ${memoryUsedMb.toFixed(0)}/${memoryTotalMb.toFixed(0)} MB`);
  }
  if (frequencyMhz != null && Number.isFinite(frequencyMhz)) {
    parts.push(`${t('overlay.freq')} ${formatGpuFreq(frequencyMhz)}`);
  }
  return parts.length > 0 ? parts.join(' · ') : t('common.na');
}

export function formatMemoryUsageLabel(usedMb: number, totalMb: number) {
  const used = (usedMb / 1024).toFixed(1);
  const total = (totalMb / 1024).toFixed(0);
  return `${used}/${total} GB`;
}

export function formatLatencyLabel(value: number | null | undefined, t: (key: string) => string) {
  return value == null ? t('common.na') : `${value.toFixed(0)} ms`;
}

export function formatDiskUsageLabel(input: { used_gb: number; total_gb: number }) {
  return `${input.used_gb.toFixed(0)}/${input.total_gb.toFixed(0)} GB`;
}

export function formatDiskPercentLabel(input: { usage_pct: number }) {
  return `${input.usage_pct.toFixed(1)}%`;
}

export function formatDiskIoLabel(input: { read_bytes_per_sec: number | null; write_bytes_per_sec: number | null }) {
  const read = ((input.read_bytes_per_sec || 0) / 1024 / 1024).toFixed(1);
  const write = ((input.write_bytes_per_sec || 0) / 1024 / 1024).toFixed(1);
  return `R: ${read} MB/s · W: ${write} MB/s`;
}

export function resolveDiskHardwareLabel(input: {
  diskName: string;
  totalGb: number;
  diskModels: string[];
  t: (key: string) => string;
}) {
  const { diskName, totalGb, diskModels, t } = input;
  const driveLetter = diskName.replace(/[\\/]$/, '');
  const match = diskModels.find(
    modelStr => modelStr.startsWith(driveLetter + ' ') || modelStr.startsWith(driveLetter + '·')
  );

  let modelName = t('common.na');
  if (match) {
    const parts = match.split('·');
    modelName = parts.length > 1 ? normalizeHardwareModel(parts.slice(1).join('·')) : normalizeHardwareModel(match);
  }

  return `${modelName} · ${totalGb.toFixed(0)} GB`;
}
