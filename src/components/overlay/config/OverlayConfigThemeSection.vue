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
        <UiSelect
          class="overlay-config-system-theme-select"
          :model-value="selectedSystemThemeId"
          :options="systemThemeOptions"
          :placeholder="t('overlay.themeDefault')"
          :aria-label="t('overlay.themeSystem')"
          width="116px"
          @update:model-value="selectSystemTheme" />
        <div class="overlay-theme-list">
          <div
            v-for="theme in themes"
            :key="theme.id"
            class="overlay-theme-chip"
            :class="{ 'overlay-theme-chip--active': isThemeActive(theme) }"
            :data-name="theme.name"
            @click="selectCustomTheme(theme)">
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
import UiSelect from '@/components/ui/Select';
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
const systemThemeOptions = computed(() => [
  { label: t('overlay.themeSystemDefault'), value: SYSTEM_DEFAULT_THEME_ID },
  ...props.systemThemes.map(theme => ({
    label: theme.name,
    value: theme.id
  }))
]);
const selectedSystemThemeId = computed<string | null>(() => {
  if (!props.prefs.backgroundThemeId) {
    return props.prefs.backgroundImage ? null : SYSTEM_DEFAULT_THEME_ID;
  }
  return props.systemThemes.some(theme => theme.id === props.prefs.backgroundThemeId) ? props.prefs.backgroundThemeId : null;
});

function selectDefaultTheme() {
  props.prefs.backgroundThemeId = null;
  if (!props.prefs.backgroundImage) {
    return;
  }
  props.prefs.backgroundImage = null;
  props.prefs.backgroundBlurPx = 0;
  props.prefs.backgroundEffect = DEFAULT_BACKGROUND_EFFECT;
  props.prefs.backgroundGlassStrength = DEFAULT_BACKGROUND_GLASS_STRENGTH;
}

function selectSystemTheme(value: string | number | Array<string | number> | null) {
  if (value == null || Array.isArray(value)) {
    return;
  }
  if (value === SYSTEM_DEFAULT_THEME_ID) {
    selectDefaultTheme();
    return;
  }
  const theme = props.systemThemes.find(item => item.id === value);
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
  if (
    props.prefs.backgroundThemeId === theme.id &&
    props.prefs.backgroundImage === theme.image &&
    clampBlurPx(props.prefs.backgroundBlurPx) === nextBlur &&
    normalizeBackgroundEffect(props.prefs.backgroundEffect) === nextEffect &&
    clampGlassStrength(props.prefs.backgroundGlassStrength) === nextGlass
  ) {
    return;
  }
  props.prefs.backgroundThemeId = theme.id;
  props.prefs.backgroundImage = theme.image;
  props.prefs.backgroundBlurPx = nextBlur;
  props.prefs.backgroundEffect = nextEffect;
  props.prefs.backgroundGlassStrength = nextGlass;
}

function isThemeActive(theme: OverlayTheme) {
  return props.prefs.backgroundThemeId === theme.id;
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
