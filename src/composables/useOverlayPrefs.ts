import { onMounted, onUnmounted, reactive, watch } from 'vue';

import { storageKeys, storageRepository } from '../services/storageRepository';
import { emitSyncEvent, listenSyncEvent } from '../services/syncBus';
import { normalizeImageRef } from '../utils/imageStore';
import { debounce as createDebounce } from '../utils/debounce';

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
  backgroundThemeId: string | null;
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
  backgroundThemeId: null,
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
    backgroundThemeId: typeof parsed.backgroundThemeId === 'string' ? parsed.backgroundThemeId : null,
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
  await emitSyncEvent<null>(PREFS_SYNC_EVENT, null, { labels: ['main', 'taskbar', 'toolkit'] });
}

function loadPrefsFromLocalStorage(): OverlayPrefs {
  const parsed = storageRepository.getJsonSync<Partial<OverlayPrefs>>(storageKeys.overlayPrefs);
  return sanitizePrefs(parsed);
}

export function useOverlayPrefs() {
  const prefs = reactive<OverlayPrefs>(loadPrefsFromLocalStorage());
  let readyToPersist = false;
  let isSyncing = false; // Prevent sync event loops
  let unlistenSync: (() => void) | null = null;
  const persistPrefs = createDebounce((snapshot: OverlayPrefs) => {
    void storageRepository.setJson(storageKeys.overlayPrefs, snapshot);
    void broadcastPrefsSync();
  }, 400);

  watch(
    prefs,
    next => {
      if (!readyToPersist || isSyncing) return;

      // Avoid IndexedDB structured-clone issues with Vue proxies by persisting a JSON snapshot.
      const snapshot = JSON.parse(JSON.stringify(next)) as OverlayPrefs;
      persistPrefs(snapshot);
    },
    { deep: true }
  );

  onMounted(async () => {
    const fromKv = await storageRepository.getJson<Partial<OverlayPrefs>>(storageKeys.overlayPrefs, {
      migrateFromLocal: true
    });
    if (fromKv && typeof fromKv === 'object') {
      const sanitized = sanitizePrefs(fromKv);
      const normalizedImage = await normalizeImageRef(sanitized.backgroundImage);
      if (normalizedImage !== sanitized.backgroundImage) {
        sanitized.backgroundImage = normalizedImage;
        await storageRepository.setJson(storageKeys.overlayPrefs, sanitized);
      }
      Object.assign(prefs, sanitized);
    } else {
      const snapshot = JSON.parse(JSON.stringify(prefs)) as OverlayPrefs;
      const normalizedImage = await normalizeImageRef(snapshot.backgroundImage);
      if (normalizedImage !== snapshot.backgroundImage) {
        snapshot.backgroundImage = normalizedImage;
        Object.assign(prefs, snapshot);
      }
      await storageRepository.setJson(storageKeys.overlayPrefs, snapshot);
    }

    unlistenSync = await listenSyncEvent<null>(PREFS_SYNC_EVENT, async () => {
      if (isSyncing) return;
      isSyncing = true;
      try {
        const synced = await storageRepository.getJson<Partial<OverlayPrefs>>(storageKeys.overlayPrefs);
        if (synced && typeof synced === 'object') {
          const sanitized = sanitizePrefs(synced);
          // Only update values that are different to avoid unnecessary reactivity triggers
          const keys: (keyof OverlayPrefs)[] = [
            'backgroundOpacity',
            'backgroundThemeId',
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

    readyToPersist = true;
  });

  onUnmounted(() => {
    if (unlistenSync) {
      unlistenSync();
      unlistenSync = null;
    }
    persistPrefs.flush();
  });

  return { prefs };
}
