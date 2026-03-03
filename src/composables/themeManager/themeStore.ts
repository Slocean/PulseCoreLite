import { storageKeys, storageRepository } from '../../services/storageRepository';
import type { OverlayBackgroundEffect } from '../useOverlayPrefs';

export type OverlayTheme = {
  id: string;
  name: string;
  image: string;
  blurPx: number;
  effect: OverlayBackgroundEffect;
  glassStrength: number;
};

export const THEME_STORAGE_KEY = storageKeys.overlayThemes;

export function loadThemesFromLocalStorage(
  sanitizeThemes: (input: unknown) => OverlayTheme[]
): OverlayTheme[] {
  return sanitizeThemes(storageRepository.getJsonSync<unknown>(THEME_STORAGE_KEY) ?? []);
}

export async function readThemesFromKv(
  sanitizeThemes: (input: unknown) => OverlayTheme[]
): Promise<OverlayTheme[]> {
  const fromKv = await storageRepository.getJson<unknown>(THEME_STORAGE_KEY, {
    migrateFromLocal: true
  });
  return sanitizeThemes(fromKv);
}

export async function persistThemes(next: OverlayTheme[]) {
  await storageRepository.setJson(THEME_STORAGE_KEY, next);
}

export function removeLegacyThemesFromLocalStorage() {
  storageRepository.removeSync(THEME_STORAGE_KEY);
}
