<template>
  <section class="dashboard-wall">
    <article
      v-if="settings.module_toggles.show_cpu"
      class="glass-panel gauge-card gauge-card--cpu wall-card wall-span-4 wall-span-lg-6 wall-span-md-12"
    >
      <div class="gauge-header">
        <div>
          <h3>{{ t("dashboard.cpuLoad") }}</h3>
          <p>{{ hardware.cpu_model }}</p>
        </div>
        <span class="material-symbols-outlined">memory</span>
      </div>
      <div class="gauge-body">
        <div class="gauge-ring" :style="gaugeStyle(snapshot.cpu.usage_pct, '#00f3ff')">
          <div>
            <strong>{{ snapshot.cpu.usage_pct.toFixed(0) }}%</strong>
            <span>{{ snapshot.cpu.frequency_mhz ?? t("common.na") }} MHz</span>
          </div>
        </div>
        <div class="gauge-meta">
          <div>
            <span>{{ t("dashboard.temp") }}</span>
            <strong>{{ formatTemp(snapshot.cpu.temperature_c) }}</strong>
          </div>
          <div>
            <span>{{ t("dashboard.mode") }}</span>
            <strong>{{ modeLabel }}</strong>
          </div>
        </div>
      </div>
    </article>

    <article
      v-if="settings.module_toggles.show_gpu"
      class="glass-panel gauge-card gauge-card--gpu wall-card wall-span-4 wall-span-lg-6 wall-span-md-12"
    >
      <div class="gauge-header">
        <div>
          <h3>{{ t("dashboard.gpuLoad") }}</h3>
          <p>{{ hardware.gpu_model }}</p>
        </div>
        <span class="material-symbols-outlined">videogame_asset</span>
      </div>
      <div class="gauge-body">
        <div class="gauge-ring" :style="gaugeStyle(snapshot.gpu.usage_pct ?? 0, '#bc13fe')">
          <div>
            <strong>{{ snapshot.gpu.usage_pct == null ? t("common.na") : `${snapshot.gpu.usage_pct.toFixed(0)}%` }}</strong>
            <span>{{ formatTemp(snapshot.gpu.temperature_c) }}</span>
          </div>
        </div>
        <div class="gauge-meta">
          <div>
            <span>{{ t("dashboard.vram") }}</span>
            <strong>
              {{ snapshot.gpu.memory_used_mb == null ? t("common.na") : `${snapshot.gpu.memory_used_mb.toFixed(0)} MB` }} /
              {{ snapshot.gpu.memory_total_mb == null ? t("common.na") : `${snapshot.gpu.memory_total_mb.toFixed(0)} MB` }}
            </strong>
          </div>
          <div>
            <span>{{ t("dashboard.sensor") }}</span>
            <strong>{{ settings.sensor_boost_enabled ? t("dashboard.boost") : t("dashboard.bestEffort") }}</strong>
          </div>
        </div>
      </div>
    </article>

    <article
      v-if="settings.module_toggles.show_network"
      class="glass-panel network-card wall-card wall-span-4 wall-span-lg-12 wall-span-md-12"
    >
      <header>
        <h3>{{ t("dashboard.network") }}</h3>
        <span class="dot"></span>
      </header>
      <div class="network-speed">
        <div>
          <span>{{ t("dashboard.down") }}</span>
          <strong>{{ downMbps.toFixed(2) }} Mbps</strong>
        </div>
        <div>
          <span>{{ t("dashboard.up") }}</span>
          <strong>{{ upMbps.toFixed(2) }} Mbps</strong>
        </div>
        <div>
          <span>{{ t("dashboard.ping") }}</span>
          <strong>{{ snapshot.network.latency_ms == null ? t("common.na") : `${snapshot.network.latency_ms.toFixed(1)} ms` }}</strong>
        </div>
      </div>
    </article>

    <article
      v-if="settings.module_toggles.show_memory"
      class="glass-panel panel-card wall-card wall-span-6 wall-span-lg-12 wall-span-md-12"
    >
      <header>
        <h3>{{ t("dashboard.ramUsage") }}</h3>
        <strong>{{ snapshot.memory.usage_pct.toFixed(1) }}%</strong>
      </header>
      <LineChart :values="store.memoryHistory" color="#56a0ff" />
      <p class="panel-foot">{{ snapshot.memory.used_mb.toFixed(0) }} / {{ snapshot.memory.total_mb.toFixed(0) }} MB</p>
    </article>

    <article
      v-if="settings.module_toggles.show_disk"
      class="glass-panel panel-card wall-card wall-span-6 wall-span-lg-12 wall-span-md-12"
    >
      <header>
        <h3>{{ t("dashboard.diskIo") }}</h3>
        <strong>{{ snapshot.disk.usage_pct.toFixed(1) }}%</strong>
      </header>
      <div class="disk-stats">
        <div>
          <span>{{ t("dashboard.used") }}</span>
          <strong>{{ snapshot.disk.used_gb.toFixed(1) }} GB</strong>
        </div>
        <div>
          <span>{{ t("dashboard.total") }}</span>
          <strong>{{ snapshot.disk.total_gb.toFixed(1) }} GB</strong>
        </div>
        <div>
          <span>{{ t("dashboard.read") }}</span>
          <strong>{{ formatBytes(snapshot.disk.read_bytes_per_sec) }}</strong>
        </div>
        <div>
          <span>{{ t("dashboard.write") }}</span>
          <strong>{{ formatBytes(snapshot.disk.write_bytes_per_sec) }}</strong>
        </div>
      </div>
    </article>

    <article
      v-if="settings.module_toggles.show_network"
      class="glass-panel panel-card wall-card wall-span-6 wall-span-lg-12 wall-span-md-12"
    >
      <header>
        <h3>{{ t("dashboard.networkFlow") }}</h3>
        <strong>{{ downMbps.toFixed(1) }} Mbps</strong>
      </header>
      <LineChart :values="store.networkDownHistory" color="#00f3ff" />
    </article>

    <article class="glass-panel hardware-card wall-card wall-span-6 wall-span-lg-12 wall-span-md-12">
      <h3>{{ t("dashboard.deviceInfo") }}</h3>
      <ul>
        <li>
          <span>CPU</span>
          <strong>{{ hardware.cpu_model }}</strong>
        </li>
        <li>
          <span>GPU</span>
          <strong>{{ hardware.gpu_model }}</strong>
        </li>
        <li>
          <span>RAM</span>
          <strong>{{ hardware.ram_spec }}</strong>
        </li>
        <li>
          <span>{{ t("dashboard.board") }}</span>
          <strong>{{ hardware.motherboard }}</strong>
        </li>
      </ul>
    </article>

    <article class="glass-panel warning-card wall-card wall-span-12 wall-span-lg-12 wall-span-md-12">
      <h3>{{ t("dashboard.warnings") }}</h3>
      <ul v-if="store.warnings.length > 0">
        <li v-for="item in store.warnings.slice(0, 3)" :key="item.message + item.source">
          <span>{{ item.source }}</span>
          <p>{{ item.message }}</p>
        </li>
      </ul>
      <p v-else>{{ t("dashboard.noWarning") }}</p>
    </article>
  </section>
</template>

<script setup lang="ts">
import { computed } from "vue";
import { useI18n } from "vue-i18n";

import LineChart from "../components/LineChart.vue";
import { useAppStore } from "../stores/app";

const { t } = useI18n();
const store = useAppStore();

const snapshot = computed(() => store.snapshot);
const hardware = computed(() => store.hardwareInfo);
const settings = computed(() => store.settings);
const modeLabel = computed(() => (store.mode === "low_power" ? t("app.modeLowPower") : t("app.modeNormal")));
const downMbps = computed(() => (snapshot.value.network.download_bytes_per_sec * 8) / 1_000_000);
const upMbps = computed(() => (snapshot.value.network.upload_bytes_per_sec * 8) / 1_000_000);

function gaugeStyle(percent: number, color: string): Record<string, string> {
  const clamped = Math.max(0, Math.min(100, percent));
  return {
    background: `conic-gradient(${color} ${clamped * 3.6}deg, rgba(255,255,255,0.09) 0deg)`
  };
}

function formatTemp(temp: number | null): string {
  return temp == null ? t("common.na") : `${temp.toFixed(1)} °C`;
}

function formatBytes(bytes: number | null): string {
  if (bytes == null) return t("common.na");
  const mb = bytes / (1024 * 1024);
  return `${mb.toFixed(2)} MB/s`;
}
</script>
