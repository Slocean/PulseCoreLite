import { defineStore } from 'pinia';

import { api, inTauri } from '../services/tauri';
import { kvResetAll } from '../utils/kv';

export const useSystemStore = defineStore('system', {
  state: () => ({
    installationMode: 'unknown' as 'unknown' | 'installed' | 'portable'
  }),
  actions: {
    async detectInstallationMode() {
      if (!inTauri()) {
        this.installationMode = 'portable';
        return;
      }
      try {
        this.installationMode = await api.getInstallationMode();
      } catch {
        this.installationMode = 'portable';
      }
    },
    setPortableMode() {
      this.installationMode = 'portable';
    },
    async factoryReset() {
      if (typeof window === 'undefined') {
        return;
      }
      await kvResetAll();
      window.localStorage.clear();
      window.location.reload();
    },
    async uninstallApp(title: string, message: string) {
      if (!inTauri()) {
        return;
      }
      await api.uninstallApp(title, message);
    },
    async exitApp() {
      if (!inTauri()) {
        return;
      }
      await api.exitApp();
    }
  }
});
