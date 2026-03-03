import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { createPinia, setActivePinia } from 'pinia';

import { useAppStore } from './app';
import { MEMORY_TRIM_MAX, MEMORY_TRIM_MIN } from './modules/appStateDomain';
import { storageKeys, storageRepository } from '../services/storageRepository';

vi.mock('../services/tauri', () => ({
  inTauri: () => false,
  listenEvent: vi.fn(async () => () => undefined),
  api: {
    getInitialState: vi.fn(),
    getHardwareInfo: vi.fn(),
    toggleOverlay: vi.fn(),
    setRefreshRate: vi.fn(),
    setMemoryTrimEnabled: vi.fn(),
    setMemoryTrimSystemEnabled: vi.fn(),
    setMemoryTrimIntervalMinutes: vi.fn(),
    confirmFactoryReset: vi.fn(),
    getInstallationMode: vi.fn(),
    uninstallApp: vi.fn(),
    getTaskbarInfo: vi.fn(),
    isFullscreenWindowActive: vi.fn(),
    setWindowSystemTopmost: vi.fn(),
    getAutoStartEnabled: vi.fn(),
    setAutoStartEnabled: vi.fn(),
    saveExportConfig: vi.fn(),
    getShutdownPlan: vi.fn(),
    scheduleShutdown: vi.fn(),
    cancelShutdownSchedule: vi.fn(),
    exitApp: vi.fn(),
    startProfileCapture: vi.fn(),
    stopProfileCapture: vi.fn(),
    getProfileStatus: vi.fn(),
    getProfileOutputDir: vi.fn(),
    openProfileOutputPath: vi.fn(),
    sendReminderEmail: vi.fn(),
    forceCloseReminderScreens: vi.fn(),
    getTaskReminderStore: vi.fn(),
    saveTaskReminderStore: vi.fn(),
    triggerTaskReminderNow: vi.fn()
  }
}));

describe('settings store actions (useAppStore)', () => {
  beforeEach(() => {
    setActivePinia(createPinia());
  });

  afterEach(() => {
    vi.restoreAllMocks();
    Reflect.deleteProperty(globalThis, 'window');
  });

  it('updates language setting', () => {
    const store = useAppStore();

    expect(store.settings.language).toBe('zh-CN');
    store.setLanguage('en-US');
    expect(store.settings.language).toBe('en-US');
  });

  it('clamps memory trim interval within supported bounds', async () => {
    const store = useAppStore();

    await store.setMemoryTrimIntervalMinutes(999);
    expect(store.settings.memoryTrimIntervalMinutes).toBe(MEMORY_TRIM_MAX);

    await store.setMemoryTrimIntervalMinutes(0);
    expect(store.settings.memoryTrimIntervalMinutes).toBe(MEMORY_TRIM_MIN);
  });

  it('clears persisted overlay position when rememberOverlayPosition is disabled', () => {
    Object.defineProperty(globalThis, 'window', {
      value: {},
      configurable: true
    });

    const removeSyncSpy = vi.spyOn(storageRepository, 'removeSync').mockImplementation(() => undefined);
    const store = useAppStore();

    store.setRememberOverlayPosition(false);

    expect(store.settings.rememberOverlayPosition).toBe(false);
    expect(removeSyncSpy).toHaveBeenCalledWith(storageKeys.overlayPosition);
  });
});
