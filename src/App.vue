<template>
  <div class="app-root" :style="themeVars">
    <div v-if="isOverlay" class="overlay-shell">
      <router-view />
    </div>

    <div v-else class="app-shell">
      <div class="ambient-grid"></div>
      <div class="ambient-glow ambient-glow--left"></div>
      <div class="ambient-glow ambient-glow--right"></div>

      <aside class="cyber-sidebar glass-panel">
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
            <span class="meta-label">MODE</span>
            <strong>{{ modeLabel }}</strong>
          </div>
          <button class="cyber-btn" @click="toggleOverlay(true)">
            <span class="material-symbols-outlined">stacked_line_chart</span>
            {{ t("nav.overlay") }}
          </button>
          <select v-model="locale" @change="onLocaleChange">
            <option value="zh-CN">中文</option>
            <option value="en-US">English</option>
          </select>
        </div>
      </aside>

      <main class="main-shell">
        <header class="topbar glass-panel">
          <div>
            <p class="meta-label">SYSTEM STATUS</p>
            <h2>{{ pageTitle }}</h2>
          </div>
          <div class="topbar-right">
            <span class="uptime-dot"></span>
            <span>{{ new Date(snapshot.timestamp).toLocaleTimeString() }}</span>
          </div>
        </header>

        <section class="page-wrap">
          <router-view />
        </section>
      </main>
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
const modeLabel = computed(() => (store.mode === "low_power" ? "LOW POWER" : "NORMAL"));
const isOverlay = computed(() => route.path === "/overlay");
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
  store.setLowPowerMode(document.hidden);
}

function onBlur() {
  store.setLowPowerMode(true);
}

function onFocus() {
  store.setLowPowerMode(false);
}

function onLocaleChange() {
  store.updateSettings({ language: locale.value as "zh-CN" | "en-US" });
}

function toggleOverlay(visible: boolean) {
  store.toggleOverlay(visible);
}

onMounted(async () => {
  await store.bootstrap();
  locale.value = store.settings.language;
  document.addEventListener("visibilitychange", onVisibility);
  window.addEventListener("blur", onBlur);
  window.addEventListener("focus", onFocus);
});

onUnmounted(() => {
  document.removeEventListener("visibilitychange", onVisibility);
  window.removeEventListener("blur", onBlur);
  window.removeEventListener("focus", onFocus);
  store.dispose();
});

watch(
  () => store.settings.language,
  (lang) => {
    locale.value = lang;
  }
);
</script>
