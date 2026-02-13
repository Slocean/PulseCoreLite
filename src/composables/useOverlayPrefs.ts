import { reactive, watch } from 'vue';

const OVERLAY_PREF_KEY = 'pulsecorelite.overlay_prefs';

export interface OverlayPrefs {
  showCpu: boolean;
  showGpu: boolean;
  showMemory: boolean;
  showDisk: boolean;
  showDown: boolean;
  showUp: boolean;
  showLatency: boolean;
  showValues: boolean;
  showPercent: boolean;
  showHardwareInfo: boolean;
  showWarning: boolean;
  showDragHandle: boolean;
}

const fallbackPrefs: OverlayPrefs = {
  showCpu: true,
  showGpu: true,
  showMemory: true,
  showDisk: true,
  showDown: true,
  showUp: true,
  showLatency: true,
  showValues: true,
  showPercent: true,
  showHardwareInfo: false,
  showWarning: true,
  showDragHandle: false
};

function loadPrefs(): OverlayPrefs {
  try {
    const raw = localStorage.getItem(OVERLAY_PREF_KEY);
    if (!raw) {
      return fallbackPrefs;
    }
    const parsed = JSON.parse(raw) as Partial<OverlayPrefs>;
    return {
      showCpu: parsed.showCpu ?? fallbackPrefs.showCpu,
      showGpu: parsed.showGpu ?? fallbackPrefs.showGpu,
      showMemory: parsed.showMemory ?? fallbackPrefs.showMemory,
      showDisk: parsed.showDisk ?? fallbackPrefs.showDisk,
      showDown: parsed.showDown ?? fallbackPrefs.showDown,
      showUp: parsed.showUp ?? fallbackPrefs.showUp,
      showLatency: parsed.showLatency ?? fallbackPrefs.showLatency,
      showValues: parsed.showValues ?? fallbackPrefs.showValues,
      showPercent: parsed.showPercent ?? fallbackPrefs.showPercent,
      showHardwareInfo: parsed.showHardwareInfo ?? fallbackPrefs.showHardwareInfo,
      showWarning: parsed.showWarning ?? fallbackPrefs.showWarning,
      showDragHandle: parsed.showDragHandle ?? fallbackPrefs.showDragHandle
    };
  } catch {
    return fallbackPrefs;
  }
}

export function useOverlayPrefs() {
  const prefs = reactive<OverlayPrefs>(loadPrefs());

  watch(
    prefs,
    next => {
      localStorage.setItem(OVERLAY_PREF_KEY, JSON.stringify(next));
    },
    { deep: true }
  );

  return { prefs };
}
