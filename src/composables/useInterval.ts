import { onMounted, onUnmounted, ref } from 'vue';

interface UseIntervalOptions {
  immediate?: boolean;
  autoStart?: boolean;
}

export function useInterval(
  callback: () => void,
  intervalMs: number,
  options: UseIntervalOptions = {}
) {
  const immediate = options.immediate ?? false;
  const autoStart = options.autoStart ?? true;
  const isRunning = ref(false);
  let timer: number | null = null;

  function stop() {
    if (timer != null) {
      window.clearInterval(timer);
      timer = null;
    }
    isRunning.value = false;
  }

  function start() {
    if (typeof window === 'undefined' || isRunning.value) {
      return;
    }
    if (immediate) {
      callback();
    }
    timer = window.setInterval(callback, intervalMs);
    isRunning.value = true;
  }

  onMounted(() => {
    if (!autoStart) {
      return;
    }
    start();
  });

  onUnmounted(() => {
    stop();
  });

  return {
    isRunning,
    start,
    stop
  };
}
