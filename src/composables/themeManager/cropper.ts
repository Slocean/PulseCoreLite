import type { OverlayBackgroundEffect } from '../useOverlayPrefs';

export function getBackgroundFilter(
  effect: OverlayBackgroundEffect,
  blurPx: number,
  glassStrength: number,
  clampBlurPx: (value: unknown) => number,
  clampGlassStrength: (value: unknown) => number
) {
  const safeBlur = clampBlurPx(blurPx);
  if (effect === 'liquidGlass') {
    const safeStrength = clampGlassStrength(glassStrength);
    const minBlur = Math.max(2, safeBlur);
    const saturation = (1.25 + safeStrength / 140).toFixed(2);
    const contrast = (1.05 + safeStrength / 420).toFixed(2);
    const brightness = (1.01 + safeStrength / 900).toFixed(2);
    return `blur(${minBlur}px) saturate(${saturation}) contrast(${contrast}) brightness(${brightness})`;
  }
  return safeBlur > 0 ? `blur(${safeBlur}px)` : 'none';
}

export function getBackgroundScale(
  effect: OverlayBackgroundEffect,
  blurPx: number,
  glassStrength: number,
  clampBlurPx: (value: unknown) => number,
  clampGlassStrength: (value: unknown) => number
) {
  if (effect === 'liquidGlass') {
    const safeStrength = clampGlassStrength(glassStrength);
    return (1.06 + safeStrength / 1000).toFixed(3);
  }
  return (clampBlurPx(blurPx) > 0 ? 1.05 : 1).toString();
}

export function clampRange(value: number, min: number, max: number) {
  return Math.min(Math.max(value, min), max);
}
