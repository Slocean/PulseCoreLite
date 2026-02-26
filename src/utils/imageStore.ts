import { kvDel, kvGet, kvSet } from './kv';

const IMAGE_REF_PREFIX = 'pcimg:';
const IMAGE_STORE_PREFIX = 'pulsecorelite.image.';

type CachedUrl = { url: string; refs: number };

const objectUrlCache = new Map<string, CachedUrl>();

function createId() {
  return `${Date.now()}_${Math.random().toString(36).slice(2, 10)}`;
}

export function isImageRef(value: string | null | undefined): value is string {
  return typeof value === 'string' && value.startsWith(IMAGE_REF_PREFIX);
}

export function isDataUrl(value: string | null | undefined): value is string {
  return typeof value === 'string' && value.startsWith('data:');
}

function toStoreKey(ref: string) {
  return IMAGE_STORE_PREFIX + ref.slice(IMAGE_REF_PREFIX.length);
}

export async function storeImageDataUrl(dataUrl: string): Promise<string> {
  const id = createId();
  const ref = `${IMAGE_REF_PREFIX}${id}`;
  await kvSet(toStoreKey(ref), dataUrl);
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
  return typeof stored === 'string' ? stored : null;
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
}

export async function normalizeImageRef(value: string | null | undefined): Promise<string | null> {
  if (!value) return null;
  if (isImageRef(value)) return value;
  if (isDataUrl(value)) return await storeImageDataUrl(value);
  return value;
}
