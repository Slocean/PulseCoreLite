<template>
  <section class="page-grid hardware-page">
    <article class="glass-panel page-header">
      <h2>{{ t("hardware.title") }}</h2>
      <p>{{ t("hardware.subtitle") }}</p>
    </article>

    <article class="glass-panel hardware-tile">
      <header>
        <span class="material-symbols-outlined">computer</span>
        <small>{{ t("hardware.processor") }}</small>
      </header>
      <h3>{{ info.cpu_model }}</h3>
      <p>{{ snapshot.cpu.frequency_mhz ?? t("common.na") }} MHz · {{ cpuTemp }}</p>
    </article>

    <article class="glass-panel hardware-tile">
      <header>
        <span class="material-symbols-outlined">videogame_asset</span>
        <small>{{ t("hardware.graphics") }}</small>
      </header>
      <h3>{{ info.gpu_model }}</h3>
      <p>{{ snapshot.gpu.usage_pct == null ? t("common.na") : `${snapshot.gpu.usage_pct.toFixed(1)}% ${t("hardware.load")}` }}</p>
    </article>

    <article class="glass-panel hardware-tile">
      <header>
        <span class="material-symbols-outlined">memory_alt</span>
        <small>{{ t("hardware.memory") }}</small>
      </header>
      <h3>{{ info.ram_spec }}</h3>
      <p>{{ snapshot.memory.used_mb.toFixed(0) }} / {{ snapshot.memory.total_mb.toFixed(0) }} MB</p>
    </article>

    <article class="glass-panel hardware-tile">
      <header>
        <span class="material-symbols-outlined">developer_board</span>
        <small>{{ t("hardware.mainboard") }}</small>
      </header>
      <h3>{{ info.motherboard }}</h3>
      <p>{{ info.device_brand }}</p>
    </article>

    <article class="glass-panel full-width hardware-list">
      <h3>{{ t("hardware.storage") }}</h3>
      <ul>
        <li v-for="disk in info.disk_models" :key="disk">
          <span class="material-symbols-outlined">database</span>
          <div>
            <strong>{{ disk }}</strong>
            <p>{{ snapshot.disk.usage_pct.toFixed(1) }}% · {{ snapshot.disk.used_gb.toFixed(1) }} / {{ snapshot.disk.total_gb.toFixed(1) }} GB</p>
          </div>
        </li>
      </ul>
    </article>
  </section>
</template>

<script setup lang="ts">
import { computed } from "vue";
import { useI18n } from "vue-i18n";

import { useAppStore } from "../stores/app";

const { t } = useI18n();
const store = useAppStore();
const info = computed(() => store.hardwareInfo);
const snapshot = computed(() => store.snapshot);

const cpuTemp = computed(() => {
  const value = snapshot.value.cpu.temperature_c;
  return value == null ? t("common.na") : `${value.toFixed(1)} °C`;
});
</script>
