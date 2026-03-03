export type AppLanguage = 'zh-CN' | 'en-US';

export interface AppSettings {
  language: AppLanguage;
  closeToTray: boolean;
  autoStartEnabled: boolean;
  memoryTrimEnabled: boolean;
  memoryTrimSystemEnabled: boolean;
  memoryTrimTargets: Array<'app' | 'system'>;
  memoryTrimIntervalMinutes: number;
  rememberOverlayPosition: boolean;
  overlayAlwaysOnTop: boolean;
  taskbarMonitorEnabled: boolean;
  taskbarAlwaysOnTop: boolean;
  taskbarAutoHideOnFullscreen: boolean;
  taskbarPositionLocked: boolean;
  factoryResetHotkey: string | null;
}
