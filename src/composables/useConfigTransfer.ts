import { ref, type Ref } from 'vue';

import { api, inTauri } from '../services/tauri';
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

export function useConfigTransfer(options: UseConfigTransferOptions) {
  const { store, prefs, themes, updateThemes, refreshRate, t } = options;

  const exportSuccessDialogOpen = ref(false);
  const importConfirmDialogOpen = ref(false);
  const pendingImportConfig = ref<unknown | null>(null);
  const importErrorDialogOpen = ref(false);
  const importErrorMessage = ref('');

  function safeJsonParse<T>(raw: string | null): T | null {
    if (!raw) return null;
    try {
      return JSON.parse(raw) as T;
    } catch {
      return null;
    }
  }

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
      taskbarPrefs: safeJsonParse<unknown>(localStorage.getItem('pulsecorelite.taskbar_prefs')),
      overlayPosition: safeJsonParse<unknown>(localStorage.getItem('pulsecorelite.overlay_pos')),
      taskbarPosition: safeJsonParse<unknown>(localStorage.getItem('pulsecorelite.taskbar_pos'))
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

  function sanitizeImportedTaskbarPrefs(input: unknown) {
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

  async function applyImportedOverlayPrefs(input: unknown) {
    const parsed = input && typeof input === 'object' ? (input as any) : {};
    const boolKeys: Array<keyof typeof prefs> = [
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
      if (typeof parsed[key] === 'boolean') (prefs as any)[key] = parsed[key];
    }
    if (typeof parsed.backgroundOpacity === 'number' && Number.isFinite(parsed.backgroundOpacity)) {
      prefs.backgroundOpacity = Math.max(0, Math.min(100, Math.round(parsed.backgroundOpacity)));
    }
    if (parsed.backgroundImage === null || typeof parsed.backgroundImage === 'string') {
      const normalized = await normalizeImageRef(parsed.backgroundImage);
      prefs.backgroundImage = normalized;
    }
    if (typeof parsed.backgroundBlurPx === 'number' && Number.isFinite(parsed.backgroundBlurPx)) {
      prefs.backgroundBlurPx = clampBlurPx(parsed.backgroundBlurPx);
    }
    if (parsed.backgroundEffect === 'gaussian' || parsed.backgroundEffect === 'liquidGlass') {
      prefs.backgroundEffect = normalizeBackgroundEffect(parsed.backgroundEffect);
    }
    if (typeof parsed.backgroundGlassStrength === 'number' && Number.isFinite(parsed.backgroundGlassStrength)) {
      prefs.backgroundGlassStrength = clampGlassStrength(parsed.backgroundGlassStrength);
    }
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

  async function confirmImportConfig() {
    const raw = pendingImportConfig.value;
    importConfirmDialogOpen.value = false;
    pendingImportConfig.value = null;
    if (!raw || typeof window === 'undefined') return;

    try {
      const candidate = raw as any;

      const settings = candidate.settings && typeof candidate.settings === 'object' ? candidate.settings : null;
      if (settings) {
        if (settings.language === 'zh-CN' || settings.language === 'en-US') store.setLanguage(settings.language);
        if (typeof settings.closeToTray === 'boolean') store.setCloseToTray(settings.closeToTray);
        if (typeof settings.rememberOverlayPosition === 'boolean')
          store.setRememberOverlayPosition(settings.rememberOverlayPosition);
        if (typeof settings.overlayAlwaysOnTop === 'boolean')
          store.setOverlayAlwaysOnTop(settings.overlayAlwaysOnTop);
        if (typeof settings.taskbarAlwaysOnTop === 'boolean')
          store.setTaskbarAlwaysOnTop(settings.taskbarAlwaysOnTop);
        if (typeof settings.taskbarAutoHideOnFullscreen === 'boolean')
          store.setTaskbarAutoHideOnFullscreen(settings.taskbarAutoHideOnFullscreen);
        if (typeof settings.taskbarPositionLocked === 'boolean')
          store.setTaskbarPositionLocked(settings.taskbarPositionLocked);
        if (settings.factoryResetHotkey == null || typeof settings.factoryResetHotkey === 'string')
          store.setFactoryResetHotkey(settings.factoryResetHotkey ?? null);
        if (typeof settings.taskbarMonitorEnabled === 'boolean')
          await store.setTaskbarMonitorEnabled(settings.taskbarMonitorEnabled);
        if (typeof settings.autoStartEnabled === 'boolean')
          await store.setAutoStartEnabled(settings.autoStartEnabled);
        if (typeof settings.memoryTrimEnabled === 'boolean')
          await store.setMemoryTrimEnabled(settings.memoryTrimEnabled);
        if (typeof settings.memoryTrimIntervalMinutes === 'number' && Number.isFinite(settings.memoryTrimIntervalMinutes))
          await store.setMemoryTrimIntervalMinutes(settings.memoryTrimIntervalMinutes);
      }

      await applyImportedOverlayPrefs(candidate.overlayPrefs);
      const importedThemes = sanitizeThemes(candidate.overlayThemes ?? candidate.themes);
      if (importedThemes.length || Array.isArray(candidate.overlayThemes) || Array.isArray(candidate.themes)) {
        const normalizedThemes = await Promise.all(
          importedThemes.map(async theme => {
            const image = await normalizeImageRef(theme.image);
            return { ...theme, image: image ?? theme.image };
          })
        );
        updateThemes(normalizedThemes.slice(0, 3));
      }

      if (typeof candidate.refreshRateMs === 'number' && Number.isFinite(candidate.refreshRateMs)) {
        const nextRate = Math.max(10, Math.min(2000, Math.round(candidate.refreshRateMs)));
        refreshRate.value = nextRate;
        store.setRefreshRate(nextRate);
        localStorage.setItem('pulsecorelite.refresh_rate', String(nextRate));
      }

      if (candidate.taskbarPrefs) {
        const next = sanitizeImportedTaskbarPrefs(candidate.taskbarPrefs);
        localStorage.setItem('pulsecorelite.taskbar_prefs', JSON.stringify(next));
      }

      if (isPositionLike(candidate.overlayPosition)) {
        localStorage.setItem('pulsecorelite.overlay_pos', JSON.stringify(candidate.overlayPosition));
      }
      if (isPositionLike(candidate.taskbarPosition)) {
        localStorage.setItem('pulsecorelite.taskbar_pos', JSON.stringify(candidate.taskbarPosition));
      }

      if (store.settings.taskbarMonitorEnabled) {
        await store.setTaskbarMonitorEnabled(false);
        await store.setTaskbarMonitorEnabled(true);
      }
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
