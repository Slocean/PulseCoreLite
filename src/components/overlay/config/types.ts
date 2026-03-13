import type { OverlayBackgroundEffect } from '@/composables/useOverlayPrefs';

export type OverlayTheme = {
  id: string;
  name: string;
  image: string;
  blurPx: number;
  effect: OverlayBackgroundEffect;
  glassStrength: number;
  textBrightnessBoost: boolean;
};
