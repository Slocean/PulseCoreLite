import type { TaskbarInfo } from '../../types';
import { tauriInvoke } from './core';

interface NativeTaskbarConfig {
  language: string;
  alwaysOnTop: boolean;
  autoHideOnFullscreen: boolean;
  rememberPosition: boolean;
  positionLocked: boolean;
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

export const windowApi = {
  getTaskbarInfo: () => tauriInvoke<TaskbarInfo | null>('get_taskbar_info'),
  isFullscreenWindowActive: () => tauriInvoke<boolean>('is_fullscreen_window_active'),
  setWindowSystemTopmost: (label: string, topmost: boolean) =>
    tauriInvoke<void>('set_window_system_topmost', { label, topmost }),
  configureNativeTaskbarMonitor: (enabled: boolean, config: NativeTaskbarConfig) =>
    tauriInvoke<void>('configure_native_taskbar_monitor', { enabled, config })
};
