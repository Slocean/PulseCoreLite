import { onMounted, onUnmounted, reactive, watch } from 'vue';

import { storageKeys, storageRepository } from '../services/storageRepository';
import { emitSyncEvent, listenSyncEvent } from '../services/syncBus';

const TASKBAR_PREFS_SYNC_EVENT = 'pulsecorelite://taskbar-prefs-sync';

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

const TASKBAR_PREF_KEYS: (keyof TaskbarPrefs)[] = [
  'showCpu',
  'showCpuFreq',
  'showCpuTemp',
  'showGpu',
  'showGpuTemp',
  'showMemory',
  'showApp',
  'showDown',
  'showUp',
  'showLatency',
  'twoLineMode'
];

function sanitizePrefs(input: Partial<TaskbarPrefs> | null | undefined): TaskbarPrefs {
  const parsed = input ?? {};
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

function loadPrefsFromLocalStorage(): TaskbarPrefs {
  const parsed = storageRepository.getJsonSync<Partial<TaskbarPrefs>>(storageKeys.taskbarPrefs);
  return sanitizePrefs(parsed);
}

async function broadcastTaskbarPrefsSync() {
  await emitSyncEvent<null>(TASKBAR_PREFS_SYNC_EVENT, null, { labels: ['main', 'taskbar', 'toolkit'] });
}

export function useTaskbarPrefs() {
  const prefs = reactive<TaskbarPrefs>(loadPrefsFromLocalStorage());

  let readyToPersist = false;
  let isSyncing = false;
  let unlistenSync: (() => void) | null = null;

  watch(
    prefs,
    next => {
      if (!readyToPersist || isSyncing) {
        return;
      }
      const snapshot = JSON.parse(JSON.stringify(next)) as TaskbarPrefs;
      void storageRepository.setJson(storageKeys.taskbarPrefs, snapshot);
      void broadcastTaskbarPrefsSync();
    },
    { deep: true }
  );

  onMounted(async () => {
    const fromKv = await storageRepository.getJson<Partial<TaskbarPrefs>>(storageKeys.taskbarPrefs, {
      migrateFromLocal: true
    });

    if (fromKv && typeof fromKv === 'object') {
      Object.assign(prefs, sanitizePrefs(fromKv));
    } else {
      const snapshot = JSON.parse(JSON.stringify(prefs)) as TaskbarPrefs;
      await storageRepository.setJson(storageKeys.taskbarPrefs, snapshot);
    }

    unlistenSync = await listenSyncEvent<null>(TASKBAR_PREFS_SYNC_EVENT, async () => {
      if (isSyncing) {
        return;
      }
      isSyncing = true;
      try {
        const synced = await storageRepository.getJson<Partial<TaskbarPrefs>>(storageKeys.taskbarPrefs);
        if (!synced || typeof synced !== 'object') {
          return;
        }
        const sanitized = sanitizePrefs(synced);
        for (const key of TASKBAR_PREF_KEYS) {
          if (prefs[key] !== sanitized[key]) {
            prefs[key] = sanitized[key];
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
  });

  return { prefs };
}
