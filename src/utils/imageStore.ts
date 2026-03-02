import { kvDel, kvGet, kvSet } from './kv';

const IMAGE_REF_PREFIX = 'pcimg:';
const IMAGE_STORE_PREFIX = 'pulsecorelite.image.';
const IMAGE_REGISTRY_KEY = 'pulsecorelite.image.registry';
const IMAGE_REGISTRY_VERSION = 1;
const IMAGE_STORE_MAX_ENTRIES = 48;
const IMAGE_STORE_MAX_BYTES = 50 * 1024 * 1024;

type CachedUrl = { url: string; refs: number };
type ImageRegistryEntry = { sizeBytes: number; lastAccess: number };
type ImageRegistry = {
  version: number;
  entries: Record<string, ImageRegistryEntry>;
};

const objectUrlCache = new Map<string, CachedUrl>();
let registryCache: ImageRegistry | null = null;
let registryLoadPromise: Promise<ImageRegistry> | null = null;
let registryMutationQueue: Promise<void> = Promise.resolve();

function createId() {
  return `${Date.now()}_${Math.random().toString(36).slice(2, 10)}`;
}

function nowMs() {
  return Date.now();
}

function defaultRegistry(): ImageRegistry {
  return {
    version: IMAGE_REGISTRY_VERSION,
    entries: {}
  };
}

function estimateDataUrlSize(dataUrl: string): number {
  const commaIndex = dataUrl.indexOf(',');
  if (commaIndex < 0) {
    return Math.max(0, dataUrl.length);
  }
  const header = dataUrl.slice(0, commaIndex).toLowerCase();
  const payload = dataUrl.slice(commaIndex + 1);
  if (header.includes(';base64')) {
    const padding = payload.endsWith('==') ? 2 : payload.endsWith('=') ? 1 : 0;
    return Math.max(0, Math.floor((payload.length * 3) / 4) - padding);
  }
  try {
    return decodeURIComponent(payload).length;
  } catch {
    return payload.length;
  }
}

function totalBytes(registry: ImageRegistry) {
  return Object.values(registry.entries).reduce((sum, entry) => sum + entry.sizeBytes, 0);
}

async function loadRegistry(): Promise<ImageRegistry> {
  if (registryCache) {
    return registryCache;
  }
  if (registryLoadPromise) {
    return registryLoadPromise;
  }
  registryLoadPromise = (async () => {
    const raw = await kvGet<ImageRegistry | null>(IMAGE_REGISTRY_KEY);
    if (raw && typeof raw === 'object' && raw.version === IMAGE_REGISTRY_VERSION && raw.entries) {
      registryCache = {
        version: IMAGE_REGISTRY_VERSION,
        entries: { ...raw.entries }
      };
      return registryCache;
    }
    registryCache = defaultRegistry();
    return registryCache;
  })();
  try {
    return await registryLoadPromise;
  } finally {
    registryLoadPromise = null;
  }
}

async function saveRegistry(registry: ImageRegistry) {
  registryCache = registry;
  await kvSet(IMAGE_REGISTRY_KEY, registry);
}

function queueRegistryMutation(task: (registry: ImageRegistry) => Promise<void> | void): Promise<void> {
  registryMutationQueue = registryMutationQueue.then(async () => {
    const registry = await loadRegistry();
    await task(registry);
    await saveRegistry(registry);
  });
  return registryMutationQueue.catch(() => undefined);
}

function toStoreKey(ref: string) {
  return IMAGE_STORE_PREFIX + ref.slice(IMAGE_REF_PREFIX.length);
}

function isRefInUse(ref: string): boolean {
  const cached = objectUrlCache.get(ref);
  return Boolean(cached && cached.refs > 0);
}

async function pruneImageStore(excludeRefs: Set<string> = new Set()) {
  await queueRegistryMutation(async registry => {
    const keys = Object.keys(registry.entries);
    if (keys.length === 0) {
      return;
    }

    const sorted = keys
      .map(ref => ({
        ref,
        ...registry.entries[ref]
      }))
      .sort((a, b) => a.lastAccess - b.lastAccess);

    let entryCount = keys.length;
    let sizeBytes = totalBytes(registry);
    for (const candidate of sorted) {
      const overLimit = entryCount > IMAGE_STORE_MAX_ENTRIES || sizeBytes > IMAGE_STORE_MAX_BYTES;
      if (!overLimit) {
        break;
      }
      if (excludeRefs.has(candidate.ref) || isRefInUse(candidate.ref)) {
        continue;
      }
      await kvDel(toStoreKey(candidate.ref));
      delete registry.entries[candidate.ref];
      if (objectUrlCache.has(candidate.ref)) {
        const cached = objectUrlCache.get(candidate.ref);
        if (cached) {
          URL.revokeObjectURL(cached.url);
        }
        objectUrlCache.delete(candidate.ref);
      }
      entryCount -= 1;
      sizeBytes -= candidate.sizeBytes;
    }
  });
}

async function touchImageRef(ref: string, sizeBytes?: number) {
  await queueRegistryMutation(async registry => {
    const current = registry.entries[ref];
    registry.entries[ref] = {
      sizeBytes: typeof sizeBytes === 'number' && Number.isFinite(sizeBytes) ? Math.max(0, Math.floor(sizeBytes)) : current?.sizeBytes ?? 0,
      lastAccess: nowMs()
    };
  });
}

async function removeImageRefMeta(ref: string) {
  await queueRegistryMutation(async registry => {
    if (!registry.entries[ref]) {
      return;
    }
    delete registry.entries[ref];
  });
}

export function isImageRef(value: string | null | undefined): value is string {
  return typeof value === 'string' && value.startsWith(IMAGE_REF_PREFIX);
}

export function isDataUrl(value: string | null | undefined): value is string {
  return typeof value === 'string' && value.startsWith('data:');
}

export async function storeImageDataUrl(dataUrl: string): Promise<string> {
  const id = createId();
  const ref = `${IMAGE_REF_PREFIX}${id}`;
  await kvSet(toStoreKey(ref), dataUrl);
  await touchImageRef(ref, estimateDataUrlSize(dataUrl));
  await pruneImageStore(new Set([ref]));
  return ref;
}

export async function resolveImageRefToDataUrl(refOrDataUrl: string): Promise<string | null> {
  if (isDataUrl(refOrDataUrl)) {
    return refOrDataUrl;
  }
  if (!isImageRef(refOrDataUrl)) {
    return null;
  }
  const stored = await kvGet<string>(toStoreKey(refOrDataUrl));
  if (typeof stored === 'string') {
    await touchImageRef(refOrDataUrl, estimateDataUrlSize(stored));
    return stored;
  }
  await removeImageRefMeta(refOrDataUrl);
  return null;
}

async function dataUrlToObjectUrl(dataUrl: string): Promise<string> {
  const blob = await (await fetch(dataUrl)).blob();
  return URL.createObjectURL(blob);
}

export async function acquireImageUrl(value: string): Promise<{ url: string; ref?: string }> {
  if (isImageRef(value)) {
    const cached = objectUrlCache.get(value);
    if (cached) {
      cached.refs += 1;
      void touchImageRef(value);
      return { url: cached.url, ref: value };
    }
    const dataUrl = await resolveImageRefToDataUrl(value);
    if (!dataUrl) {
      return { url: '', ref: value };
    }
    const url = await dataUrlToObjectUrl(dataUrl);
    objectUrlCache.set(value, { url, refs: 1 });
    return { url, ref: value };
  }

  if (isDataUrl(value)) {
    const ref = await storeImageDataUrl(value);
    return await acquireImageUrl(ref);
  }

  return { url: value };
}

export function releaseImageRef(ref: string | null | undefined) {
  if (!ref || !isImageRef(ref)) {
    return;
  }
  const cached = objectUrlCache.get(ref);
  if (!cached) {
    return;
  }
  cached.refs -= 1;
  if (cached.refs <= 0) {
    URL.revokeObjectURL(cached.url);
    objectUrlCache.delete(ref);
  }
}

export async function deleteImageRef(ref: string | null | undefined) {
  if (!ref || !isImageRef(ref)) {
    return;
  }
  releaseImageRef(ref);
  await kvDel(toStoreKey(ref));
  await removeImageRefMeta(ref);
}

export async function normalizeImageRef(value: string | null | undefined): Promise<string | null> {
  if (!value) return null;
  if (isImageRef(value)) return value;
  if (isDataUrl(value)) return await storeImageDataUrl(value);
  return value;
}
