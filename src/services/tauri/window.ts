import type { TaskbarInfo } from '../../types';
import { tauriInvoke } from './core';

export const windowApi = {
  getTaskbarInfo: () => tauriInvoke<TaskbarInfo | null>('get_taskbar_info'),
  isFullscreenWindowActive: () => tauriInvoke<boolean>('is_fullscreen_window_active'),
  setWindowSystemTopmost: (label: string, topmost: boolean) =>
    tauriInvoke<void>('set_window_system_topmost', { label, topmost })
};
