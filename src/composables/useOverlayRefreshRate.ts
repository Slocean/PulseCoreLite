import { onMounted, ref } from 'vue';

const REFRESH_RATE_KEY = 'pulsecorelite.refresh_rate';

export function useOverlayRefreshRate(store: { setRefreshRate: (rateMs: number) => Promise<void> | void }) {
  const refreshRate = ref(1000);

  const applyRefreshRate = (value: number) => {
    store.setRefreshRate(value);
    localStorage.setItem(REFRESH_RATE_KEY, String(value));
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
    refreshRate.value = value;
    store.setRefreshRate(value);
  });

  return { refreshRate, handleRefreshRateChange };
}
