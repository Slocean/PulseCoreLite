import { onMounted, onUnmounted, reactive, watch } from 'vue';

import { inTauri, listenEvent } from '../services/tauri';
import { kvGet, kvSet } from '../utils/kv';
import { normalizeImageRef } from '../utils/imageStore';

const OVERLAY_PREF_KEY = 'pulsecorelite.overlay_prefs';
const PREFS_SYNC_EVENT = 'pulsecorelite://prefs-sync';

export type OverlayBackgroundEffect = 'gaussian' | 'liquidGlass';

export const DEFAULT_BACKGROUND_EFFECT: OverlayBackgroundEffect = 'gaussian';
export const DEFAULT_BACKGROUND_GLASS_STRENGTH = 55;

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
  // Blur strength for background image effects (in CSS px).
  backgroundBlurPx: number;
  // Effect mode for custom backgrounds/themes.
  backgroundEffect: OverlayBackgroundEffect;
  // Additional liquid-glass intensity (0-100).
  backgroundGlassStrength: number;
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
  backgroundImage: null,
  backgroundBlurPx: 0,
  backgroundEffect: DEFAULT_BACKGROUND_EFFECT,
  backgroundGlassStrength: DEFAULT_BACKGROUND_GLASS_STRENGTH
};

function sanitizeBackgroundEffect(value: unknown): OverlayBackgroundEffect {
  return value === 'liquidGlass' ? 'liquidGlass' : DEFAULT_BACKGROUND_EFFECT;
}

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
    backgroundImage: parsed.backgroundImage ?? fallbackPrefs.backgroundImage,
    backgroundBlurPx:
      typeof parsed.backgroundBlurPx === 'number' && Number.isFinite(parsed.backgroundBlurPx)
        ? Math.max(0, Math.min(40, Math.round(parsed.backgroundBlurPx)))
        : fallbackPrefs.backgroundBlurPx,
    backgroundEffect: sanitizeBackgroundEffect(parsed.backgroundEffect),
    backgroundGlassStrength:
      typeof parsed.backgroundGlassStrength === 'number' && Number.isFinite(parsed.backgroundGlassStrength)
        ? Math.max(0, Math.min(100, Math.round(parsed.backgroundGlassStrength)))
        : fallbackPrefs.backgroundGlassStrength
  };
}

async function broadcastPrefsSync() {
  if (!inTauri()) {
    return;
  }
  try {
    const [{ getCurrentWindow }, { WebviewWindow }] = await Promise.all([
      import('@tauri-apps/api/window'),
      import('@tauri-apps/api/webviewWindow')
    ]);
    const win = getCurrentWindow();
    const currentLabel = win.label;
    const targets: string[] = [];
    if (currentLabel !== 'main') targets.push('main');
    if (currentLabel !== 'toolkit') targets.push('toolkit');
    if (targets.length === 0) return;
    const existingTargets = await Promise.all(
      targets.map(async target => {
        try {
          return (await WebviewWindow.getByLabel(target)) ? target : null;
        } catch {
          return null;
        }
      })
    );
    await Promise.allSettled(
      existingTargets
        .filter((target): target is string => target != null)
        .map(target => win.emitTo(target, PREFS_SYNC_EVENT, null))
    );
  } catch {
    // ignore
  }
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
  let isSyncing = false; // Prevent sync event loops
  let unlistenSync: (() => void) | null = null;

  watch(
    prefs,
    next => {
      if (!readyToPersist || isSyncing) return;

      // Avoid IndexedDB structured-clone issues with Vue proxies by persisting a JSON snapshot.
      const snapshot = JSON.parse(JSON.stringify(next)) as OverlayPrefs;
      void kvSet(OVERLAY_PREF_KEY, snapshot);
      void broadcastPrefsSync();
    },
    { deep: true }
  );

  onMounted(async () => {
    const fromKv = await kvGet<Partial<OverlayPrefs>>(OVERLAY_PREF_KEY);
    if (fromKv && typeof fromKv === 'object') {
      const sanitized = sanitizePrefs(fromKv);
      const normalizedImage = await normalizeImageRef(sanitized.backgroundImage);
      if (normalizedImage !== sanitized.backgroundImage) {
        sanitized.backgroundImage = normalizedImage;
        await kvSet(OVERLAY_PREF_KEY, sanitized);
      }
      Object.assign(prefs, sanitized);
    } else {
      const snapshot = JSON.parse(JSON.stringify(prefs)) as OverlayPrefs;
      const normalizedImage = await normalizeImageRef(snapshot.backgroundImage);
      if (normalizedImage !== snapshot.backgroundImage) {
        snapshot.backgroundImage = normalizedImage;
        Object.assign(prefs, snapshot);
      }
      await kvSet(OVERLAY_PREF_KEY, snapshot);
    }

    // Legacy cleanup: stop consuming localStorage quota once migrated to IndexedDB.
    try {
      localStorage.removeItem(OVERLAY_PREF_KEY);
    } catch {
      // ignore
    }

    // Listen for prefs sync events from other windows
    if (inTauri()) {
      unlistenSync = await listenEvent<null>(PREFS_SYNC_EVENT, async () => {
        if (isSyncing) return;
        isSyncing = true;
        try {
          const synced = await kvGet<Partial<OverlayPrefs>>(OVERLAY_PREF_KEY);
          if (synced && typeof synced === 'object') {
            const sanitized = sanitizePrefs(synced);
            // Only update values that are different to avoid unnecessary reactivity triggers
            const keys: (keyof OverlayPrefs)[] = [
              'backgroundOpacity',
              'backgroundImage',
              'backgroundBlurPx',
              'backgroundEffect',
              'backgroundGlassStrength',
              'showCpu',
              'showGpu',
              'showMemory',
              'showDisk',
              'showDown',
              'showUp',
              'showLatency',
              'showValues',
              'showPercent',
              'showHardwareInfo',
              'showWarning',
              'showDragHandle'
            ];
            for (const key of keys) {
              if (prefs[key] !== sanitized[key]) {
                (prefs as any)[key] = sanitized[key];
              }
            }
          }
        } finally {
          isSyncing = false;
        }
      });
    }

    readyToPersist = true;
  });

  onUnmounted(() => {
    if (unlistenSync) {
      unlistenSync();
      unlistenSync = null;
    }
  });

  return { prefs };
}
