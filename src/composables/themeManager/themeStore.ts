import { kvGet, kvSet } from '../../utils/kv';
import type { OverlayBackgroundEffect } from '../useOverlayPrefs';

export type OverlayTheme = {
  id: string;
  name: string;
  image: string;
  blurPx: number;
  effect: OverlayBackgroundEffect;
  glassStrength: number;
};

export const THEME_STORAGE_KEY = 'pulsecorelite.overlay_themes';

export function loadThemesFromLocalStorage(
  sanitizeThemes: (input: unknown) => OverlayTheme[]
): OverlayTheme[] {
  try {
    const raw = localStorage.getItem(THEME_STORAGE_KEY);
    if (!raw) {
      return [];
    }
    return sanitizeThemes(JSON.parse(raw));
  } catch {
    return [];
  }
}

export async function readThemesFromKv(
  sanitizeThemes: (input: unknown) => OverlayTheme[]
): Promise<OverlayTheme[]> {
  const fromKv = await kvGet<unknown>(THEME_STORAGE_KEY);
  return sanitizeThemes(fromKv);
}

export async function persistThemes(next: OverlayTheme[]) {
  if (typeof window === 'undefined') {
    return;
  }
  await kvSet(THEME_STORAGE_KEY, next);
}

export function removeLegacyThemesFromLocalStorage() {
  try {
    localStorage.removeItem(THEME_STORAGE_KEY);
  } catch {
    // ignore
  }
}
