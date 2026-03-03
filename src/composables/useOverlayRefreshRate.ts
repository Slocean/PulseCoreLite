import { onMounted, ref } from 'vue';

import { storageKeys, storageRepository } from '../services/storageRepository';

export function useOverlayRefreshRate(store: { setRefreshRate: (rateMs: number) => Promise<void> | void }) {
  const refreshRate = ref(1000);
  const clampRefreshRate = (value: number) => Math.max(10, Math.min(2000, Math.round(value)));

  const applyRefreshRate = (value: number) => {
    const next = clampRefreshRate(value);
    refreshRate.value = next;
    store.setRefreshRate(next);
    void storageRepository.setString(storageKeys.refreshRate, String(next));
  };

  const handleRefreshRateChange = () => {
    applyRefreshRate(refreshRate.value);
  };

  onMounted(() => {
    void (async () => {
      const storedRate = await storageRepository.getString(storageKeys.refreshRate, {
        migrateFromLocal: true
      });
      if (!storedRate) {
        return;
      }
      const value = Number(storedRate);
      if (!Number.isFinite(value)) {
        return;
      }
      const next = clampRefreshRate(value);
      refreshRate.value = next;
      store.setRefreshRate(next);
    })();
  });

  return { refreshRate, handleRefreshRateChange };
}
