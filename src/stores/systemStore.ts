import { defineStore } from 'pinia';

import { api, inTauri } from '../services/tauri';
import { kvResetAll } from '../utils/kv';

export const useSystemStore = defineStore('system', {
  state: () => ({
    installationMode: 'unknown' as 'unknown' | 'installed' | 'portable',
    runtimeVersion: '',
    packageFlavor: 'unknown' as 'unknown' | 'lite' | 'ai',
    canSwitchPackageFlavor: false,
    switchingPackageFlavor: false
  }),
  actions: {
    async detectRuntimeInfo() {
      if (!inTauri()) {
        this.installationMode = 'portable';
        this.packageFlavor = 'lite';
        this.canSwitchPackageFlavor = false;
        return;
      }
      try {
        const info = await api.getAppRuntimeInfo();
        this.installationMode = info.installationMode;
        this.runtimeVersion = info.version;
        this.packageFlavor = info.packageFlavor;
        this.canSwitchPackageFlavor = info.canSwitchPackageFlavor;
      } catch {
        this.installationMode = 'portable';
        this.packageFlavor = 'lite';
        this.canSwitchPackageFlavor = false;
      }
    },
    async detectInstallationMode() {
      await this.detectRuntimeInfo();
    },
    setPortableMode() {
      this.installationMode = 'portable';
      this.packageFlavor = 'lite';
      this.canSwitchPackageFlavor = false;
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
    async switchPackageFlavor() {
      if (!inTauri() || this.switchingPackageFlavor || !this.canSwitchPackageFlavor) {
        return;
      }
      const targetFlavor: 'lite' | 'ai' = this.packageFlavor === 'ai' ? 'lite' : 'ai';
      this.switchingPackageFlavor = true;
      try {
        await api.switchPackageFlavor(targetFlavor);
      } finally {
        this.switchingPackageFlavor = false;
      }
    },
    async exitApp() {
      if (!inTauri()) {
        return;
      }
      await api.exitApp();
    }
  }
});
