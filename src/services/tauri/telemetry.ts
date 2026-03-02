import type { AppBootstrap, HardwareInfo } from '../../types';
import { tauriInvoke } from './core';

export const telemetryApi = {
  getInitialState: () => tauriInvoke<AppBootstrap>('get_initial_state'),
  getHardwareInfo: () => tauriInvoke<HardwareInfo>('get_hardware_info'),
  toggleOverlay: (visible: boolean) => tauriInvoke<boolean>('toggle_overlay', { visible }),
  setRefreshRate: (rateMs: number) => tauriInvoke<void>('set_refresh_rate', { rateMs })
};
