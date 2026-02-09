<template>
  <section class="page-grid">
    <article class="glass-panel page-header">
      <h2>{{ t("dashboard.title") }}</h2>
      <p>500ms sampling · low-power fallback · best-effort temperature</p>
    </article>

    <MetricCard
      :title="t('dashboard.cpu')"
      :value="`${snapshot.cpu.usage_pct.toFixed(1)}%`"
      :subtitle="`${snapshot.cpu.frequency_mhz ?? 'N/A'} MHz · ${temp(snapshot.cpu.temperature_c)}`"
      :percent="snapshot.cpu.usage_pct"
    />
    <MetricCard
      :title="t('dashboard.gpu')"
      :value="snapshot.gpu.usage_pct == null ? 'N/A' : `${snapshot.gpu.usage_pct.toFixed(1)}%`"
      :subtitle="`VRAM ${snapshot.gpu.memory_used_mb ?? 'N/A'} / ${snapshot.gpu.memory_total_mb ?? 'N/A'} MB · ${temp(snapshot.gpu.temperature_c)}`"
      :percent="snapshot.gpu.usage_pct ?? 0"
    />
    <MetricCard
      :title="t('dashboard.memory')"
      :value="`${snapshot.memory.usage_pct.toFixed(1)}%`"
      :subtitle="`${snapshot.memory.used_mb.toFixed(0)} / ${snapshot.memory.total_mb.toFixed(0)} MB`"
      :percent="snapshot.memory.usage_pct"
    />
    <MetricCard
      :title="t('dashboard.disk')"
      :value="`${snapshot.disk.usage_pct.toFixed(1)}%`"
      :subtitle="`${snapshot.disk.used_gb.toFixed(1)} / ${snapshot.disk.total_gb.toFixed(1)} GB`"
      :percent="snapshot.disk.usage_pct"
    />

    <article class="glass-panel chart-card">
      <header><h3>CPU %</h3></header>
      <LineChart :values="store.cpuHistory" color="#00f3ff" />
    </article>

    <article class="glass-panel chart-card">
      <header><h3>Memory %</h3></header>
      <LineChart :values="store.memoryHistory" color="#bc13fe" />
    </article>

    <article class="glass-panel chart-card">
      <header><h3>Download MB/s</h3></header>
      <LineChart :values="store.networkDownHistory" color="#2b6cee" />
    </article>
  </section>
</template>

<script setup lang="ts">
import { computed } from "vue";
import { useI18n } from "vue-i18n";

import MetricCard from "../components/MetricCard.vue";
import LineChart from "../components/LineChart.vue";
import { useAppStore } from "../stores/app";

const store = useAppStore();
const { t } = useI18n();

const snapshot = computed(() => store.snapshot);

function temp(value: number | null): string {
  return value == null ? "N/A" : `${value.toFixed(1)}°C`;
}
</script>
