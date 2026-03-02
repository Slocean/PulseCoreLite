import { tauriInvoke } from './core';

export const systemApi = {
  setMemoryTrimEnabled: (enabled: boolean) => tauriInvoke<void>('set_memory_trim_enabled', { enabled }),
  setMemoryTrimSystemEnabled: (enabled: boolean) => tauriInvoke<void>('set_memory_trim_system_enabled', { enabled }),
  setMemoryTrimIntervalMinutes: (intervalMinutes: number) =>
    tauriInvoke<void>('set_memory_trim_interval', { intervalMinutes }),
  confirmFactoryReset: (title: string, message: string) =>
    tauriInvoke<boolean>('confirm_factory_reset', { title, message }),
  getInstallationMode: () => tauriInvoke<'installed' | 'portable'>('get_installation_mode'),
  uninstallApp: (title: string, message: string) => tauriInvoke<void>('uninstall_app', { title, message }),
  getAutoStartEnabled: () => tauriInvoke<boolean>('get_auto_start_enabled'),
  setAutoStartEnabled: (enabled: boolean) => tauriInvoke<boolean>('set_auto_start_enabled', { enabled }),
  saveExportConfig: (path: string, content: string) => tauriInvoke<void>('save_export_config', { path, content }),
  exitApp: () => tauriInvoke<void>('exit_app')
};
