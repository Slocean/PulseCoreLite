import { deleteImageRef, isImageRef } from '../../utils/imageStore';
import type { OverlayTheme } from './themeStore';

export function collectInUseImageRefs(
  backgroundImage: string | null | undefined,
  themes: OverlayTheme[],
  excludeId?: string
) {
  const refs = new Set<string>();
  if (isImageRef(backgroundImage)) {
    refs.add(backgroundImage);
  }
  for (const theme of themes) {
    if (excludeId && theme.id === excludeId) {
      continue;
    }
    if (isImageRef(theme.image)) {
      refs.add(theme.image);
    }
  }
  return refs;
}

export async function cleanupRemovedThemeImages(
  previous: OverlayTheme[],
  next: OverlayTheme[],
  backgroundImage: string | null | undefined
) {
  const inUse = collectInUseImageRefs(backgroundImage, next);
  for (const theme of previous) {
    if (isImageRef(theme.image) && !inUse.has(theme.image)) {
      await deleteImageRef(theme.image);
    }
  }
}

export async function cleanupOldBackgroundImage(
  oldValue: string | null | undefined,
  nextValue: string | null | undefined,
  themes: OverlayTheme[],
  backgroundImage: string | null | undefined
) {
  if (!isImageRef(oldValue) || oldValue === nextValue) {
    return;
  }
  const inUse = collectInUseImageRefs(backgroundImage, themes);
  if (!inUse.has(oldValue)) {
    await deleteImageRef(oldValue);
  }
}
