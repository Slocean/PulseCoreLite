<template>
  <section class="page-grid settings-page">
    <article class="glass-panel page-header">
      <h2>{{ t("settings.title") }}</h2>
      <p>Live preview + modular controls for your cyber dashboard</p>
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
        <h3>Live Visual Preview</h3>
        <p>Glass {{ Math.round(draft.glass_opacity * 100) }}% · Glow {{ Math.round(draft.glow_intensity * 100) }}%</p>
        <p>Accent {{ draft.accent }}</p>
      </div>
    </article>

    <article class="glass-panel control-card">
      <h3>Sampling & Language</h3>
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
          <option value="zh-CN">中文</option>
          <option value="en-US">English</option>
        </select>
      </label>
      <label>
        History retention (days)
        <input v-model.number="draft.history_retention_days" type="number" min="1" max="365" step="1" />
      </label>
    </article>

    <article class="glass-panel control-card">
      <h3>Theme & Effects</h3>
      <label>
        {{ t("settings.glassOpacity") }}
        <input v-model.number="draft.glass_opacity" type="range" min="0.2" max="1" step="0.05" />
      </label>
      <label>
        {{ t("settings.glowIntensity") }}
        <input v-model.number="draft.glow_intensity" type="range" min="0" max="1" step="0.05" />
      </label>
      <label>
        Accent color
        <input v-model="draft.accent" type="color" />
      </label>
      <label class="inline-check">
        <input v-model="draft.sensor_boost_enabled" type="checkbox" />
        Sensor Boost (reserved)
      </label>
    </article>

    <article class="glass-panel full-width modules-card">
      <h3>Modular Blocks</h3>
      <div class="modules-grid">
        <label><input v-model="draft.module_toggles.show_cpu" type="checkbox" /> CPU Panel</label>
        <label><input v-model="draft.module_toggles.show_gpu" type="checkbox" /> GPU Panel</label>
        <label><input v-model="draft.module_toggles.show_memory" type="checkbox" /> Memory Panel</label>
        <label><input v-model="draft.module_toggles.show_disk" type="checkbox" /> Disk Panel</label>
        <label><input v-model="draft.module_toggles.show_network" type="checkbox" /> Network Panel</label>
      </div>
    </article>

    <article class="glass-panel full-width">
      <h3>Speedtest Endpoints</h3>
      <p>One URL per line</p>
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

const draft = reactive({ ...store.settings, module_toggles: { ...store.settings.module_toggles } });
const endpointsText = ref(store.settings.speedtest_endpoints.join("\n"));

const previewStyle = computed(() => ({
  "--preview-accent": draft.accent,
  "--preview-glass": String(draft.glass_opacity),
  "--preview-glow": String(draft.glow_intensity)
}));

watch(
  () => store.settings,
  (next) => {
    Object.assign(draft, next, { module_toggles: { ...next.module_toggles } });
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
