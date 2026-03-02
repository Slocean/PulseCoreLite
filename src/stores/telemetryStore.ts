import { defineStore } from 'pinia';
import { markRaw } from 'vue';

import { api, inTauri } from '../services/tauri';
import type { AppBootstrap, HardwareInfo, TelemetrySnapshot } from '../types';
import { emptyHardware, emptySnapshot, persistHardwareInfo, readStoredHardwareInfo, resolveHardwareInfo } from './modules/appStateDomain';

export const useTelemetryStore = defineStore('telemetry', {
  state: () => ({
    snapshot: markRaw(emptySnapshot()) as TelemetrySnapshot,
    hardwareInfo: markRaw(readStoredHardwareInfo() ?? emptyHardware()) as HardwareInfo
  }),
  actions: {
    pushSnapshot(snapshot: TelemetrySnapshot) {
      this.snapshot = markRaw(snapshot);
    },
    applyBootstrap(payload: Pick<AppBootstrap, 'latest_snapshot' | 'hardware_info'>) {
      this.hardwareInfo = markRaw(resolveHardwareInfo(payload.hardware_info));
      this.pushSnapshot(payload.latest_snapshot ?? emptySnapshot());
    },
    async refreshHardwareInfo() {
      if (!inTauri()) {
        return;
      }
      try {
        const info = await api.getHardwareInfo();
        this.hardwareInfo = markRaw(info);
        persistHardwareInfo(info);
      } catch {
        return;
      }
    }
  }
});
