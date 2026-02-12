<template>
  <div class="app-root" :style="themeVars" :class="{ 'app-root--bigscreen': store.bigScreen }">
    <div v-if="isOverlay" class="overlay-shell">
      <router-view />
    </div>

    <div v-else class="app-shell">
      <div class="ambient-grid"></div>
      <div class="ambient-glow ambient-glow--left"></div>
      <div class="ambient-glow ambient-glow--right"></div>

      <aside v-if="!store.bigScreen" class="cyber-sidebar">
        <div class="sidebar-brand">
          <div class="brand-icon">
            <span class="material-symbols-outlined">bolt</span>
          </div>
          <span class="brand-text">{{ t("app.name") }}</span>
        </div>

        <nav class="nav-links">
          <RouterLink to="/dashboard" class="nav-link">
            <span class="material-symbols-outlined">dashboard</span>
            <span class="nav-text">{{ t("nav.dashboard") }}</span>
          </RouterLink>
          <RouterLink to="/network" class="nav-link">
            <span class="material-symbols-outlined">router</span>
            <span class="nav-text">{{ t("nav.network") }}</span>
          </RouterLink>
          <RouterLink to="/hardware" class="nav-link">
            <span class="material-symbols-outlined">memory</span>
            <span class="nav-text">{{ t("nav.hardware") }}</span>
          </RouterLink>
          <RouterLink to="/settings" class="nav-link">
            <span class="material-symbols-outlined">settings</span>
            <span class="nav-text">{{ t("nav.settings") }}</span>
          </RouterLink>
        </nav>

        <div class="sidebar-meta">
          <div class="sidebar-mode">
            <span class="meta-label">{{ t("app.mode") }}</span>
            <strong>{{ modeLabel }}</strong>
          </div>
          <button class="cyber-btn" type="button" @click="toggleOverlay(true)">
            <span class="material-symbols-outlined">stacked_line_chart</span>
            <span class="nav-text">{{ t("nav.overlay") }}</span>
          </button>
          <select v-model="locale" @change="onLocaleChange">
            <option value="zh-CN">{{ t("language.zh") }}</option>
            <option value="en-US">{{ t("language.en") }}</option>
          </select>
        </div>

        <div class="sidebar-profile">
          <div class="profile-avatar">AR</div>
          <div class="profile-meta">
            <p>{{ t("app.userName") }}</p>
            <span>{{ t("app.userRole") }}</span>
          </div>
        </div>
      </aside>

      <main class="main-shell">
        <header v-if="!store.bigScreen" class="topbar glass-panel">
          <div class="topbar-title">
            <h1>{{ isDashboard ? t("dashboard.title") : pageTitle }}</h1>
            <p class="topbar-subtitle">{{ isDashboard ? t("dashboard.subtitle") : t("app.systemStatus") }}</p>
          </div>
          <div class="topbar-right">
            <div class="time-pill">
              <span class="material-symbols-outlined">schedule</span>
              <span class="mono">{{ utcTime }} UTC</span>
            </div>
            <button v-if="isDashboard" class="topbar-action" type="button" @click="setBigScreen(true)">
              <span class="material-symbols-outlined">fullscreen</span>
              <span class="nav-text">{{ t("app.bigScreen") }}</span>
            </button>
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

const utcTime = computed(() => {
  const formatter = new Intl.DateTimeFormat("en-GB", {
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hour12: false,
    timeZone: "UTC"
  });
  return formatter.format(new Date(snapshot.value.timestamp));
});

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
