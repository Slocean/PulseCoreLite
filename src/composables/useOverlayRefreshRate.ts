import { onMounted, ref } from 'vue';

const REFRESH_RATE_KEY = 'pulsecorelite.refresh_rate';

export function useOverlayRefreshRate(store: { setRefreshRate: (rateMs: number) => Promise<void> | void }) {
  const refreshRate = ref(1000);
  const clampRefreshRate = (value: number) => Math.max(10, Math.min(2000, Math.round(value)));

  const applyRefreshRate = (value: number) => {
    const next = clampRefreshRate(value);
    refreshRate.value = next;
    store.setRefreshRate(next);
    localStorage.setItem(REFRESH_RATE_KEY, String(next));
  };

  const handleRefreshRateChange = () => {
    applyRefreshRate(refreshRate.value);
  };

  onMounted(() => {
    const storedRate = localStorage.getItem(REFRESH_RATE_KEY);
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
  });

  return { refreshRate, handleRefreshRateChange };
}
