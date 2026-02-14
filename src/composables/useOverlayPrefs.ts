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
  backgroundOpacity: number;
  textTone: number;
  backgroundImage: string | null;
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
  showDragHandle: false,
  backgroundOpacity: 100,
  textTone: 100,
  backgroundImage: null
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
      showDragHandle: parsed.showDragHandle ?? fallbackPrefs.showDragHandle,
      backgroundOpacity: parsed.backgroundOpacity ?? fallbackPrefs.backgroundOpacity,
      textTone: parsed.textTone ?? fallbackPrefs.textTone,
      backgroundImage: parsed.backgroundImage ?? fallbackPrefs.backgroundImage
    };
  } catch {
    return fallbackPrefs;
  }
}

let sharedPrefs: OverlayPrefs | null = null;
let storageListenerAttached = false;

function applyTextTone(value: number) {
  if (typeof document === 'undefined') {
    return;
  }
  const safeValue = Math.min(100, Math.max(0, value));
  const channel = Math.round((safeValue / 100) * 255);
  const color = `rgb(${channel}, ${channel}, ${channel})`;
  document.documentElement.style.setProperty('--text-tone-color', color);
  document.documentElement.style.setProperty('--text', color);
}

export function useOverlayPrefs() {
  if (!sharedPrefs) {
    sharedPrefs = reactive<OverlayPrefs>(loadPrefs());

    watch(
      sharedPrefs,
      next => {
        localStorage.setItem(OVERLAY_PREF_KEY, JSON.stringify(next));
      },
      { deep: true }
    );

    watch(
      () => sharedPrefs!.textTone,
      value => {
        applyTextTone(value);
      },
      { immediate: true }
    );

    if (typeof window !== 'undefined' && !storageListenerAttached) {
      storageListenerAttached = true;
      window.addEventListener('storage', event => {
        if (event.key !== OVERLAY_PREF_KEY || !event.newValue) {
          return;
        }
        try {
          const parsed = JSON.parse(event.newValue) as Partial<OverlayPrefs>;
          if (typeof parsed.textTone === 'number' && sharedPrefs) {
            sharedPrefs.textTone = parsed.textTone;
          }
        } catch {
          return;
        }
      });
    }
  }

  return { prefs: sharedPrefs! };
}
