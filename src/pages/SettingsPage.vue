<template>
  <section class="page-grid">
    <article class="glass-panel page-header">
      <h2>{{ t("settings.title") }}</h2>
      <p>Theme accents, sampling rates, language, speed endpoints</p>
    </article>

    <article class="glass-panel control-card">
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
        {{ t("settings.glassOpacity") }}
        <input v-model.number="draft.glass_opacity" type="range" min="0.2" max="1" step="0.05" />
      </label>
      <label>
        {{ t("settings.glowIntensity") }}
        <input v-model.number="draft.glow_intensity" type="range" min="0" max="1" step="0.05" />
      </label>
      <label>
        Sensor Boost (reserved)
        <input v-model="draft.sensor_boost_enabled" type="checkbox" />
      </label>
      <button @click="save">{{ t("settings.save") }}</button>
    </article>

    <article class="glass-panel full-width">
      <h3>Speedtest Endpoints</h3>
      <ul>
        <li v-for="(item, idx) in draft.speedtest_endpoints" :key="item + idx">{{ item }}</li>
      </ul>
    </article>
  </section>
</template>

<script setup lang="ts">
import { reactive, watch } from "vue";
import { useI18n } from "vue-i18n";

import { useAppStore } from "../stores/app";

const store = useAppStore();
const { t } = useI18n();

const draft = reactive({ ...store.settings });

watch(
  () => store.settings,
  (next) => Object.assign(draft, next),
  { deep: true }
);

async function save() {
  await store.updateSettings({ ...draft });
}
</script>
