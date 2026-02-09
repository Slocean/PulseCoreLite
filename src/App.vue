<template>
  <div v-if="isOverlay" class="overlay-shell">
    <router-view />
  </div>
  <div v-else class="layout">
    <aside class="sidebar glass-panel">
      <h1>{{ t("app.name") }}</h1>
      <p>{{ t("app.tagline") }}</p>
      <nav>
        <RouterLink to="/dashboard">{{ t("nav.dashboard") }}</RouterLink>
        <RouterLink to="/network">{{ t("nav.network") }}</RouterLink>
        <RouterLink to="/hardware">{{ t("nav.hardware") }}</RouterLink>
        <RouterLink to="/settings">{{ t("nav.settings") }}</RouterLink>
      </nav>
      <div class="sidebar-foot">
        <button @click="toggleOverlay(true)">{{ t("nav.overlay") }}</button>
        <select v-model="locale" @change="onLocaleChange">
          <option value="zh-CN">中文</option>
          <option value="en-US">English</option>
        </select>
      </div>
    </aside>
    <main class="content">
      <header class="topbar glass-panel">
        <span>{{ modeLabel }}</span>
        <span>{{ new Date(snapshot.timestamp).toLocaleTimeString() }}</span>
      </header>
      <router-view />
    </main>
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
