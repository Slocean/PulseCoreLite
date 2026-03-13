<template>
  <div v-if="!prefs.backgroundImage" class="overlay-config-range">
    <span class="overlay-config-label">{{ t('overlay.backgroundOpacity') }}</span>
    <span class="overlay-config-value">{{ backgroundOpacity }}%</span>
    <input type="range" min="0" max="100" step="5" v-model.number="backgroundOpacity" />
  </div>

  <div class="overlay-config-item--wide overlay-config-theme-panel">
    <div class="overlay-config-theme-row">
      <span class="overlay-config-label">{{ t('overlay.themeSystem') }}</span>
      <div class="overlay-config-theme-controls overlay-config-theme-controls--custom">
        <div class="overlay-theme-list">
          <UiButton
            preset="overlay-chip"
            :class="{ 'overlay-theme-chip--active': isSystemThemeActive(SYSTEM_DEFAULT_THEME_ID) }"
            :aria-label="t('overlay.themeSystemDefault')"
            @click="selectSystemThemeById(SYSTEM_DEFAULT_THEME_ID)">
            {{ t('overlay.themeSystemDefault') }}
          </UiButton>
          <div
            v-for="theme in systemThemes"
            :key="theme.id"
            class="overlay-theme-chip"
            :class="{ 'overlay-theme-chip--active': isSystemThemeActive(theme.id) }"
            :data-name="theme.name"
            @click="selectSystemThemeById(theme.id)">
            <span
              class="overlay-theme-thumb"
              :style="{ backgroundImage: `url(${getThemePreviewUrl(theme)})` }"></span>
          </div>
        </div>
      </div>
    </div>

    <div class="overlay-config-theme-row">
      <span class="overlay-config-label">{{ t('overlay.customThemes') }}</span>
      <div class="overlay-config-theme-controls overlay-config-theme-controls--custom">
        <div class="overlay-theme-list">
          <div
            v-for="theme in themes"
            :key="theme.id"
            class="overlay-theme-chip"
            :class="{ 'overlay-theme-chip--active': isThemeActive(theme) }"
            :data-name="theme.name"
            @click="selectCustomTheme(theme)">
            <span
              class="overlay-theme-thumb"
              :style="{ backgroundImage: `url(${getThemePreviewUrl(theme)})` }"></span>
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
        <UiButton
          native-type="button"
          preset="overlay-chip-action"
          :disabled="!canAddTheme"
          @click="emit('openBackgroundDialog')">
          {{ t('overlay.backgroundImageButton') }}
        </UiButton>
      </div>
    </div>
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
import { SYSTEM_DEFAULT_THEME_ID } from '@/composables/themeManager/systemThemes';
import type { OverlayTheme } from './types';

const props = defineProps<{
  prefs: OverlayPrefs;
  systemThemes: OverlayTheme[];
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
const canAddTheme = computed(() => props.themes.length < 3);
const selectedSystemThemeId = computed<string | null>(() => {
  if (!props.prefs.backgroundThemeId) {
    return props.prefs.backgroundImage ? null : SYSTEM_DEFAULT_THEME_ID;
  }
  return props.systemThemes.some(theme => theme.id === props.prefs.backgroundThemeId)
    ? props.prefs.backgroundThemeId
    : null;
});

function selectDefaultTheme() {
  props.prefs.backgroundThemeId = null;
  props.prefs.textBrightnessBoost = 0;
  if (!props.prefs.backgroundImage) {
    return;
  }
  props.prefs.backgroundImage = null;
  props.prefs.backgroundBlurPx = 0;
  props.prefs.backgroundEffect = DEFAULT_BACKGROUND_EFFECT;
  props.prefs.backgroundGlassStrength = DEFAULT_BACKGROUND_GLASS_STRENGTH;
}

function selectSystemThemeById(themeId: string) {
  if (themeId === SYSTEM_DEFAULT_THEME_ID) {
    selectDefaultTheme();
    return;
  }
  const theme = props.systemThemes.find(item => item.id === themeId);
  if (!theme) {
    return;
  }
  applyTheme(theme);
}

function selectCustomTheme(theme: OverlayTheme) {
  applyTheme(theme);
}

function applyTheme(theme: OverlayTheme) {
  const nextBlur = clampBlurPx(theme.blurPx);
  const nextEffect = normalizeBackgroundEffect(theme.effect);
  const nextGlass = clampGlassStrength(theme.glassStrength);
  const nextTextBrightnessBoost = clampTextBrightnessBoost(theme.textBrightnessBoost);
  if (
    props.prefs.backgroundThemeId === theme.id &&
    props.prefs.backgroundImage === theme.image &&
    clampBlurPx(props.prefs.backgroundBlurPx) === nextBlur &&
    normalizeBackgroundEffect(props.prefs.backgroundEffect) === nextEffect &&
    clampGlassStrength(props.prefs.backgroundGlassStrength) === nextGlass &&
    props.prefs.textBrightnessBoost === nextTextBrightnessBoost
  ) {
    return;
  }
  props.prefs.backgroundThemeId = theme.id;
  props.prefs.backgroundImage = theme.image;
  props.prefs.backgroundBlurPx = nextBlur;
  props.prefs.backgroundEffect = nextEffect;
  props.prefs.backgroundGlassStrength = nextGlass;
  props.prefs.textBrightnessBoost = nextTextBrightnessBoost;
}

function isThemeActive(theme: OverlayTheme) {
  return props.prefs.backgroundThemeId === theme.id;
}

function isSystemThemeActive(themeId: string) {
  return selectedSystemThemeId.value === themeId;
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

function clampTextBrightnessBoost(value: unknown) {
  const parsed = typeof value === 'number' && Number.isFinite(value) ? value : 0;
  return Math.max(0, Math.min(100, Math.round(parsed)));
}
</script>

<style scoped>
.overlay-config-theme-panel {
  display: grid;
  gap: 4px;
}

.overlay-config-theme-row {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
}

.overlay-config-label {
  align-self: center;
}

.overlay-config-theme-controls {
  display: flex;
  align-items: center;
  justify-content: flex-end;
  gap: 8px;
  min-width: 0;
  flex: 1;
}

.overlay-config-theme-controls--custom {
  flex-wrap: wrap;
}
</style>
