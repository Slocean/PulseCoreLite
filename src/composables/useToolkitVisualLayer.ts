import { computed, onBeforeUnmount, ref, watch, type Reactive } from 'vue';

import { acquireImageUrl, normalizeImageRef, releaseImageRef } from '../utils/imageStore';
import type { OverlayBackgroundEffect, OverlayPrefs } from './useOverlayPrefs';

type UseToolkitVisualLayerOptions = {
  prefs: Reactive<OverlayPrefs>;
};

export function useToolkitVisualLayer({ prefs }: UseToolkitVisualLayerOptions) {
  const backgroundImageUrl = ref<string | null>(null);
  let backgroundImageRef: string | null = null;
  let backgroundResolveToken = 0;

  const overlayBackgroundStyle = computed(() => {
    if (!backgroundImageUrl.value) {
      return {};
    }
    const effect = normalizeBackgroundEffect(prefs.backgroundEffect);
    const blurPx = clampBlurPx(prefs.backgroundBlurPx);
    const glassStrength = clampGlassStrength(prefs.backgroundGlassStrength);
    return {
      backgroundImage: `url(${backgroundImageUrl.value})`,
      backgroundSize: 'cover',
      backgroundPosition: 'center',
      backgroundRepeat: 'no-repeat',
      filter: getBackgroundFilter(effect, blurPx, glassStrength),
      transform: effect === 'liquidGlass' ? 'scale(1.03)' : 'none'
    };
  });

  const showLiquidGlassHighlight = computed(
    () => Boolean(prefs.backgroundImage) && normalizeBackgroundEffect(prefs.backgroundEffect) === 'liquidGlass'
  );

  const overlayLiquidGlassHighlightStyle = computed(() => {
    const strength = clampGlassStrength(prefs.backgroundGlassStrength);
    const opacity = 0.14 + strength / 420;
    return {
      background:
        'radial-gradient(120% 90% at 0% 0%, rgba(255,255,255,0.34), rgba(255,255,255,0) 60%), radial-gradient(100% 80% at 100% 0%, rgba(180,220,255,0.18), rgba(180,220,255,0) 70%)',
      opacity: opacity.toFixed(3)
    };
  });

  watch(
    () => prefs.backgroundImage,
    async value => {
      const token = ++backgroundResolveToken;
      if (backgroundImageRef) {
        releaseImageRef(backgroundImageRef);
        backgroundImageRef = null;
      }
      if (!value) {
        backgroundImageUrl.value = null;
        return;
      }
      const normalized = await normalizeImageRef(value);
      if (normalized && normalized !== value) {
        prefs.backgroundImage = normalized;
      }
      const { url, ref } = await acquireImageUrl(normalized ?? value);
      if (token !== backgroundResolveToken) {
        releaseImageRef(ref);
        return;
      }
      backgroundImageRef = ref ?? null;
      backgroundImageUrl.value = url || null;
    },
    { immediate: true }
  );

  watch(
    () => prefs.backgroundOpacity,
    value => {
      if (typeof document === 'undefined') {
        return;
      }
      const safeValue = Math.max(0, Math.min(100, value));
      document.documentElement.style.setProperty('--overlay-bg-opacity', String(safeValue / 100));
    },
    { immediate: true }
  );

  onBeforeUnmount(() => {
    if (backgroundImageRef) {
      releaseImageRef(backgroundImageRef);
      backgroundImageRef = null;
    }
  });

  return {
    overlayBackgroundStyle,
    showLiquidGlassHighlight,
    overlayLiquidGlassHighlightStyle
  };
}

function clampBlurPx(value: unknown) {
  return typeof value === 'number' && Number.isFinite(value) ? Math.max(0, Math.min(40, Math.round(value))) : 0;
}

function clampGlassStrength(value: unknown) {
  return typeof value === 'number' && Number.isFinite(value) ? Math.max(0, Math.min(100, Math.round(value))) : 55;
}

function normalizeBackgroundEffect(value: unknown): OverlayBackgroundEffect {
  return value === 'liquidGlass' ? 'liquidGlass' : 'gaussian';
}

function getBackgroundFilter(effect: OverlayBackgroundEffect, blurPx: number, glassStrength: number) {
  const safeBlur = clampBlurPx(blurPx);
  if (effect === 'liquidGlass') {
    const strength = clampGlassStrength(glassStrength);
    const blur = 8 + Math.round((safeBlur / 40) * 14 + (strength / 100) * 8);
    const saturate = (130 + Math.round((strength / 100) * 70)).toString();
    const brightness = (92 + Math.round((strength / 100) * 12)).toString();
    return `blur(${blur}px) saturate(${saturate}%) brightness(${brightness}%)`;
  }
  return safeBlur > 0 ? `blur(${safeBlur}px)` : 'none';
}
