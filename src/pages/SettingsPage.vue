<template>
  <section class="page-grid settings-page">
    <article class="glass-panel page-header">
      <h2>{{ t("settings.title") }}</h2>
      <p>{{ t("settings.subtitle") }}</p>
    </article>

    <article class="glass-panel full-width settings-preview">
      <div class="preview-canvas" :style="previewStyle">
        <div class="preview-top">
          <span></span>
          <span></span>
        </div>
        <div class="preview-grid">
          <div></div>
          <div></div>
          <div></div>
          <div></div>
        </div>
      </div>
      <div class="preview-meta">
        <h3>{{ t("settings.previewTitle") }}</h3>
        <p>
          {{ t("settings.previewGlass") }} {{ Math.round(draft.glass_opacity * 100) }}% ·
          {{ t("settings.previewGlow") }} {{ Math.round(draft.glow_intensity * 100) }}%
        </p>
        <p>{{ t("settings.previewAccent") }} {{ draft.accent }}</p>
      </div>
    </article>

    <article class="glass-panel control-card">
      <h3>{{ t("settings.samplingLanguage") }}</h3>
      <label>
        {{ t("settings.refresh") }} (ms)
        <input v-model.number="draft.refresh_rate_ms" type="number" min="250" max="5000" step="50" />
      </label>
      <label>
        {{ t("settings.lowPower") }} (ms)
        <input v-model.number="draft.low_power_rate_ms" type="number" min="500" max="10000" step="100" />
      </label>
      <label>
        {{ t("settings.language") }}
        <select v-model="draft.language">
          <option value="zh-CN">{{ t("language.zh") }}</option>
          <option value="en-US">{{ t("language.en") }}</option>
        </select>
      </label>
      <label>
        {{ t("settings.historyRetention") }}
        <input v-model.number="draft.history_retention_days" type="number" min="1" max="365" step="1" />
      </label>
    </article>

    <article class="glass-panel control-card">
      <h3>{{ t("settings.themeEffects") }}</h3>
      <label>
        {{ t("settings.glassOpacity") }}
        <input v-model.number="draft.glass_opacity" type="range" min="0.2" max="1" step="0.05" />
      </label>
      <label>
        {{ t("settings.glowIntensity") }}
        <input v-model.number="draft.glow_intensity" type="range" min="0" max="1" step="0.05" />
      </label>
      <label>
        {{ t("settings.accentColor") }}
        <input v-model="draft.accent" type="color" />
      </label>
      <label class="inline-check">
        <input v-model="draft.sensor_boost_enabled" type="checkbox" />
        {{ t("settings.sensorBoost") }}
      </label>
    </article>

    <article class="glass-panel control-card">
      <h3>{{ t("settings.overlayAdvanced") }}</h3>
      <label class="inline-check">
        <input v-model="draft.overlay_display.show_values" type="checkbox" />
        {{ t("settings.overlayShowValues") }}
      </label>
      <label class="inline-check">
        <input v-model="draft.overlay_display.show_percent" type="checkbox" />
        {{ t("settings.overlayShowPercent") }}
      </label>
      <label class="inline-check">
        <input v-model="draft.overlay_display.show_hardware_info" type="checkbox" />
        {{ t("settings.overlayShowHardware") }}
      </label>
    </article>

    <article class="glass-panel full-width modules-card">
      <h3>{{ t("settings.modules") }}</h3>
      <div class="modules-grid">
        <label><input v-model="draft.module_toggles.show_cpu" type="checkbox" /> {{ t("settings.moduleCpu") }}</label>
        <label><input v-model="draft.module_toggles.show_gpu" type="checkbox" /> {{ t("settings.moduleGpu") }}</label>
        <label><input v-model="draft.module_toggles.show_memory" type="checkbox" /> {{ t("settings.moduleMemory") }}</label>
        <label><input v-model="draft.module_toggles.show_disk" type="checkbox" /> {{ t("settings.moduleDisk") }}</label>
        <label><input v-model="draft.module_toggles.show_network" type="checkbox" /> {{ t("settings.moduleNetwork") }}</label>
      </div>
    </article>

    <article class="glass-panel full-width">
      <h3>{{ t("settings.endpoints") }}</h3>
      <p>{{ t("settings.endpointsHint") }}</p>
      <textarea v-model="endpointsText" rows="5"></textarea>
      <div class="row-actions" style="margin-top: 10px">
        <button class="cyber-btn" @click="save">{{ t("settings.save") }}</button>
      </div>
    </article>
  </section>
</template>

<script setup lang="ts">
import { computed, reactive, ref, watch } from "vue";
import { useI18n } from "vue-i18n";

import { useAppStore } from "../stores/app";

const store = useAppStore();
const { t } = useI18n();

const draft = reactive({
  ...store.settings,
  module_toggles: { ...store.settings.module_toggles },
  overlay_display: { ...store.settings.overlay_display }
});
const endpointsText = ref(store.settings.speedtest_endpoints.join("\n"));

const previewStyle = computed(() => ({
  "--preview-accent": draft.accent,
  "--preview-glass": String(draft.glass_opacity),
  "--preview-glow": String(draft.glow_intensity)
}));

watch(
  () => store.settings,
  (next) => {
    Object.assign(draft, next, {
      module_toggles: { ...next.module_toggles },
      overlay_display: { ...next.overlay_display }
    });
    endpointsText.value = next.speedtest_endpoints.join("\n");
  },
  { deep: true }
);

async function save() {
  const speedtest_endpoints = endpointsText.value
    .split("\n")
    .map((item) => item.trim())
    .filter((item) => item.length > 0);

  await store.updateSettings({ ...draft, speedtest_endpoints });
}
</script>
