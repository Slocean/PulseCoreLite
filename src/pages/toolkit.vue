<template>
  <section class="overlay-widget overlay-widget--cyber toolkit-page" @mousedown="handleToolkitMouseDown">
    <div v-if="prefs.backgroundImage" class="overlay-bg" :style="overlayBackgroundStyle" aria-hidden="true"></div>
    <div
      v-if="showLiquidGlassHighlight"
      class="overlay-bg overlay-bg--liquid-highlight"
      :style="overlayLiquidGlassHighlightStyle"
      aria-hidden="true"></div>

    <header class="toolkit-header">
      <div class="overlay-title toolkit-drag-region" data-tauri-drag-region>
        <h1 class="title">{{ t('toolkit.title') }}</h1>
      </div>
      <div class="overlay-header-actions">
        <div class="overlay-drag" @mousedown.stop="startDragging" :aria-label="t('overlay.showDragHandle')">
          <span class="material-symbols-outlined">drag_handle</span>
        </div>
        <button
          type="button"
          class="overlay-action overlay-action--primary"
          :aria-label="t('overlay.minimizeToTray')"
          @click="minimizeToolkitWindow">
          <span class="material-symbols-outlined">remove</span>
        </button>
        <button
          type="button"
          class="overlay-action overlay-action--danger"
          :aria-label="t('overlay.close')"
          @click="closeToolkitWindow">
          <span class="material-symbols-outlined">close</span>
        </button>
      </div>
    </header>

    <nav class="toolkit-tabs" :aria-label="t('toolkit.tabs')">
      <button
        v-for="tab in tabs"
        :key="tab.id"
        type="button"
        class="toolkit-tab"
        :class="{ 'toolkit-tab--active': activeTab === tab.id }"
        @click="activeTab = tab.id">
        {{ tab.label }}
      </button>
    </nav>

    <ToolkitShutdownTab v-if="activeTab === 'shutdown'" @contentChange="handleContentChange" />
    <ToolkitHardwareTab v-else @contentChange="handleContentChange" />
  </section>
</template>

<script setup lang="ts">
import { computed, nextTick, onMounted, ref, watch } from 'vue';
import { useI18n } from 'vue-i18n';

import ToolkitHardwareTab from '../components/toolkit/ToolkitHardwareTab.vue';
import ToolkitShutdownTab from '../components/toolkit/ToolkitShutdownTab.vue';
import { useOverlayPrefs, type OverlayBackgroundEffect } from '../composables/useOverlayPrefs';
import { inTauri } from '../services/tauri';

type ToolkitTab = 'shutdown' | 'hardware';

const { t } = useI18n();
const { prefs } = useOverlayPrefs();
const activeTab = ref<ToolkitTab>('shutdown');

const tabs = computed(() => [
  { id: 'shutdown' as const, label: t('toolkit.tabShutdown') },
  { id: 'hardware' as const, label: t('toolkit.tabHardware') }
]);

const overlayBackgroundStyle = computed(() => {
  const image = prefs.backgroundImage;
  if (!image) {
    return {};
  }
  const effect = normalizeBackgroundEffect(prefs.backgroundEffect);
  const blurPx = clampBlurPx(prefs.backgroundBlurPx);
  const glassStrength = clampGlassStrength(prefs.backgroundGlassStrength);
  return {
    backgroundImage: `url(${image})`,
    backgroundSize: 'cover',
    backgroundPosition: 'center',
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

watch(activeTab, () => {
  nextTick(updateWindowHeight);
});

onMounted(() => {
  setTimeout(updateWindowHeight, 100);
});

function handleContentChange() {
  nextTick(updateWindowHeight);
}

async function updateWindowHeight() {
  if (!inTauri()) return;
  try {
    const { getCurrentWindow } = await import('@tauri-apps/api/window');
    const { LogicalSize } = await import('@tauri-apps/api/dpi');
    const content = document.querySelector('.toolkit-page') as HTMLElement | null;
    const rect = content ? content.getBoundingClientRect() : document.body.getBoundingClientRect();
    const height = Math.ceil(rect.height);
    await getCurrentWindow().setSize(new LogicalSize(260, height));
  } catch {}
}

async function closeToolkitWindow() {
  if (!inTauri()) return;
  try {
    const { getCurrentWindow } = await import('@tauri-apps/api/window');
    await getCurrentWindow().close();
  } catch {
    // ignore
  }
}

async function minimizeToolkitWindow() {
  if (!inTauri()) return;
  try {
    const { getCurrentWindow } = await import('@tauri-apps/api/window');
    await getCurrentWindow().minimize();
  } catch {
    // ignore
  }
}

async function startDragging() {
  if (!inTauri()) return;
  try {
    const { getCurrentWindow } = await import('@tauri-apps/api/window');
    await getCurrentWindow().startDragging();
  } catch {
    // ignore
  }
}

function handleToolkitMouseDown(event: MouseEvent) {
  const target = event.target as HTMLElement | null;
  if (!target) return;
  if (target.closest('.overlay-header-actions')) return;
  if (target.closest('.toolkit-tabs, .toolkit-card')) return;
  if (target.closest('button, input, select, textarea, label, .overlay-config')) return;
  void startDragging();
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
    const s = clampGlassStrength(glassStrength);
    const blur = 8 + Math.round((safeBlur / 40) * 14 + (s / 100) * 8);
    const saturate = (130 + Math.round((s / 100) * 70)).toString();
    const brightness = (92 + Math.round((s / 100) * 12)).toString();
    return `blur(${blur}px) saturate(${saturate}%) brightness(${brightness}%)`;
  }
  return safeBlur > 0 ? `blur(${safeBlur}px)` : 'none';
}
</script>
