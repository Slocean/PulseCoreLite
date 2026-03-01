<template>
  <section ref="pageRef" class="overlay-widget overlay-widget--cyber toolkit-page" @mousedown="handleToolkitMouseDown">
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
        <UiButton
          native-type="button"
          class="overlay-action overlay-action--primary"
          variant="icon"
          :aria-label="t('overlay.minimizeToTray')"
          @click="minimizeToolkitWindow">
          <span class="material-symbols-outlined">remove</span>
        </UiButton>
        <UiButton
          native-type="button"
          class="overlay-action overlay-action--danger"
          variant="icon"
          :aria-label="t('overlay.close')"
          @click="closeToolkitWindow">
          <span class="material-symbols-outlined">close</span>
        </UiButton>
      </div>
    </header>

    <nav class="toolkit-tabs" :aria-label="t('toolkit.tabs')">
      <UiButton
        v-for="tab in tabs"
        :key="tab.id"
        native-type="button"
        class="toolkit-tab"
        variant="text"
        :class="{ 'toolkit-tab--active': activeTab === tab.id }"
        @click="activeTab = tab.id">
        {{ tab.label }}
      </UiButton>
    </nav>

    <ToolkitShutdownTab v-if="activeTab === 'shutdown'" @contentChange="handleContentChange" />
    <ToolkitCleanupTab v-else-if="activeTab === 'cleanup'" @contentChange="handleContentChange" />
    <ToolkitHardwareTab v-else @contentChange="handleContentChange" />
  </section>
</template>

<script setup lang="ts">
import { computed, nextTick, onMounted, onUnmounted, ref, watch } from 'vue';
import { useI18n } from 'vue-i18n';

import UiButton from '@/components/ui/Button';
import ToolkitCleanupTab from '../components/toolkit/ToolkitCleanupTab.vue';
import ToolkitHardwareTab from '../components/toolkit/ToolkitHardwareTab.vue';
import ToolkitShutdownTab from '../components/toolkit/ToolkitShutdownTab.vue';
import { useOverlayPrefs, type OverlayBackgroundEffect } from '../composables/useOverlayPrefs';
import { inTauri } from '../services/tauri';

type ToolkitTab = 'shutdown' | 'cleanup' | 'hardware';

const { t } = useI18n();
const { prefs } = useOverlayPrefs();
const activeTab = ref<ToolkitTab>('shutdown');
const pageRef = ref<HTMLElement | null>(null);
let resizeObserver: ResizeObserver | undefined;
let resizeFrame: number | undefined;
let lastHeight = 0;
let windowApiPromise: Promise<typeof import('@tauri-apps/api/window')> | undefined;

const tabs = computed(() => [
  { id: 'shutdown' as const, label: t('toolkit.tabShutdown') },
  { id: 'cleanup' as const, label: t('toolkit.tabCleanup') },
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
  nextTick(scheduleResize);
});

onMounted(() => {
  if (typeof ResizeObserver !== 'undefined') {
    resizeObserver = new ResizeObserver(() => {
      scheduleResize();
    });
    if (pageRef.value) {
      resizeObserver.observe(pageRef.value);
    }
  }
  setTimeout(scheduleResize, 100);
});

onUnmounted(() => {
  if (resizeObserver && pageRef.value) {
    resizeObserver.unobserve(pageRef.value);
  }
  resizeObserver = undefined;
  if (resizeFrame != null) {
    window.cancelAnimationFrame(resizeFrame);
  }
});

function handleContentChange() {
  nextTick(scheduleResize);
}

function scheduleResize() {
  if (resizeFrame != null) return;
  resizeFrame = window.requestAnimationFrame(() => {
    resizeFrame = undefined;
    void updateWindowHeight();
  });
}

const getWindowApi = async () => {
  if (!windowApiPromise) {
    windowApiPromise = import('@tauri-apps/api/window');
  }
  return windowApiPromise;
};

async function updateWindowHeight() {
  if (!inTauri()) return;
  try {
    const { getCurrentWindow } = await getWindowApi();
    const { LogicalSize } = await import('@tauri-apps/api/dpi');
    const content = pageRef.value ?? (document.querySelector('.toolkit-page') as HTMLElement | null);
    const rect = content ? content.getBoundingClientRect() : document.body.getBoundingClientRect();
    const height = Math.max(1, Math.ceil(rect.height));
    if (Math.abs(height - lastHeight) < 2) {
      return;
    }
    lastHeight = height;
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

