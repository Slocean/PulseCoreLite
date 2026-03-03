<template>
  <div v-if="!prefs.backgroundImage" class="overlay-config-range">
    <span class="overlay-config-label">{{ t('overlay.backgroundOpacity') }}</span>
    <span class="overlay-config-value">{{ backgroundOpacity }}%</span>
    <input type="range" min="0" max="100" step="5" v-model.number="backgroundOpacity" />
  </div>

  <div class="overlay-config-item--wide overlay-config-action">
    <div class="overlay-config-theme">
      <span class="overlay-config-label">{{ t('overlay.backgroundImage') }}</span>
      <div class="overlay-lang-buttons overlay-config-theme-tabs">
        <UiButton native-type="button" preset="overlay-chip-tab" :active="isDefaultTheme" @click="selectDefaultTheme">
          {{ t('overlay.themeDefault') }}
        </UiButton>
        <div class="overlay-theme-list">
          <div
            v-for="theme in themes"
            :key="theme.id"
            class="overlay-theme-chip"
            :class="{ 'overlay-theme-chip--active': isThemeActive(theme) }"
            :data-name="theme.name"
            @click="selectTheme(theme)">
            <span class="overlay-theme-thumb" :style="{ backgroundImage: `url(${getThemePreviewUrl(theme)})` }"></span>
            <CornerAction
              preset="overlay-corner-danger"
              icon="close"
              :ariaLabel="t('overlay.themeDelete')"
              @click.stop="emit('deleteTheme', theme.id)" />
            <CornerAction
              preset="overlay-corner-primary"
              icon="edit"
              :ariaLabel="t('overlay.themeEditTitle')"
              @click.stop="emit('editTheme', theme.id)" />
          </div>
        </div>
      </div>
    </div>
    <UiButton
      native-type="button"
      preset="overlay-chip-action"
      :disabled="!canAddTheme"
      @click="emit('openBackgroundDialog')">
      {{ t('overlay.backgroundImageButton') }}
    </UiButton>
  </div>
</template>

<script setup lang="ts">
import { computed } from 'vue';
import { useI18n } from 'vue-i18n';

import CornerAction from '@/components/overlay/CornerAction.vue';
import UiButton from '@/components/ui/Button';
import {
  DEFAULT_BACKGROUND_EFFECT,
  DEFAULT_BACKGROUND_GLASS_STRENGTH,
  type OverlayPrefs
} from '@/composables/useOverlayPrefs';
import type { OverlayTheme } from './types';

const props = defineProps<{
  prefs: OverlayPrefs;
  themes: OverlayTheme[];
  getThemePreviewUrl: (theme: OverlayTheme) => string;
}>();

const backgroundOpacity = defineModel<number>('backgroundOpacity', { required: true });

const emit = defineEmits<{
  (e: 'openBackgroundDialog'): void;
  (e: 'deleteTheme', value: string): void;
  (e: 'editTheme', value: string): void;
}>();

const { t } = useI18n();

const themes = computed(() => props.themes);
const isDefaultTheme = computed(() => !props.prefs.backgroundImage);
const canAddTheme = computed(() => props.themes.length < 3);

function selectDefaultTheme() {
  if (
    !props.prefs.backgroundImage &&
    props.prefs.backgroundBlurPx === 0 &&
    props.prefs.backgroundEffect === DEFAULT_BACKGROUND_EFFECT &&
    props.prefs.backgroundGlassStrength === DEFAULT_BACKGROUND_GLASS_STRENGTH
  ) {
    return;
  }
  props.prefs.backgroundImage = null;
  props.prefs.backgroundBlurPx = 0;
  props.prefs.backgroundEffect = DEFAULT_BACKGROUND_EFFECT;
  props.prefs.backgroundGlassStrength = DEFAULT_BACKGROUND_GLASS_STRENGTH;
}

function selectTheme(theme: OverlayTheme) {
  const nextBlur = clampBlurPx(theme.blurPx);
  const nextEffect = normalizeBackgroundEffect(theme.effect);
  const nextGlass = clampGlassStrength(theme.glassStrength);
  if (
    props.prefs.backgroundImage === theme.image &&
    clampBlurPx(props.prefs.backgroundBlurPx) === nextBlur &&
    normalizeBackgroundEffect(props.prefs.backgroundEffect) === nextEffect &&
    clampGlassStrength(props.prefs.backgroundGlassStrength) === nextGlass
  ) {
    return;
  }
  props.prefs.backgroundImage = theme.image;
  props.prefs.backgroundBlurPx = nextBlur;
  props.prefs.backgroundEffect = nextEffect;
  props.prefs.backgroundGlassStrength = nextGlass;
}

function isThemeActive(theme: OverlayTheme) {
  return (
    props.prefs.backgroundImage === theme.image &&
    clampBlurPx(props.prefs.backgroundBlurPx) === clampBlurPx(theme.blurPx) &&
    normalizeBackgroundEffect(props.prefs.backgroundEffect) === normalizeBackgroundEffect(theme.effect) &&
    clampGlassStrength(props.prefs.backgroundGlassStrength) === clampGlassStrength(theme.glassStrength)
  );
}

function normalizeBackgroundEffect(value: unknown) {
  return value === 'liquidGlass' ? 'liquidGlass' : DEFAULT_BACKGROUND_EFFECT;
}

function clampBlurPx(value: unknown) {
  const parsed = typeof value === 'number' && Number.isFinite(value) ? value : 0;
  return Math.max(0, Math.min(24, Math.round(parsed)));
}

function clampGlassStrength(value: unknown) {
  const parsed = typeof value === 'number' && Number.isFinite(value) ? value : DEFAULT_BACKGROUND_GLASS_STRENGTH;
  return Math.max(0, Math.min(100, Math.round(parsed)));
}
</script>
