import { onMounted, onUnmounted, ref } from 'vue';

export function useOverlayUptime() {
  const startedAt = Date.now();
  const uptimeLabel = ref('00:00:00');
  let uptimeTimer: number | undefined;

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

  const updateUptime = () => {
    uptimeLabel.value = formatUptime(Date.now() - startedAt);
  };

  onMounted(() => {
    updateUptime();
    uptimeTimer = window.setInterval(updateUptime, 1000);
  });

  onUnmounted(() => {
    if (uptimeTimer) {
      window.clearInterval(uptimeTimer);
    }
  });

  return { uptimeLabel };
}
