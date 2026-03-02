import { computed, ref } from 'vue';

import { useInterval } from './useInterval';

export function useOverlayUptime() {
  const startedAt = Date.now();
  const elapsedMs = ref(0);

  const formatUptime = (ms: number) => {
    const totalSeconds = Math.floor(ms / 1000);
    const hours = Math.floor(totalSeconds / 3600)
      .toString()
      .padStart(2, '0');
    const minutes = Math.floor((totalSeconds % 3600) / 60)
      .toString()
      .padStart(2, '0');
    const seconds = Math.floor(totalSeconds % 60)
      .toString()
      .padStart(2, '0');
    return `${hours}:${minutes}:${seconds}`;
  };

  const updateElapsed = () => {
    elapsedMs.value = Date.now() - startedAt;
  };

  useInterval(updateElapsed, 1000, { immediate: true });
  const uptimeLabel = computed(() => formatUptime(elapsedMs.value));

  return { uptimeLabel };
}
