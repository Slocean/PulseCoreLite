import { ref, type Ref } from 'vue';

import { api, inTauri } from '../services/tauri';
import { storageKeys, storageRepository } from '../services/storageRepository';
import type { HardwareInfo, ShutdownPlan, TaskReminderStore } from '../types';
import { loadReminderStore, saveReminderStore } from './taskReminders/repository';
import { normalizeReminder, normalizeSmtpConfig } from './taskReminders/scheduler';
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
    nativeTaskbarMonitorEnabled: boolean;
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
  setNativeTaskbarMonitorEnabled: (value: boolean) => Promise<void>;
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
  backgroundMode: 'transparent' | 'dark' | 'light';
}

interface ImportCommitPlan {
  settingCommitters: Array<() => Promise<void>>;
  nextOverlayPrefs: OverlayPrefs | null;
  nextThemes: OverlayTheme[] | null;
  nextRefreshRate: number | null;
  nextTaskbarPrefs: ImportedTaskbarPrefs | null;
  nextOverlayPosition: { x: number; y: number } | null;
  nextTaskbarPosition: { x: number; y: number } | null;
  nextHardwareInfo: HardwareInfo | null;
  nextReminderStore: TaskReminderStore | null;
  nextReminderAllowCloseWarningDismissed: boolean | null;
  nextShutdownPlan: ShutdownPlan | null;
  shutdownPlanIncluded: boolean;
  restartTaskbarMonitor: boolean;
}

export function useConfigTransfer(options: UseConfigTransferOptions) {
  const { store, prefs, themes, updateThemes, refreshRate, t } = options;

  const exportSuccessDialogOpen = ref(false);
  const importConfirmDialogOpen = ref(false);
  const pendingImportConfig = ref<unknown | null>(null);
  const importErrorDialogOpen = ref(false);
  const importErrorMessage = ref('');

  async function exportReminderStoreWithAssets(): Promise<TaskReminderStore> {
    const store = await loadReminderStore();
    const reminders = await Promise.all(
      store.reminders.map(async reminder => {
        let content = reminder.content;
        if (reminder.contentType === 'image' && content) {
          const resolved = await resolveImageRefToDataUrl(content);
          if (resolved) {
            content = resolved;
          }
        }

        let advancedSettings = reminder.advancedSettings;
        if (advancedSettings?.backgroundImage) {
          const resolved = await resolveImageRefToDataUrl(advancedSettings.backgroundImage);
          if (resolved) {
            advancedSettings = {
              ...advancedSettings,
              backgroundImage: resolved
            };
          }
        }

        return {
          ...reminder,
          content,
          advancedSettings
        };
      })
    );

    return {
      reminders,
      smtpConfig: store.smtpConfig
    };
  }

  async function getExportShutdownPlan(): Promise<ShutdownPlan | null> {
    if (!inTauri()) {
      return null;
    }
    try {
      return await api.getShutdownPlan();
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
    const [reminderStore, shutdownPlan] = await Promise.all([exportReminderStoreWithAssets(), getExportShutdownPlan()]);

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
      taskbarPosition: storageRepository.getJsonSync<unknown>(storageKeys.taskbarPosition) ?? null,
      hardwareInfo: storageRepository.getJsonSync<unknown>(storageKeys.hardwareInfo) ?? null,
      reminderStore,
      reminderAllowCloseWarningDismissed:
        storageRepository.getStringSync(storageKeys.reminderAllowCloseWarningDismissed) === '1',
      shutdownPlan
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
      twoLineMode: bool('twoLineMode') ? parsed.twoLineMode : false,
      backgroundMode:
        parsed.backgroundMode === 'dark' || parsed.backgroundMode === 'light' || parsed.backgroundMode === 'transparent'
          ? parsed.backgroundMode
          : 'transparent'
    };
  }

  function clampRefreshRate(value: number) {
    return Math.max(10, Math.min(2000, Math.round(value)));
  }

  function isRecord(input: unknown): input is Record<string, unknown> {
    return Boolean(input) && typeof input === 'object';
  }

  function hasOwn(input: Record<string, unknown>, key: string) {
    return Object.prototype.hasOwnProperty.call(input, key);
  }

  function sanitizeMemoryTrimTargets(input: unknown): Array<'app' | 'system'> | null {
    if (!Array.isArray(input)) {
      return null;
    }
    return input.filter((target): target is 'app' | 'system' => target === 'app' || target === 'system');
  }

  function sanitizeImportedHardwareInfo(input: unknown): HardwareInfo | null {
    if (!isRecord(input)) {
      return null;
    }
    return {
      cpu_model: typeof input.cpu_model === 'string' ? input.cpu_model : '',
      cpu_max_freq_mhz:
        typeof input.cpu_max_freq_mhz === 'number' && Number.isFinite(input.cpu_max_freq_mhz)
          ? input.cpu_max_freq_mhz
          : null,
      gpu_model: typeof input.gpu_model === 'string' ? input.gpu_model : '',
      ram_spec: typeof input.ram_spec === 'string' ? input.ram_spec : '',
      disk_models: Array.isArray(input.disk_models)
        ? input.disk_models.filter((item): item is string => typeof item === 'string')
        : [],
      motherboard: typeof input.motherboard === 'string' ? input.motherboard : '',
      device_brand: typeof input.device_brand === 'string' ? input.device_brand : ''
    };
  }

  async function sanitizeImportedReminderStore(input: unknown): Promise<TaskReminderStore | null> {
    if (!isRecord(input)) {
      return null;
    }

    const reminders = Array.isArray(input.reminders)
      ? await Promise.all(
          input.reminders
            .filter((item): item is Record<string, unknown> => isRecord(item))
            .map(async reminder => {
              let content = typeof reminder.content === 'string' ? reminder.content : '';
              if (reminder.contentType === 'image' && content) {
                content = (await normalizeImageRef(content)) ?? content;
              }

              const advancedSettingsInput = isRecord(reminder.advancedSettings) ? reminder.advancedSettings : undefined;
              const backgroundImage = advancedSettingsInput?.backgroundImage;
              const normalizedBackgroundImage =
                typeof backgroundImage === 'string' ? await normalizeImageRef(backgroundImage) : backgroundImage;

              return normalizeReminder({
                id: typeof reminder.id === 'string' ? reminder.id : '',
                enabled: Boolean(reminder.enabled),
                title: typeof reminder.title === 'string' ? reminder.title : '',
                channel: reminder.channel === 'fullscreen' ? 'fullscreen' : 'email',
                email: typeof reminder.email === 'string' ? reminder.email : '',
                dailyTimes: Array.isArray(reminder.dailyTimes)
                  ? reminder.dailyTimes.filter((item): item is string => typeof item === 'string')
                  : [],
                weeklySlots: Array.isArray(reminder.weeklySlots)
                  ? reminder.weeklySlots
                      .filter((item): item is Record<string, unknown> => isRecord(item))
                      .map(item => ({
                        weekday: typeof item.weekday === 'number' ? item.weekday : 1,
                        time: typeof item.time === 'string' ? item.time : ''
                      }))
                  : [],
                monthlySlots: Array.isArray(reminder.monthlySlots)
                  ? reminder.monthlySlots
                      .filter((item): item is Record<string, unknown> => isRecord(item))
                      .map(item => ({
                        day: typeof item.day === 'number' ? item.day : 1,
                        time: typeof item.time === 'string' ? item.time : ''
                      }))
                  : [],
                contentType:
                  reminder.contentType === 'markdown' ||
                  reminder.contentType === 'web' ||
                  reminder.contentType === 'image'
                    ? reminder.contentType
                    : 'text',
                content,
                advancedSettings: advancedSettingsInput
                  ? {
                      backgroundType:
                        advancedSettingsInput.backgroundType === 'color' ? 'color' : 'image',
                      backgroundImage:
                        typeof normalizedBackgroundImage === 'string' ? normalizedBackgroundImage : '',
                      backgroundColor:
                        typeof advancedSettingsInput.backgroundColor === 'string'
                          ? advancedSettingsInput.backgroundColor
                          : '',
                      allowClose: advancedSettingsInput.allowClose !== false,
                      blockAllKeys: Boolean(advancedSettingsInput.blockAllKeys),
                      requireClosePassword: Boolean(advancedSettingsInput.requireClosePassword),
                      closePassword:
                        typeof advancedSettingsInput.closePassword === 'string'
                          ? advancedSettingsInput.closePassword
                          : ''
                    }
                  : undefined,
                createdAt: typeof reminder.createdAt === 'string' ? reminder.createdAt : '',
                updatedAt: typeof reminder.updatedAt === 'string' ? reminder.updatedAt : ''
              });
            })
        )
      : [];

    return {
      reminders,
      smtpConfig: normalizeSmtpConfig(input.smtpConfig as any)
    };
  }

  function isShutdownPlanLike(input: unknown): input is ShutdownPlan {
    return (
      isRecord(input) &&
      (input.mode === 'countdown' ||
        input.mode === 'once' ||
        input.mode === 'daily' ||
        input.mode === 'weekly' ||
        input.mode === 'monthly')
    );
  }

  async function applyShutdownPlan(plan: ShutdownPlan | null) {
    if (!inTauri()) {
      return;
    }
    if (!plan) {
      await api.cancelShutdownSchedule();
      return;
    }

    if (plan.mode === 'countdown') {
      const seconds =
        typeof plan.countdownSeconds === 'number' && Number.isFinite(plan.countdownSeconds)
          ? Math.max(1, Math.round(plan.countdownSeconds))
          : null;
      if (!seconds) {
        throw new Error('invalid-shutdown-plan');
      }
      await api.scheduleShutdown({ mode: 'countdown', delaySeconds: seconds });
      return;
    }

    if (plan.mode === 'once') {
      if (!plan.executeAt) {
        throw new Error('invalid-shutdown-plan');
      }
      await api.scheduleShutdown({ mode: 'once', executeAt: plan.executeAt });
      return;
    }

    if (plan.mode === 'daily') {
      if (!plan.time) {
        throw new Error('invalid-shutdown-plan');
      }
      await api.scheduleShutdown({ mode: 'daily', time: plan.time });
      return;
    }

    if (plan.mode === 'weekly') {
      if (!plan.time || typeof plan.weekday !== 'number') {
        throw new Error('invalid-shutdown-plan');
      }
      await api.scheduleShutdown({ mode: 'weekly', time: plan.time, weekday: plan.weekday });
      return;
    }

    if (!plan.time || typeof plan.dayOfMonth !== 'number') {
      throw new Error('invalid-shutdown-plan');
    }
    await api.scheduleShutdown({ mode: 'monthly', time: plan.time, dayOfMonth: plan.dayOfMonth });
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
    if (parsed.backgroundThemeId === null || typeof parsed.backgroundThemeId === 'string') {
      next.backgroundThemeId = parsed.backgroundThemeId;
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
      if (typeof settings.nativeTaskbarMonitorEnabled === 'boolean') {
        pushSettingCommitter(() =>
          store.setNativeTaskbarMonitorEnabled(settings.nativeTaskbarMonitorEnabled as boolean)
        );
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
    const nextHardwareInfo = hasOwn(candidate, 'hardwareInfo')
      ? sanitizeImportedHardwareInfo(candidate.hardwareInfo)
      : null;
    const nextReminderStore = hasOwn(candidate, 'reminderStore')
      ? await sanitizeImportedReminderStore(candidate.reminderStore)
      : null;
    const nextReminderAllowCloseWarningDismissed = hasOwn(candidate, 'reminderAllowCloseWarningDismissed')
      ? candidate.reminderAllowCloseWarningDismissed === true
      : null;
    const shutdownPlanIncluded = hasOwn(candidate, 'shutdownPlan');
    const nextShutdownPlan = shutdownPlanIncluded
      ? candidate.shutdownPlan == null
        ? null
        : isShutdownPlanLike(candidate.shutdownPlan)
          ? candidate.shutdownPlan
          : (() => {
              throw new Error('invalid-shutdown-plan');
            })()
      : null;
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
      nextHardwareInfo,
      nextReminderStore,
      nextReminderAllowCloseWarningDismissed,
      nextShutdownPlan,
      shutdownPlanIncluded,
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
      await storageRepository.setJson(storageKeys.taskbarPrefs, plan.nextTaskbarPrefs);
    }
    if (plan.nextOverlayPosition) {
      storageRepository.setJsonSync(storageKeys.overlayPosition, plan.nextOverlayPosition);
      await storageRepository.setJson(storageKeys.overlayPosition, plan.nextOverlayPosition);
    }
    if (plan.nextTaskbarPosition) {
      storageRepository.setJsonSync(storageKeys.taskbarPosition, plan.nextTaskbarPosition);
      await storageRepository.setJson(storageKeys.taskbarPosition, plan.nextTaskbarPosition);
    }
    if (plan.nextHardwareInfo) {
      storageRepository.setJsonSync(storageKeys.hardwareInfo, plan.nextHardwareInfo);
      await storageRepository.setJson(storageKeys.hardwareInfo, plan.nextHardwareInfo);
    }
    if (plan.nextReminderStore) {
      await saveReminderStore(plan.nextReminderStore);
    }
    if (plan.nextReminderAllowCloseWarningDismissed != null) {
      if (plan.nextReminderAllowCloseWarningDismissed) {
        storageRepository.setStringSync(storageKeys.reminderAllowCloseWarningDismissed, '1');
        await storageRepository.setString(storageKeys.reminderAllowCloseWarningDismissed, '1');
      } else {
        storageRepository.removeSync(storageKeys.reminderAllowCloseWarningDismissed);
        await storageRepository.remove(storageKeys.reminderAllowCloseWarningDismissed);
      }
    }
    if (plan.nextRefreshRate != null) {
      await storageRepository.setString(storageKeys.refreshRate, String(plan.nextRefreshRate));
    }
    if (plan.shutdownPlanIncluded) {
      await applyShutdownPlan(plan.nextShutdownPlan);
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
