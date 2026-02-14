import { reactive, watch } from 'vue';

const TASKBAR_PREF_KEY = 'pulsecorelite.taskbar_prefs';

export interface TaskbarPrefs {
  showCpu: boolean;
  showCpuFreq: boolean;
  showCpuTemp: boolean;
  showGpu: boolean;
  showGpuTemp: boolean;
  showMemory: boolean;
  showDown: boolean;
  showUp: boolean;
  showLatency: boolean;
}

const fallbackPrefs: TaskbarPrefs = {
  showCpu: true,
  showCpuFreq: true,
  showCpuTemp: true,
  showGpu: true,
  showGpuTemp: true,
  showMemory: true,
  showDown: true,
  showUp: true,
  showLatency: false
};

function loadPrefs(): TaskbarPrefs {
  try {
    const raw = localStorage.getItem(TASKBAR_PREF_KEY);
    if (!raw) {
      return fallbackPrefs;
    }
    const parsed = JSON.parse(raw) as Partial<TaskbarPrefs>;
    return {
      showCpu: parsed.showCpu ?? fallbackPrefs.showCpu,
      showCpuFreq: parsed.showCpuFreq ?? fallbackPrefs.showCpuFreq,
      showCpuTemp: parsed.showCpuTemp ?? fallbackPrefs.showCpuTemp,
      showGpu: parsed.showGpu ?? fallbackPrefs.showGpu,
      showGpuTemp: parsed.showGpuTemp ?? fallbackPrefs.showGpuTemp,
      showMemory: parsed.showMemory ?? fallbackPrefs.showMemory,
      showDown: parsed.showDown ?? fallbackPrefs.showDown,
      showUp: parsed.showUp ?? fallbackPrefs.showUp,
      showLatency: parsed.showLatency ?? fallbackPrefs.showLatency
    };
  } catch {
    return fallbackPrefs;
  }
}

export function useTaskbarPrefs() {
  const prefs = reactive<TaskbarPrefs>(loadPrefs());

  watch(
    prefs,
    next => {
      localStorage.setItem(TASKBAR_PREF_KEY, JSON.stringify(next));
    },
    { deep: true }
  );

  return { prefs };
}

