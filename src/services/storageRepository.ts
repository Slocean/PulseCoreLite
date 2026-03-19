import { kvDel, kvGet, kvSet } from '../utils/kv';

const STORAGE_NAMESPACE = 'pulsecorelite';
export const STORAGE_SCHEMA_VERSION = 1;

export const storageKeys = {
  schemaVersion: `${STORAGE_NAMESPACE}.storage_schema_version`,
  settings: `${STORAGE_NAMESPACE}.settings`,
  hardwareInfo: `${STORAGE_NAMESPACE}.hardware_info`,
  overlayPrefs: `${STORAGE_NAMESPACE}.overlay_prefs`,
  overlayThemes: `${STORAGE_NAMESPACE}.overlay_themes`,
  taskbarPrefs: `${STORAGE_NAMESPACE}.taskbar_prefs`,
  localAiModelDir: `${STORAGE_NAMESPACE}.local_ai_model_dir`,
  localAiLauncherDir: `${STORAGE_NAMESPACE}.local_ai_launcher_dir`,
  localAiChatExpanded: `${STORAGE_NAMESPACE}.local_ai_chat_expanded`,
  overlayPosition: `${STORAGE_NAMESPACE}.overlay_pos`,
  taskbarPosition: `${STORAGE_NAMESPACE}.taskbar_pos`,
  refreshRate: `${STORAGE_NAMESPACE}.refresh_rate`,
  reminderAllowCloseWarningDismissed: `${STORAGE_NAMESPACE}.reminder_allow_close_warning_dismissed`,
  reminderScreenPrefix: `${STORAGE_NAMESPACE}.reminder-screen.`,
  reminderClosePrefix: `${STORAGE_NAMESPACE}.reminder-close.`
} as const;

type StorageWriteOptions = {
  mirrorToLocal?: boolean;
};

type StorageReadOptions = {
  migrateFromLocal?: boolean;
};

function localStorageSafe(): Storage | null {
  if (typeof window === 'undefined') {
    return null;
  }
  try {
    return window.localStorage;
  } catch {
    return null;
  }
}

function getLocalRaw(key: string): string | null {
  const storage = localStorageSafe();
  if (!storage) {
    return null;
  }
  try {
    return storage.getItem(key);
  } catch {
    return null;
  }
}

function setLocalRaw(key: string, value: string): void {
  const storage = localStorageSafe();
  if (!storage) {
    return;
  }
  try {
    storage.setItem(key, value);
  } catch {
    // ignore
  }
}

function removeLocalRaw(key: string): void {
  const storage = localStorageSafe();
  if (!storage) {
    return;
  }
  try {
    storage.removeItem(key);
  } catch {
    // ignore
  }
}

function parseVersion(raw: string | null | undefined): number | null {
  if (raw == null) {
    return null;
  }
  const next = Number(raw);
  if (!Number.isFinite(next)) {
    return null;
  }
  return Math.max(0, Math.floor(next));
}

function parseJson<T>(raw: string | null): T | undefined {
  if (!raw) {
    return undefined;
  }
  try {
    return JSON.parse(raw) as T;
  } catch {
    return undefined;
  }
}

let schemaReady: Promise<void> | null = null;

async function ensureSchemaVersion() {
  if (schemaReady) {
    return schemaReady;
  }

  schemaReady = (async () => {
    const localVersion = parseVersion(getLocalRaw(storageKeys.schemaVersion));
    if (localVersion != null && localVersion >= STORAGE_SCHEMA_VERSION) {
      return;
    }

    const storedVersion = await kvGet<number>(storageKeys.schemaVersion);
    const nextVersion =
      typeof storedVersion === 'number' && Number.isFinite(storedVersion)
        ? Math.max(STORAGE_SCHEMA_VERSION, Math.floor(storedVersion))
        : STORAGE_SCHEMA_VERSION;

    setLocalRaw(storageKeys.schemaVersion, String(nextVersion));
    await kvSet(storageKeys.schemaVersion, nextVersion);
  })();

  return schemaReady;
}

async function migrateJsonFromLocal<T>(key: string): Promise<T | undefined> {
  const localParsed = parseJson<T>(getLocalRaw(key));
  if (localParsed === undefined) {
    return undefined;
  }
  await kvSet(key, localParsed);
  return localParsed;
}

async function migrateStringFromLocal(key: string): Promise<string | undefined> {
  const localRaw = getLocalRaw(key);
  if (localRaw == null) {
    return undefined;
  }
  await kvSet(key, localRaw);
  return localRaw;
}

export const storageRepository = {
  async getJson<T>(key: string, options: StorageReadOptions = {}): Promise<T | undefined> {
    await ensureSchemaVersion();
    const stored = await kvGet<T>(key);
    if (stored !== undefined) {
      return stored;
    }
    if (!options.migrateFromLocal) {
      return undefined;
    }
    return migrateJsonFromLocal<T>(key);
  },
  async setJson<T>(key: string, value: T, options: StorageWriteOptions = {}): Promise<void> {
    await ensureSchemaVersion();
    await kvSet(key, value);
    if (options.mirrorToLocal !== false) {
      setLocalRaw(key, JSON.stringify(value));
    }
  },
  getJsonSync<T>(key: string): T | undefined {
    return parseJson<T>(getLocalRaw(key));
  },
  setJsonSync<T>(key: string, value: T): void {
    setLocalRaw(key, JSON.stringify(value));
  },
  async getString(key: string, options: StorageReadOptions = {}): Promise<string | undefined> {
    await ensureSchemaVersion();
    const stored = await kvGet<unknown>(key);
    if (typeof stored === 'string') {
      return stored;
    }
    if (stored != null) {
      return String(stored);
    }
    if (!options.migrateFromLocal) {
      return undefined;
    }
    return migrateStringFromLocal(key);
  },
  async setString(key: string, value: string, options: StorageWriteOptions = {}): Promise<void> {
    await ensureSchemaVersion();
    await kvSet(key, value);
    if (options.mirrorToLocal !== false) {
      setLocalRaw(key, value);
    }
  },
  getStringSync(key: string): string | undefined {
    const raw = getLocalRaw(key);
    return raw == null ? undefined : raw;
  },
  setStringSync(key: string, value: string): void {
    setLocalRaw(key, value);
  },
  async remove(key: string): Promise<void> {
    await ensureSchemaVersion();
    await kvDel(key);
    removeLocalRaw(key);
  },
  removeSync(key: string): void {
    removeLocalRaw(key);
  }
};
