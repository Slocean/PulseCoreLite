// Minimal KV storage wrapper:
// - Prefer IndexedDB (much larger quota than localStorage, avoids QuotaExceededError).
// - Fallback to localStorage when IndexedDB is unavailable.
//
// Values are stored as JSON strings even in IndexedDB to avoid Vue Proxy / structured-clone issues.

const DB_NAME = 'pulsecorelite';
const STORE_NAME = 'kv';

let dbPromise: Promise<IDBDatabase> | null = null;

function canUseIndexedDb(): boolean {
  return typeof window !== 'undefined' && typeof indexedDB !== 'undefined';
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

export async function kvGet<T>(key: string): Promise<T | undefined> {
  if (typeof window === 'undefined') return undefined;

  try {
    const raw = await idbGetRaw(key);
    if (!raw) return undefined;
    return JSON.parse(raw) as T;
  } catch {
    // Fallback to localStorage (legacy).
    try {
      const raw = localStorage.getItem(key);
      if (!raw) return undefined;
      return JSON.parse(raw) as T;
    } catch {
      return undefined;
    }
  }
}

export async function kvSet<T>(key: string, value: T): Promise<void> {
  if (typeof window === 'undefined') return;

  const raw = JSON.stringify(value);

  try {
    await idbSetRaw(key, raw);
  } catch {
    // Fallback to localStorage (may still fail if quota is exceeded).
    try {
      localStorage.setItem(key, raw);
    } catch {
      // Swallow: callers should never crash on persistence failures.
    }
  }
}

export async function kvDel(key: string): Promise<void> {
  if (typeof window === 'undefined') return;

  try {
    await idbDelRaw(key);
  } catch {
    try {
      localStorage.removeItem(key);
    } catch {
      // ignore
    }
  }
}

export async function kvResetAll(): Promise<void> {
  if (typeof window === 'undefined') return;
  if (!canUseIndexedDb()) return;

  // Close cached handle so the delete can proceed.
  try {
    const db = await dbPromise;
    db?.close?.();
  } catch {
    // ignore
  }
  dbPromise = null;

  await new Promise<void>((resolve) => {
    const req = indexedDB.deleteDatabase(DB_NAME);
    req.onsuccess = () => resolve();
    req.onerror = () => resolve();
    req.onblocked = () => resolve();
  });
}
