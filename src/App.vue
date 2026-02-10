<template>
  <div class="app-root" :style="themeVars" :class="{ 'app-root--bigscreen': store.bigScreen }">
    <div v-if="isOverlay" class="overlay-shell">
      <router-view />
    </div>

    <div v-else class="app-shell">
      <div class="ambient-grid"></div>
      <div class="ambient-glow ambient-glow--left"></div>
      <div class="ambient-glow ambient-glow--right"></div>

      <aside v-if="!store.bigScreen" class="cyber-sidebar glass-panel">
        <div class="brand-block">
          <div class="brand-icon">PC</div>
          <div>
            <h1>{{ t("app.name") }}</h1>
            <p>{{ t("app.tagline") }}</p>
          </div>
        </div>

        <nav class="nav-links">
          <RouterLink to="/dashboard" class="nav-link">
            <span class="material-symbols-outlined">dashboard</span>
            <span>{{ t("nav.dashboard") }}</span>
          </RouterLink>
          <RouterLink to="/network" class="nav-link">
            <span class="material-symbols-outlined">wifi</span>
            <span>{{ t("nav.network") }}</span>
          </RouterLink>
          <RouterLink to="/hardware" class="nav-link">
            <span class="material-symbols-outlined">memory</span>
            <span>{{ t("nav.hardware") }}</span>
          </RouterLink>
          <RouterLink to="/settings" class="nav-link">
            <span class="material-symbols-outlined">tune</span>
            <span>{{ t("nav.settings") }}</span>
          </RouterLink>
        </nav>

        <div class="sidebar-meta">
          <div>
            <span class="meta-label">{{ t("app.mode") }}</span>
            <strong>{{ modeLabel }}</strong>
          </div>
          <button class="cyber-btn" @click="toggleOverlay(true)">
            <span class="material-symbols-outlined">stacked_line_chart</span>
            {{ t("nav.overlay") }}
          </button>
          <select v-model="locale" @change="onLocaleChange">
            <option value="zh-CN">{{ t("language.zh") }}</option>
            <option value="en-US">{{ t("language.en") }}</option>
          </select>
        </div>
      </aside>

      <main class="main-shell">
        <header v-if="!store.bigScreen" class="topbar glass-panel">
          <div>
            <p class="meta-label">{{ t("app.systemStatus") }}</p>
            <h2>{{ pageTitle }}</h2>
          </div>
          <div class="topbar-right">
            <button
              v-if="isDashboard"
              class="cyber-btn cyber-btn--ghost"
              type="button"
              @click="setBigScreen(true)"
            >
              <span class="material-symbols-outlined">fullscreen</span>
              {{ t("app.bigScreen") }}
            </button>
            <span class="uptime-dot"></span>
            <span>{{ new Date(snapshot.timestamp).toLocaleTimeString() }}</span>
          </div>
        </header>

        <section class="page-wrap" :class="{ 'page-wrap--bigscreen': store.bigScreen }">
          <router-view />
        </section>
      </main>

      <div v-if="store.bigScreen" class="bigscreen-exit">
        <button class="cyber-btn" type="button" @click="setBigScreen(false)">
          <span class="material-symbols-outlined">fullscreen_exit</span>
          {{ t("app.exitBigScreen") }}
        </button>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed, onMounted, onUnmounted, watch } from "vue";
import { RouterLink, useRoute } from "vue-router";
import { useI18n } from "vue-i18n";

import { useAppStore } from "./stores/app";

const store = useAppStore();
const route = useRoute();
const { t, locale } = useI18n();

const snapshot = computed(() => store.snapshot);
const modeLabel = computed(() => (store.mode === "low_power" ? t("app.modeLowPower") : t("app.modeNormal")));
const isOverlay = computed(() => route.path === "/overlay");
const isDashboard = computed(() => route.path === "/dashboard");
const pageTitle = computed(() => {
  if (route.path === "/network") return t("nav.network");
  if (route.path === "/hardware") return t("nav.hardware");
  if (route.path === "/settings") return t("nav.settings");
  return t("nav.dashboard");
});

const themeVars = computed(() => ({
  "--accent": store.settings.accent,
  "--glass-alpha": String(store.settings.glass_opacity),
  "--glow-scale": String(store.settings.glow_intensity)
}));

function onVisibility() {
  void store.setLowPowerMode(document.hidden);
}

function onBlur() {
  void store.setLowPowerMode(true);
}

function onFocus() {
  void store.setLowPowerMode(false);
}

function onLocaleChange() {
  void store.updateSettings({ language: locale.value as "zh-CN" | "en-US" });
}

function toggleOverlay(visible: boolean) {
  void store.toggleOverlay(visible);
}

async function setBigScreen(enabled: boolean) {
  store.bigScreen = enabled;

  if (!document.fullscreenEnabled) {
    return;
  }

  try {
    if (enabled && !document.fullscreenElement) {
      await document.documentElement.requestFullscreen();
    }
    if (!enabled && document.fullscreenElement) {
      await document.exitFullscreen();
    }
  } catch {
    // Ignore fullscreen permission or platform errors and keep CSS-based large-screen mode.
  }
}

function onFullscreenChanged() {
  if (!document.fullscreenElement && store.bigScreen) {
    store.bigScreen = false;
  }
}

function onKeyDown(event: KeyboardEvent) {
  if (event.key === "Escape" && store.bigScreen) {
    void setBigScreen(false);
  }
}

onMounted(async () => {
  await store.bootstrap();
  locale.value = store.settings.language;
  document.addEventListener("visibilitychange", onVisibility);
  window.addEventListener("blur", onBlur);
  window.addEventListener("focus", onFocus);
  window.addEventListener("keydown", onKeyDown);
  document.addEventListener("fullscreenchange", onFullscreenChanged);
});

onUnmounted(() => {
  document.removeEventListener("visibilitychange", onVisibility);
  window.removeEventListener("blur", onBlur);
  window.removeEventListener("focus", onFocus);
  window.removeEventListener("keydown", onKeyDown);
  document.removeEventListener("fullscreenchange", onFullscreenChanged);
  store.dispose();
});

watch(
  () => store.settings.language,
  (lang) => {
    locale.value = lang;
  }
);

watch(
  () => route.path,
  (path) => {
    if (path !== "/dashboard" && store.bigScreen) {
      void setBigScreen(false);
    }
  }
);
</script>
