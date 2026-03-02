// Minimal KV storage wrapper:
// - Prefer IndexedDB (much larger quota than localStorage, avoids QuotaExceededError).
// - Fallback to localStorage when IndexedDB is unavailable.
//
// Values are stored as JSON strings even in IndexedDB to avoid Vue Proxy / structured-clone issues.

const DB_NAME = 'pulsecorelite';
const STORE_NAME = 'kv';
const KV_NAMESPACE_PREFIX = 'pulsecorelite.';
const KV_SCHEMA_VERSION = 1;
const KV_SCHEMA_VERSION_KEY = `${KV_NAMESPACE_PREFIX}kv_schema_version`;

let dbPromise: Promise<IDBDatabase> | null = null;
let schemaReadyPromise: Promise<void> | null = null;

function canUseIndexedDb(): boolean {
  return typeof window !== 'undefined' && typeof indexedDB !== 'undefined';
}

function normalizeKey(key: string): string {
  if (key.startsWith(KV_NAMESPACE_PREFIX)) {
    return key;
  }
  return `${KV_NAMESPACE_PREFIX}${key}`;
}

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

function parseVersion(raw: string | null | undefined): number | null {
  if (!raw) {
    return null;
  }
  const next = Number(raw);
  if (!Number.isFinite(next)) {
    return null;
  }
  return Math.max(0, Math.floor(next));
}

function openDb(): Promise<IDBDatabase> {
  if (!canUseIndexedDb()) {
    return Promise.reject(new Error('IndexedDB unavailable.'));
  }
  if (dbPromise) return dbPromise;

  dbPromise = new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, 1);

    req.onupgradeneeded = () => {
      const db = req.result;
      if (!db.objectStoreNames.contains(STORE_NAME)) {
        db.createObjectStore(STORE_NAME);
      }
    };

    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error ?? new Error('Failed to open IndexedDB.'));
  });

  return dbPromise;
}

async function idbGetRaw(key: string): Promise<string | null> {
  const db = await openDb();
  return await new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, 'readonly');
    const store = tx.objectStore(STORE_NAME);
    const req = store.get(key);
    req.onsuccess = () => resolve(typeof req.result === 'string' ? req.result : null);
    req.onerror = () => reject(req.error ?? new Error('IndexedDB get failed.'));
  });
}

async function idbSetRaw(key: string, value: string): Promise<void> {
  const db = await openDb();
  await new Promise<void>((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, 'readwrite');
    const store = tx.objectStore(STORE_NAME);
    const req = store.put(value, key);
    req.onsuccess = () => resolve();
    req.onerror = () => reject(req.error ?? new Error('IndexedDB put failed.'));
  });
}

async function idbDelRaw(key: string): Promise<void> {
  const db = await openDb();
  await new Promise<void>((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, 'readwrite');
    const store = tx.objectStore(STORE_NAME);
    const req = store.delete(key);
    req.onsuccess = () => resolve();
    req.onerror = () => reject(req.error ?? new Error('IndexedDB delete failed.'));
  });
}

async function ensureKvSchemaVersion(): Promise<void> {
  if (schemaReadyPromise) {
    return schemaReadyPromise;
  }

  schemaReadyPromise = (async () => {
    const storage = localStorageSafe();
    const localVersion = parseVersion(storage?.getItem(KV_SCHEMA_VERSION_KEY));
    if (localVersion != null && localVersion >= KV_SCHEMA_VERSION) {
      return;
    }

    let storedVersion: number | null = null;
    try {
      const raw = await idbGetRaw(KV_SCHEMA_VERSION_KEY);
      storedVersion = parseVersion(raw);
    } catch {
      storedVersion = null;
    }

    const nextVersion = storedVersion != null ? Math.max(storedVersion, KV_SCHEMA_VERSION) : KV_SCHEMA_VERSION;
    try {
      await idbSetRaw(KV_SCHEMA_VERSION_KEY, JSON.stringify(nextVersion));
    } catch {
      // ignore
    }
    try {
      storage?.setItem(KV_SCHEMA_VERSION_KEY, String(nextVersion));
    } catch {
      // ignore
    }
  })();

  return schemaReadyPromise;
}

export async function kvGet<T>(key: string): Promise<T | undefined> {
  if (typeof window === 'undefined') return undefined;
  await ensureKvSchemaVersion();
  const normalizedKey = normalizeKey(key);

  try {
    const raw = await idbGetRaw(normalizedKey);
    if (raw) {
      return JSON.parse(raw) as T;
    }
    if (normalizedKey !== key) {
      const legacyRaw = await idbGetRaw(key);
      if (legacyRaw) {
        try {
          await idbSetRaw(normalizedKey, legacyRaw);
          await idbDelRaw(key);
        } catch {
          // ignore migration errors
        }
        return JSON.parse(legacyRaw) as T;
      }
    }
  } catch {
    // ignore and fallback to localStorage
  }

  try {
    const storage = localStorageSafe();
    if (!storage) {
      return undefined;
    }
    const raw = storage.getItem(normalizedKey) ?? (normalizedKey !== key ? storage.getItem(key) : null);
    if (!raw) {
      return undefined;
    }
    if (normalizedKey !== key && storage.getItem(normalizedKey) == null) {
      storage.setItem(normalizedKey, raw);
      storage.removeItem(key);
    }
    return JSON.parse(raw) as T;
  } catch {
    return undefined;
  }
}

export async function kvSet<T>(key: string, value: T): Promise<void> {
  if (typeof window === 'undefined') return;
  await ensureKvSchemaVersion();
  const normalizedKey = normalizeKey(key);
  const raw = JSON.stringify(value);

  try {
    await idbSetRaw(normalizedKey, raw);
    if (normalizedKey !== key) {
      try {
        await idbDelRaw(key);
      } catch {
        // ignore
      }
    }
  } catch {
    // Fallback to localStorage (may still fail if quota is exceeded).
    try {
      const storage = localStorageSafe();
      if (!storage) {
        return;
      }
      storage.setItem(normalizedKey, raw);
      if (normalizedKey !== key) {
        storage.removeItem(key);
      }
    } catch {
      // Swallow: callers should never crash on persistence failures.
    }
  }
}

export async function kvDel(key: string): Promise<void> {
  if (typeof window === 'undefined') return;
  await ensureKvSchemaVersion();
  const normalizedKey = normalizeKey(key);

  try {
    await idbDelRaw(normalizedKey);
    if (normalizedKey !== key) {
      await idbDelRaw(key);
    }
  } catch {
    try {
      const storage = localStorageSafe();
      if (!storage) {
        return;
      }
      storage.removeItem(normalizedKey);
      if (normalizedKey !== key) {
        storage.removeItem(key);
      }
    } catch {
      // ignore
    }
  }
}

export async function kvResetAll(): Promise<void> {
  if (typeof window === 'undefined') return;
  if (!canUseIndexedDb()) return;

  try {
    const db = await dbPromise;
    db?.close?.();
  } catch {
    // ignore
  }
  dbPromise = null;
  schemaReadyPromise = null;

  await new Promise<void>(resolve => {
    const req = indexedDB.deleteDatabase(DB_NAME);
    req.onsuccess = () => resolve();
    req.onerror = () => resolve();
    req.onblocked = () => resolve();
  });
}
