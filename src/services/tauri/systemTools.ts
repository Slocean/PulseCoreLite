import { tauriInvoke } from './core';
import type { ContextMenuStyle, SystemToolsStatus } from '@/types/systemTools';

export const systemToolsApi = {
  getSystemToolsStatus: () => tauriInvoke<SystemToolsStatus>('get_system_tools_status'),
  applyContextMenuStyle: (style: ContextMenuStyle) =>
    tauriInvoke<SystemToolsStatus>('apply_context_menu_style', { style }),
  disableWindowsUpdatePermanently: () => tauriInvoke<void>('disable_windows_update_permanently'),
  restoreWindowsUpdatePermanently: () => tauriInvoke<void>('restore_windows_update_permanently'),
  launchMasActivation: () => tauriInvoke<void>('launch_mas_activation')
};
