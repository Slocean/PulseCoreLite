import { onMounted, reactive, watch } from 'vue';

import { kvGet, kvSet } from '../utils/kv';

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
  backgroundImage: null
};

function sanitizePrefs(input: Partial<OverlayPrefs> | null | undefined): OverlayPrefs {
  const parsed = input ?? {};
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
    backgroundImage: parsed.backgroundImage ?? fallbackPrefs.backgroundImage
  };
}

function loadPrefsFromLocalStorage(): OverlayPrefs {
  try {
    const raw = localStorage.getItem(OVERLAY_PREF_KEY);
    if (!raw) {
      return fallbackPrefs;
    }
    const parsed = JSON.parse(raw) as Partial<OverlayPrefs>;
    return sanitizePrefs(parsed);
  } catch {
    return fallbackPrefs;
  }
}

export function useOverlayPrefs() {
  const prefs = reactive<OverlayPrefs>(loadPrefsFromLocalStorage());
  let readyToPersist = false;

  watch(
    prefs,
    next => {
      if (!readyToPersist) return;

      // Avoid IndexedDB structured-clone issues with Vue proxies by persisting a JSON snapshot.
      const snapshot = JSON.parse(JSON.stringify(next)) as OverlayPrefs;
      void kvSet(OVERLAY_PREF_KEY, snapshot);
    },
    { deep: true }
  );

  onMounted(async () => {
    const fromKv = await kvGet<Partial<OverlayPrefs>>(OVERLAY_PREF_KEY);
    if (fromKv && typeof fromKv === 'object') {
      Object.assign(prefs, sanitizePrefs(fromKv));
    } else {
      const snapshot = JSON.parse(JSON.stringify(prefs)) as OverlayPrefs;
      await kvSet(OVERLAY_PREF_KEY, snapshot);
    }

    // Legacy cleanup: stop consuming localStorage quota once migrated to IndexedDB.
    try {
      localStorage.removeItem(OVERLAY_PREF_KEY);
    } catch {
      // ignore
    }

    readyToPersist = true;
  });

  return { prefs };
}
