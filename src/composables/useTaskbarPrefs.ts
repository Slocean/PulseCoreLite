import { reactive, watch } from 'vue';

import { storageKeys, storageRepository } from '../services/storageRepository';

export interface TaskbarPrefs {
  showCpu: boolean;
  showCpuFreq: boolean;
  showCpuTemp: boolean;
  showGpu: boolean;
  showGpuTemp: boolean;
  showMemory: boolean;
  showApp: boolean;
  showDown: boolean;
  showUp: boolean;
  showLatency: boolean;
  twoLineMode: boolean;
}

const fallbackPrefs: TaskbarPrefs = {
  showCpu: true,
  showCpuFreq: true,
  showCpuTemp: true,
  showGpu: true,
  showGpuTemp: true,
  showMemory: true,
  showApp: true,
  showDown: true,
  showUp: true,
  showLatency: false,
  twoLineMode: false
};

function loadPrefs(): TaskbarPrefs {
  const parsed = storageRepository.getJsonSync<Partial<TaskbarPrefs>>(storageKeys.taskbarPrefs) ?? {};
  return {
    showCpu: parsed.showCpu ?? fallbackPrefs.showCpu,
    showCpuFreq: parsed.showCpuFreq ?? fallbackPrefs.showCpuFreq,
    showCpuTemp: parsed.showCpuTemp ?? fallbackPrefs.showCpuTemp,
    showGpu: parsed.showGpu ?? fallbackPrefs.showGpu,
    showGpuTemp: parsed.showGpuTemp ?? fallbackPrefs.showGpuTemp,
    showMemory: parsed.showMemory ?? fallbackPrefs.showMemory,
    showApp: parsed.showApp ?? fallbackPrefs.showApp,
    showDown: parsed.showDown ?? fallbackPrefs.showDown,
    showUp: parsed.showUp ?? fallbackPrefs.showUp,
    showLatency: parsed.showLatency ?? fallbackPrefs.showLatency,
    twoLineMode: parsed.twoLineMode ?? fallbackPrefs.twoLineMode
  };
}

export function useTaskbarPrefs() {
  const prefs = reactive<TaskbarPrefs>(loadPrefs());

  watch(
    prefs,
    next => {
      void storageRepository.setJson(storageKeys.taskbarPrefs, next);
    },
    { deep: true }
  );

  return { prefs };
}

