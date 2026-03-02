import type { AppSettings, HardwareInfo, TelemetrySnapshot } from '../../types';
import { storageKeys, storageRepository } from '../../services/storageRepository';

export const MEMORY_TRIM_MIN = 1;
export const MEMORY_TRIM_MAX = 30;
export const MEMORY_TRIM_TARGET_APP = 'app' as const;
export const MEMORY_TRIM_TARGET_SYSTEM = 'system' as const;
export const MEMORY_TRIM_TARGETS = [MEMORY_TRIM_TARGET_APP, MEMORY_TRIM_TARGET_SYSTEM] as const;
export type MemoryTrimTarget = (typeof MEMORY_TRIM_TARGETS)[number];

export function normalizeMemoryTrimTargets(input: unknown): MemoryTrimTarget[] {
  if (!Array.isArray(input)) return [];
  const set = new Set<MemoryTrimTarget>();
  for (const item of input) {
    if (item === MEMORY_TRIM_TARGET_APP || item === MEMORY_TRIM_TARGET_SYSTEM) {
      set.add(item);
    }
  }
  return Array.from(set);
}

export function filterTargetsByEnabled(settings: AppSettings, targets: MemoryTrimTarget[]) {
  return targets.filter(target => {
    if (target === MEMORY_TRIM_TARGET_APP) return settings.memoryTrimEnabled;
    if (target === MEMORY_TRIM_TARGET_SYSTEM) return settings.memoryTrimSystemEnabled;
    return false;
  });
}

function isTargetSelected(targets: MemoryTrimTarget[], target: MemoryTrimTarget) {
  return targets.includes(target);
}

export function computeEffectiveTrimEnabled(settings: AppSettings) {
  return settings.memoryTrimEnabled && isTargetSelected(settings.memoryTrimTargets, MEMORY_TRIM_TARGET_APP);
}

export function computeEffectiveSystemTrimEnabled(settings: AppSettings) {
  return (
    settings.memoryTrimSystemEnabled && isTargetSelected(settings.memoryTrimTargets, MEMORY_TRIM_TARGET_SYSTEM)
  );
}

export function emptySnapshot(): TelemetrySnapshot {
  return {
    timestamp: new Date().toISOString(),
    cpu: { usage_pct: 0, frequency_mhz: null, temperature_c: null },
    gpu: {
      usage_pct: 0,
      temperature_c: null,
      memory_used_mb: null,
      memory_total_mb: null,
      frequency_mhz: null
    },
    memory: { used_mb: 0, total_mb: 1, usage_pct: 0 },
    disks: [],
    network: { download_bytes_per_sec: 0, upload_bytes_per_sec: 0, latency_ms: null },
    appCpuUsagePct: 0,
    appMemoryMb: null,
    power_watts: null
  };
}

function readStoredSettings(): Partial<AppSettings> | null {
  const parsed = storageRepository.getJsonSync<Partial<AppSettings>>(storageKeys.settings);
  if (!parsed || typeof parsed !== 'object') {
    return null;
  }

  const hasOwn = (key: keyof AppSettings) => Object.prototype.hasOwnProperty.call(parsed, key);
  const hasLanguage = parsed.language === 'zh-CN' || parsed.language === 'en-US';
  const hasCloseToTray = typeof parsed.closeToTray === 'boolean';
  const hasAutoStartEnabled = hasOwn('autoStartEnabled') && typeof parsed.autoStartEnabled === 'boolean';
  const hasMemoryTrimEnabled = hasOwn('memoryTrimEnabled') && typeof parsed.memoryTrimEnabled === 'boolean';
  const hasMemoryTrimSystemEnabled =
    hasOwn('memoryTrimSystemEnabled') && typeof parsed.memoryTrimSystemEnabled === 'boolean';
  const hasMemoryTrimTargets = hasOwn('memoryTrimTargets') && Array.isArray(parsed.memoryTrimTargets);
  const intervalValue = parsed.memoryTrimIntervalMinutes;
  const hasMemoryTrimIntervalMinutes =
    hasOwn('memoryTrimIntervalMinutes') && typeof intervalValue === 'number' && Number.isFinite(intervalValue);
  const hasRememberOverlayPosition =
    hasOwn('rememberOverlayPosition') && typeof parsed.rememberOverlayPosition === 'boolean';
  const hasOverlayAlwaysOnTop = hasOwn('overlayAlwaysOnTop') && typeof parsed.overlayAlwaysOnTop === 'boolean';
  const hasTaskbarMonitorEnabled =
    hasOwn('taskbarMonitorEnabled') && typeof parsed.taskbarMonitorEnabled === 'boolean';
  const hasTaskbarAlwaysOnTop = hasOwn('taskbarAlwaysOnTop') && typeof parsed.taskbarAlwaysOnTop === 'boolean';
  const hasTaskbarAutoHideOnFullscreen =
    hasOwn('taskbarAutoHideOnFullscreen') && typeof parsed.taskbarAutoHideOnFullscreen === 'boolean';
  const hasTaskbarPositionLocked =
    hasOwn('taskbarPositionLocked') && typeof parsed.taskbarPositionLocked === 'boolean';
  const hasFactoryResetHotkey =
    hasOwn('factoryResetHotkey') &&
    (parsed.factoryResetHotkey == null || typeof parsed.factoryResetHotkey === 'string');

  if (
    hasLanguage ||
    hasCloseToTray ||
    hasAutoStartEnabled ||
    hasMemoryTrimEnabled ||
    hasMemoryTrimSystemEnabled ||
    hasMemoryTrimTargets ||
    hasMemoryTrimIntervalMinutes ||
    hasRememberOverlayPosition ||
    hasOverlayAlwaysOnTop ||
    hasTaskbarMonitorEnabled ||
    hasTaskbarAlwaysOnTop ||
    hasTaskbarAutoHideOnFullscreen ||
    hasTaskbarPositionLocked ||
    hasFactoryResetHotkey
  ) {
    return {
      ...(hasLanguage ? { language: parsed.language } : {}),
      ...(hasCloseToTray ? { closeToTray: parsed.closeToTray } : {}),
      ...(hasAutoStartEnabled ? { autoStartEnabled: parsed.autoStartEnabled } : {}),
      ...(hasMemoryTrimEnabled ? { memoryTrimEnabled: parsed.memoryTrimEnabled } : {}),
      ...(hasMemoryTrimSystemEnabled ? { memoryTrimSystemEnabled: parsed.memoryTrimSystemEnabled } : {}),
      ...(hasMemoryTrimTargets ? { memoryTrimTargets: normalizeMemoryTrimTargets(parsed.memoryTrimTargets) } : {}),
      ...(hasMemoryTrimIntervalMinutes ? { memoryTrimIntervalMinutes: Math.round(intervalValue) } : {}),
      ...(hasRememberOverlayPosition ? { rememberOverlayPosition: parsed.rememberOverlayPosition } : {}),
      ...(hasOverlayAlwaysOnTop ? { overlayAlwaysOnTop: parsed.overlayAlwaysOnTop } : {}),
      ...(hasTaskbarMonitorEnabled ? { taskbarMonitorEnabled: parsed.taskbarMonitorEnabled } : {}),
      ...(hasTaskbarAlwaysOnTop ? { taskbarAlwaysOnTop: parsed.taskbarAlwaysOnTop } : {}),
      ...(hasTaskbarAutoHideOnFullscreen
        ? { taskbarAutoHideOnFullscreen: parsed.taskbarAutoHideOnFullscreen }
        : {}),
      ...(hasTaskbarPositionLocked ? { taskbarPositionLocked: parsed.taskbarPositionLocked } : {}),
      ...(hasFactoryResetHotkey ? { factoryResetHotkey: parsed.factoryResetHotkey ?? null } : {})
    };
  }
  return null;
}

export function resolveSettings(settings?: AppSettings | null): AppSettings {
  const fallback: AppSettings = {
    language: 'zh-CN',
    closeToTray: false,
    autoStartEnabled: false,
    memoryTrimEnabled: true,
    memoryTrimSystemEnabled: false,
    memoryTrimTargets: [MEMORY_TRIM_TARGET_APP],
    memoryTrimIntervalMinutes: 5,
    rememberOverlayPosition: true,
    overlayAlwaysOnTop: true,
    taskbarMonitorEnabled: false,
    taskbarAlwaysOnTop: true,
    taskbarAutoHideOnFullscreen: false,
    taskbarPositionLocked: false,
    factoryResetHotkey: null
  };

  const candidate = settings ?? fallback;
  const clampMemoryTrimInterval = (value: number) => Math.max(MEMORY_TRIM_MIN, Math.min(MEMORY_TRIM_MAX, Math.round(value)));
  const candidateTargets = normalizeMemoryTrimTargets((candidate as AppSettings).memoryTrimTargets);
  const base: AppSettings = {
    language: candidate.language === 'en-US' ? 'en-US' : 'zh-CN',
    closeToTray: typeof candidate.closeToTray === 'boolean' ? candidate.closeToTray : fallback.closeToTray,
    autoStartEnabled:
      typeof candidate.autoStartEnabled === 'boolean' ? candidate.autoStartEnabled : fallback.autoStartEnabled,
    memoryTrimEnabled:
      typeof candidate.memoryTrimEnabled === 'boolean' ? candidate.memoryTrimEnabled : fallback.memoryTrimEnabled,
    memoryTrimSystemEnabled:
      typeof candidate.memoryTrimSystemEnabled === 'boolean'
        ? candidate.memoryTrimSystemEnabled
        : fallback.memoryTrimSystemEnabled,
    memoryTrimTargets: candidateTargets.length ? candidateTargets : fallback.memoryTrimTargets,
    memoryTrimIntervalMinutes:
      typeof candidate.memoryTrimIntervalMinutes === 'number' && Number.isFinite(candidate.memoryTrimIntervalMinutes)
        ? clampMemoryTrimInterval(candidate.memoryTrimIntervalMinutes)
        : fallback.memoryTrimIntervalMinutes,
    rememberOverlayPosition:
      typeof candidate.rememberOverlayPosition === 'boolean'
        ? candidate.rememberOverlayPosition
        : fallback.rememberOverlayPosition,
    overlayAlwaysOnTop:
      typeof candidate.overlayAlwaysOnTop === 'boolean' ? candidate.overlayAlwaysOnTop : fallback.overlayAlwaysOnTop,
    taskbarMonitorEnabled:
      typeof candidate.taskbarMonitorEnabled === 'boolean'
        ? candidate.taskbarMonitorEnabled
        : fallback.taskbarMonitorEnabled,
    taskbarAlwaysOnTop:
      typeof candidate.taskbarAlwaysOnTop === 'boolean'
        ? candidate.taskbarAlwaysOnTop
        : fallback.taskbarAlwaysOnTop,
    taskbarAutoHideOnFullscreen:
      typeof candidate.taskbarAutoHideOnFullscreen === 'boolean'
        ? candidate.taskbarAutoHideOnFullscreen
        : fallback.taskbarAutoHideOnFullscreen,
    taskbarPositionLocked:
      typeof candidate.taskbarPositionLocked === 'boolean'
        ? candidate.taskbarPositionLocked
        : fallback.taskbarPositionLocked,
    factoryResetHotkey:
      candidate.factoryResetHotkey == null || typeof candidate.factoryResetHotkey === 'string'
        ? candidate.factoryResetHotkey
        : fallback.factoryResetHotkey
  };

  const stored = readStoredSettings();
  if (!stored) {
    return base;
  }
  const merged: AppSettings = {
    ...base,
    language: stored.language ?? base.language,
    closeToTray: stored.closeToTray ?? base.closeToTray,
    autoStartEnabled: stored.autoStartEnabled ?? base.autoStartEnabled,
    memoryTrimEnabled: stored.memoryTrimEnabled ?? base.memoryTrimEnabled,
    memoryTrimSystemEnabled: stored.memoryTrimSystemEnabled ?? base.memoryTrimSystemEnabled,
    memoryTrimTargets: stored.memoryTrimTargets ?? base.memoryTrimTargets,
    memoryTrimIntervalMinutes:
      typeof stored.memoryTrimIntervalMinutes === 'number'
        ? clampMemoryTrimInterval(stored.memoryTrimIntervalMinutes)
        : base.memoryTrimIntervalMinutes,
    rememberOverlayPosition: stored.rememberOverlayPosition ?? base.rememberOverlayPosition,
    overlayAlwaysOnTop: stored.overlayAlwaysOnTop ?? base.overlayAlwaysOnTop,
    taskbarMonitorEnabled: stored.taskbarMonitorEnabled ?? base.taskbarMonitorEnabled,
    taskbarAlwaysOnTop: stored.taskbarAlwaysOnTop ?? base.taskbarAlwaysOnTop,
    taskbarAutoHideOnFullscreen: stored.taskbarAutoHideOnFullscreen ?? base.taskbarAutoHideOnFullscreen,
    taskbarPositionLocked: stored.taskbarPositionLocked ?? base.taskbarPositionLocked,
    factoryResetHotkey: stored.factoryResetHotkey ?? base.factoryResetHotkey
  };

  const normalizedTargets = normalizeMemoryTrimTargets(merged.memoryTrimTargets);
  merged.memoryTrimTargets = filterTargetsByEnabled(merged, normalizedTargets);

  return merged;
}

export function persistSettings(settings: AppSettings) {
  storageRepository.setJsonSync(storageKeys.settings, settings);
}

export function defaultSettings(): AppSettings {
  return resolveSettings();
}

export function emptyHardware(): HardwareInfo {
  return {
    cpu_model: '',
    cpu_max_freq_mhz: null,
    gpu_model: '',
    ram_spec: '',
    disk_models: [],
    motherboard: '',
    device_brand: ''
  };
}

export function readStoredHardwareInfo(): HardwareInfo | null {
  const parsed = storageRepository.getJsonSync<HardwareInfo>(storageKeys.hardwareInfo);
  if (!parsed || typeof parsed !== 'object') {
    return null;
  }
  return {
    cpu_model: parsed.cpu_model ?? '',
    cpu_max_freq_mhz: parsed.cpu_max_freq_mhz ?? null,
    gpu_model: parsed.gpu_model ?? '',
    ram_spec: parsed.ram_spec ?? '',
    disk_models: Array.isArray(parsed.disk_models) ? parsed.disk_models : [],
    motherboard: parsed.motherboard ?? '',
    device_brand: parsed.device_brand ?? ''
  };
}

export function persistHardwareInfo(info: HardwareInfo) {
  storageRepository.setJsonSync(storageKeys.hardwareInfo, info);
}

export function resolveHardwareInfo(payload?: HardwareInfo | null): HardwareInfo {
  const stored = readStoredHardwareInfo();
  const fallback = stored ?? emptyHardware();
  if (!payload) {
    return fallback;
  }
  const hasData =
    payload.cpu_model ||
    payload.gpu_model ||
    payload.ram_spec ||
    payload.disk_models.length > 0 ||
    payload.motherboard ||
    payload.device_brand;
  return hasData ? payload : fallback;
}
