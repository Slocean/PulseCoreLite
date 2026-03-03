import { ref, type Ref } from 'vue';

import { api, inTauri } from '../services/tauri';
import { storageKeys, storageRepository } from '../services/storageRepository';
import type { OverlayPrefs } from './useOverlayPrefs';
import type { OverlayTheme } from './useThemeManager';
import { clampBlurPx, clampGlassStrength, normalizeBackgroundEffect, sanitizeThemes } from './useThemeManager';
import { normalizeImageRef, resolveImageRefToDataUrl } from '../utils/imageStore';

interface AppStoreLike {
  settings: {
    language: 'zh-CN' | 'en-US';
    closeToTray: boolean;
    rememberOverlayPosition: boolean;
    overlayAlwaysOnTop: boolean;
    taskbarAlwaysOnTop: boolean;
    taskbarAutoHideOnFullscreen: boolean;
    taskbarPositionLocked: boolean;
    factoryResetHotkey: string | null;
    taskbarMonitorEnabled: boolean;
    autoStartEnabled: boolean;
    memoryTrimEnabled: boolean;
    memoryTrimSystemEnabled: boolean;
    memoryTrimTargets: Array<'app' | 'system'>;
    memoryTrimIntervalMinutes: number;
  };
  setLanguage: (language: 'zh-CN' | 'en-US') => void;
  setCloseToTray: (value: boolean) => void;
  setRememberOverlayPosition: (value: boolean) => void;
  setOverlayAlwaysOnTop: (value: boolean) => void;
  setTaskbarAlwaysOnTop: (value: boolean) => void;
  setTaskbarAutoHideOnFullscreen: (value: boolean) => void;
  setTaskbarPositionLocked: (value: boolean) => void;
  setFactoryResetHotkey: (value: string | null) => void;
  setTaskbarMonitorEnabled: (value: boolean) => Promise<void>;
  setAutoStartEnabled: (value: boolean) => Promise<void>;
  setMemoryTrimEnabled: (value: boolean) => Promise<void> | void;
  setMemoryTrimSystemEnabled: (value: boolean) => Promise<void> | void;
  setMemoryTrimTargets: (value: Array<'app' | 'system'>) => Promise<void> | void;
  setMemoryTrimIntervalMinutes: (value: number) => Promise<void> | void;
  setRefreshRate: (value: number) => void;
}

interface UseConfigTransferOptions {
  store: AppStoreLike;
  prefs: OverlayPrefs;
  themes: Ref<OverlayTheme[]>;
  updateThemes: (next: OverlayTheme[]) => void;
  refreshRate: Ref<number>;
  t: (key: string) => string;
}

interface ImportedTaskbarPrefs {
  showCpu: boolean;
  showCpuFreq: boolean;
  showCpuTemp: boolean;
  showGpu: boolean;
  showGpuTemp: boolean;
  showMemory: boolean;
  showApp: boolean;
  showDown: boolean;
  showUp: boolean;
  showLatency: boolean;
  twoLineMode: boolean;
}

interface ImportCommitPlan {
  settingCommitters: Array<() => Promise<void>>;
  nextOverlayPrefs: OverlayPrefs | null;
  nextThemes: OverlayTheme[] | null;
  nextRefreshRate: number | null;
  nextTaskbarPrefs: ImportedTaskbarPrefs | null;
  nextOverlayPosition: { x: number; y: number } | null;
  nextTaskbarPosition: { x: number; y: number } | null;
  restartTaskbarMonitor: boolean;
}

export function useConfigTransfer(options: UseConfigTransferOptions) {
  const { store, prefs, themes, updateThemes, refreshRate, t } = options;

  const exportSuccessDialogOpen = ref(false);
  const importConfirmDialogOpen = ref(false);
  const pendingImportConfig = ref<unknown | null>(null);
  const importErrorDialogOpen = ref(false);
  const importErrorMessage = ref('');

  async function exportConfig() {
    if (typeof window === 'undefined' || typeof document === 'undefined') return;

    const overlayPrefs = JSON.parse(JSON.stringify(prefs)) as OverlayPrefs;
    if (overlayPrefs.backgroundImage) {
      const resolved = await resolveImageRefToDataUrl(overlayPrefs.backgroundImage);
      if (resolved) {
        overlayPrefs.backgroundImage = resolved;
      }
    }
    const overlayThemes = await Promise.all(
      themes.value.map(async theme => {
        const resolved = await resolveImageRefToDataUrl(theme.image);
        return {
          ...theme,
          image: resolved ?? theme.image
        };
      })
    );

    const payload = {
      schema: 'pulsecorelite.config',
      schemaVersion: 1,
      exportedAt: new Date().toISOString(),
      settings: store.settings,
      refreshRateMs: refreshRate.value,
      overlayPrefs,
      overlayThemes,
      taskbarPrefs: storageRepository.getJsonSync<unknown>(storageKeys.taskbarPrefs) ?? null,
      overlayPosition: storageRepository.getJsonSync<unknown>(storageKeys.overlayPosition) ?? null,
      taskbarPosition: storageRepository.getJsonSync<unknown>(storageKeys.taskbarPosition) ?? null
    };

    const json = JSON.stringify(payload, null, 2);
    const ts = payload.exportedAt.replace(/[:.]/g, '-');
    const filename = `pulsecorelite-config-${ts}.json`;

    if (inTauri()) {
      try {
        const { save } = await import('@tauri-apps/plugin-dialog');
        const path = await save({
          defaultPath: filename,
          filters: [{ name: 'JSON', extensions: ['json'] }]
        });
        if (!path) return;
        await api.saveExportConfig(path, json);
        exportSuccessDialogOpen.value = true;
        return;
      } catch {}
    }

    const blob = new Blob([json], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);
    exportSuccessDialogOpen.value = true;
  }

  async function handleImportConfig(file: File) {
    if (typeof window === 'undefined') return;
    try {
      const text = await file.text();
      const parsed = JSON.parse(text);
      if (!parsed || typeof parsed !== 'object') {
        throw new Error('invalid');
      }
      pendingImportConfig.value = parsed;
      importConfirmDialogOpen.value = true;
    } catch {
      pendingImportConfig.value = null;
      importErrorMessage.value = t('overlay.importConfigInvalid');
      importErrorDialogOpen.value = true;
    }
  }

  function cancelImportConfig() {
    importConfirmDialogOpen.value = false;
    pendingImportConfig.value = null;
  }

  function closeImportErrorDialog() {
    importErrorDialogOpen.value = false;
    importErrorMessage.value = '';
  }

  function closeExportSuccessDialog() {
    exportSuccessDialogOpen.value = false;
  }

  function sanitizeImportedTaskbarPrefs(input: unknown): ImportedTaskbarPrefs {
    const parsed = input && typeof input === 'object' ? (input as any) : {};
    const bool = (key: string) => typeof parsed[key] === 'boolean';
    return {
      showCpu: bool('showCpu') ? parsed.showCpu : true,
      showCpuFreq: bool('showCpuFreq') ? parsed.showCpuFreq : true,
      showCpuTemp: bool('showCpuTemp') ? parsed.showCpuTemp : true,
      showGpu: bool('showGpu') ? parsed.showGpu : true,
      showGpuTemp: bool('showGpuTemp') ? parsed.showGpuTemp : true,
      showMemory: bool('showMemory') ? parsed.showMemory : true,
      showApp: bool('showApp') ? parsed.showApp : true,
      showDown: bool('showDown') ? parsed.showDown : true,
      showUp: bool('showUp') ? parsed.showUp : true,
      showLatency: bool('showLatency') ? parsed.showLatency : false,
      twoLineMode: bool('twoLineMode') ? parsed.twoLineMode : false
    };
  }

  function clampRefreshRate(value: number) {
    return Math.max(10, Math.min(2000, Math.round(value)));
  }

  function isRecord(input: unknown): input is Record<string, unknown> {
    return Boolean(input) && typeof input === 'object';
  }

  function sanitizeMemoryTrimTargets(input: unknown): Array<'app' | 'system'> | null {
    if (!Array.isArray(input)) {
      return null;
    }
    return input.filter((target): target is 'app' | 'system' => target === 'app' || target === 'system');
  }

  async function buildImportedOverlayPrefs(input: unknown): Promise<OverlayPrefs> {
    const parsed = isRecord(input) ? (input as any) : {};
    const next: OverlayPrefs = JSON.parse(JSON.stringify(prefs)) as OverlayPrefs;
    type OverlayPrefsBooleanKey =
      | 'showCpu'
      | 'showGpu'
      | 'showMemory'
      | 'showDisk'
      | 'showDown'
      | 'showUp'
      | 'showLatency'
      | 'showValues'
      | 'showPercent'
      | 'showHardwareInfo'
      | 'showWarning'
      | 'showDragHandle';
    const boolKeys: OverlayPrefsBooleanKey[] = [
      'showCpu',
      'showGpu',
      'showMemory',
      'showDisk',
      'showDown',
      'showUp',
      'showLatency',
      'showValues',
      'showPercent',
      'showHardwareInfo',
      'showWarning',
      'showDragHandle'
    ];
    for (const key of boolKeys) {
      if (typeof parsed[key] === 'boolean') {
        next[key] = parsed[key] as OverlayPrefs[OverlayPrefsBooleanKey];
      }
    }
    if (typeof parsed.backgroundOpacity === 'number' && Number.isFinite(parsed.backgroundOpacity)) {
      next.backgroundOpacity = Math.max(0, Math.min(100, Math.round(parsed.backgroundOpacity)));
    }
    if (parsed.backgroundImage === null || typeof parsed.backgroundImage === 'string') {
      const normalized = await normalizeImageRef(parsed.backgroundImage);
      next.backgroundImage = normalized;
    }
    if (typeof parsed.backgroundBlurPx === 'number' && Number.isFinite(parsed.backgroundBlurPx)) {
      next.backgroundBlurPx = clampBlurPx(parsed.backgroundBlurPx);
    }
    if (parsed.backgroundEffect === 'gaussian' || parsed.backgroundEffect === 'liquidGlass') {
      next.backgroundEffect = normalizeBackgroundEffect(parsed.backgroundEffect);
    }
    if (typeof parsed.backgroundGlassStrength === 'number' && Number.isFinite(parsed.backgroundGlassStrength)) {
      next.backgroundGlassStrength = clampGlassStrength(parsed.backgroundGlassStrength);
    }
    return next;
  }

  function isPositionLike(input: unknown): input is { x: number; y: number } {
    return (
      Boolean(input) &&
      typeof input === 'object' &&
      typeof (input as any).x === 'number' &&
      typeof (input as any).y === 'number' &&
      Number.isFinite((input as any).x) &&
      Number.isFinite((input as any).y)
    );
  }

  async function buildImportCommitPlan(raw: unknown): Promise<ImportCommitPlan> {
    if (!isRecord(raw)) {
      throw new Error('invalid-import');
    }
    const candidate = raw as Record<string, unknown>;
    if (typeof candidate.schema === 'string' && candidate.schema !== 'pulsecorelite.config') {
      throw new Error('invalid-schema');
    }

    const settingCommitters: Array<() => Promise<void>> = [];
    const pushSettingCommitter = (run: () => Promise<void> | void) => {
      settingCommitters.push(async () => {
        await run();
      });
    };

    const settings = isRecord(candidate.settings) ? (candidate.settings as Record<string, unknown>) : null;
    if (settings) {
      if (settings.language === 'zh-CN' || settings.language === 'en-US') {
        pushSettingCommitter(() => store.setLanguage(settings.language as 'zh-CN' | 'en-US'));
      }
      if (typeof settings.closeToTray === 'boolean') {
        pushSettingCommitter(() => store.setCloseToTray(settings.closeToTray as boolean));
      }
      if (typeof settings.rememberOverlayPosition === 'boolean') {
        pushSettingCommitter(() => store.setRememberOverlayPosition(settings.rememberOverlayPosition as boolean));
      }
      if (typeof settings.overlayAlwaysOnTop === 'boolean') {
        pushSettingCommitter(() => store.setOverlayAlwaysOnTop(settings.overlayAlwaysOnTop as boolean));
      }
      if (typeof settings.taskbarAlwaysOnTop === 'boolean') {
        pushSettingCommitter(() => store.setTaskbarAlwaysOnTop(settings.taskbarAlwaysOnTop as boolean));
      }
      if (typeof settings.taskbarAutoHideOnFullscreen === 'boolean') {
        pushSettingCommitter(() => store.setTaskbarAutoHideOnFullscreen(settings.taskbarAutoHideOnFullscreen as boolean));
      }
      if (typeof settings.taskbarPositionLocked === 'boolean') {
        pushSettingCommitter(() => store.setTaskbarPositionLocked(settings.taskbarPositionLocked as boolean));
      }
      if (settings.factoryResetHotkey == null || typeof settings.factoryResetHotkey === 'string') {
        pushSettingCommitter(() => store.setFactoryResetHotkey((settings.factoryResetHotkey as string | null) ?? null));
      }
      if (typeof settings.taskbarMonitorEnabled === 'boolean') {
        pushSettingCommitter(() => store.setTaskbarMonitorEnabled(settings.taskbarMonitorEnabled as boolean));
      }
      if (typeof settings.autoStartEnabled === 'boolean') {
        pushSettingCommitter(() => store.setAutoStartEnabled(settings.autoStartEnabled as boolean));
      }
      if (typeof settings.memoryTrimEnabled === 'boolean') {
        pushSettingCommitter(() => store.setMemoryTrimEnabled(settings.memoryTrimEnabled as boolean));
      }
      if (typeof settings.memoryTrimSystemEnabled === 'boolean') {
        pushSettingCommitter(() => store.setMemoryTrimSystemEnabled(settings.memoryTrimSystemEnabled as boolean));
      }
      const targets = sanitizeMemoryTrimTargets(settings.memoryTrimTargets);
      if (targets) {
        pushSettingCommitter(() => store.setMemoryTrimTargets(targets));
      }
      if (typeof settings.memoryTrimIntervalMinutes === 'number' && Number.isFinite(settings.memoryTrimIntervalMinutes)) {
        pushSettingCommitter(() => store.setMemoryTrimIntervalMinutes(settings.memoryTrimIntervalMinutes as number));
      }
    }

    const nextOverlayPrefs = isRecord(candidate.overlayPrefs)
      ? await buildImportedOverlayPrefs(candidate.overlayPrefs)
      : null;

    const hasThemePayload = Array.isArray(candidate.overlayThemes) || Array.isArray(candidate.themes);
    let nextThemes: OverlayTheme[] | null = null;
    if (hasThemePayload) {
      const importedThemes = sanitizeThemes(candidate.overlayThemes ?? candidate.themes);
      const normalizedThemes = await Promise.all(
        importedThemes.map(async theme => {
          const image = await normalizeImageRef(theme.image);
          return { ...theme, image: image ?? theme.image };
        })
      );
      nextThemes = normalizedThemes.slice(0, 3);
    }

    const nextRefreshRate =
      typeof candidate.refreshRateMs === 'number' && Number.isFinite(candidate.refreshRateMs)
        ? clampRefreshRate(candidate.refreshRateMs)
        : null;

    const nextTaskbarPrefs = candidate.taskbarPrefs ? sanitizeImportedTaskbarPrefs(candidate.taskbarPrefs) : null;
    const nextOverlayPosition = isPositionLike(candidate.overlayPosition) ? candidate.overlayPosition : null;
    const nextTaskbarPosition = isPositionLike(candidate.taskbarPosition) ? candidate.taskbarPosition : null;
    const restartTaskbarMonitor =
      typeof settings?.taskbarMonitorEnabled === 'boolean'
        ? (settings.taskbarMonitorEnabled as boolean)
        : store.settings.taskbarMonitorEnabled;

    return {
      settingCommitters,
      nextOverlayPrefs,
      nextThemes,
      nextRefreshRate,
      nextTaskbarPrefs,
      nextOverlayPosition,
      nextTaskbarPosition,
      restartTaskbarMonitor
    };
  }

  async function commitImportPlan(plan: ImportCommitPlan) {
    for (const commit of plan.settingCommitters) {
      await commit();
    }

    if (plan.nextOverlayPrefs) {
      Object.assign(prefs, plan.nextOverlayPrefs);
    }
    if (plan.nextThemes) {
      updateThemes(plan.nextThemes);
    }
    if (plan.nextRefreshRate != null) {
      refreshRate.value = plan.nextRefreshRate;
      store.setRefreshRate(plan.nextRefreshRate);
    }

    if (plan.nextTaskbarPrefs) {
      storageRepository.setJsonSync(storageKeys.taskbarPrefs, plan.nextTaskbarPrefs);
    }
    if (plan.nextOverlayPosition) {
      storageRepository.setJsonSync(storageKeys.overlayPosition, plan.nextOverlayPosition);
    }
    if (plan.nextTaskbarPosition) {
      storageRepository.setJsonSync(storageKeys.taskbarPosition, plan.nextTaskbarPosition);
    }
    if (plan.nextRefreshRate != null) {
      await storageRepository.setString(storageKeys.refreshRate, String(plan.nextRefreshRate));
    }

    if (plan.restartTaskbarMonitor) {
      await store.setTaskbarMonitorEnabled(false);
      await store.setTaskbarMonitorEnabled(true);
    }
  }

  async function confirmImportConfig() {
    const raw = pendingImportConfig.value;
    importConfirmDialogOpen.value = false;
    pendingImportConfig.value = null;
    if (!raw || typeof window === 'undefined') return;

    try {
      const nextState = await buildImportCommitPlan(raw);
      await commitImportPlan(nextState);
    } catch {
      importErrorMessage.value = t('overlay.importConfigInvalid');
      importErrorDialogOpen.value = true;
    }
  }

  return {
    exportSuccessDialogOpen,
    importConfirmDialogOpen,
    importErrorDialogOpen,
    importErrorMessage,
    exportConfig,
    handleImportConfig,
    confirmImportConfig,
    cancelImportConfig,
    closeImportErrorDialog,
    closeExportSuccessDialog
  };
}
