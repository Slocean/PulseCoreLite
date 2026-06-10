import { tauriInvoke } from './core';
import type { StartupItem } from '@/types/startup';

export const startupApi = {
  listStartupItems: () => tauriInvoke<StartupItem[]>('list_startup_items'),
  setStartupItemEnabled: (id: string, enabled: boolean) =>
    tauriInvoke<void>('set_startup_item_enabled', { id, enabled })
};
