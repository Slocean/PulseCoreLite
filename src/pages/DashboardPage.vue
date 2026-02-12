<template>
  <section class="dashboard-page">
    <div class="stat-grid">
      <article v-if="settings.module_toggles.show_cpu" class="glass-panel stat-card">
        <div class="stat-header">
          <span class="stat-label">{{ t("dashboard.cpuLoad") }}</span>
          <span class="material-symbols-outlined stat-menu">more_vert</span>
        </div>
        <div class="stat-ring">
          <svg class="ring-svg" height="120" width="120">
            <circle class="ring-track" cx="60" cy="60" r="50" fill="transparent" stroke-width="8"></circle>
            <circle
              class="ring-progress ring-progress--cyan"
              cx="60"
              cy="60"
              r="50"
              fill="transparent"
              stroke-width="8"
              stroke-dasharray="314.159"
              :stroke-dashoffset="cpuRingOffset"
            ></circle>
          </svg>
          <div class="stat-center">
            <span class="stat-value mono">{{ snapshot.cpu.usage_pct.toFixed(0) }}%</span>
            <span class="stat-sub">{{ t("dashboard.utilization") }}</span>
          </div>
        </div>
        <div class="stat-footer">
          <p>{{ hardware.cpu_model }}</p>
          <p class="stat-hint">{{ formatGHz(snapshot.cpu.frequency_mhz) }} • {{ formatTemp(snapshot.cpu.temperature_c) }}</p>
        </div>
      </article>

      <article v-if="settings.module_toggles.show_gpu" class="glass-panel stat-card">
        <div class="stat-header">
          <span class="stat-label">{{ t("dashboard.gpuLoad") }}</span>
          <span class="material-symbols-outlined stat-menu">more_vert</span>
        </div>
        <div class="stat-ring">
          <svg class="ring-svg" height="120" width="120">
            <circle class="ring-track" cx="60" cy="60" r="50" fill="transparent" stroke-width="8"></circle>
            <circle
              class="ring-progress ring-progress--purple"
              cx="60"
              cy="60"
              r="50"
              fill="transparent"
              stroke-width="8"
              stroke-dasharray="314.159"
              :stroke-dashoffset="gpuRingOffset"
            ></circle>
          </svg>
          <div class="stat-center">
            <span class="stat-value mono">{{ gpuUsageLabel }}</span>
            <span class="stat-sub">{{ t("dashboard.rendering") }}</span>
          </div>
        </div>
        <div class="stat-footer">
          <p>{{ hardware.gpu_model }}</p>
          <p class="stat-hint">{{ formatVram }} • {{ formatTemp(snapshot.gpu.temperature_c) }}</p>
        </div>
      </article>

      <article v-if="settings.module_toggles.show_network" class="glass-panel stat-card stat-card--wide">
        <div class="stat-header">
          <span class="stat-label">{{ t("dashboard.networkSpeed") }}</span>
          <span class="material-symbols-outlined stat-accent">speed</span>
        </div>
        <div class="speed-list">
          <div class="speed-row">
            <div class="speed-meta">
              <span class="material-symbols-outlined speed-icon speed-icon--down">download</span>
              <div>
                <p class="speed-label">{{ t("dashboard.down") }}</p>
                <p class="speed-value mono">
                  {{ downMbps.toFixed(1) }}
                  <span>Mbps</span>
                </p>
              </div>
            </div>
          </div>
          <div class="speed-divider"></div>
          <div class="speed-row">
            <div class="speed-meta">
              <span class="material-symbols-outlined speed-icon speed-icon--up">upload</span>
              <div>
                <p class="speed-label">{{ t("dashboard.up") }}</p>
                <p class="speed-value mono">
                  {{ upMbps.toFixed(1) }}
                  <span>Mbps</span>
                </p>
              </div>
            </div>
          </div>
        </div>
        <div class="speed-footer">
          <span>{{ t("dashboard.ping") }}: {{ formatMs(snapshot.network.latency_ms) }}</span>
          <span>{{ t("dashboard.jitter") }}: {{ formatMs(jitterMs) }}</span>
        </div>
      </article>

      <article v-if="settings.module_toggles.show_disk" class="glass-panel stat-card stat-card--wide">
        <div class="stat-header">
          <span class="stat-label">{{ t("dashboard.storageHealth") }}</span>
          <span class="material-symbols-outlined stat-accent stat-accent--ok">verified</span>
        </div>
        <div class="storage-list">
          <div class="storage-item">
            <div class="storage-meta">
              <p>{{ primaryDiskLabel }}</p>
              <p class="mono">{{ formatPercent(snapshot.disk.usage_pct) }}</p>
            </div>
            <div class="storage-bar">
              <span :style="{ width: `${snapshot.disk.usage_pct}%` }"></span>
            </div>
          </div>
          <div class="storage-item">
            <div class="storage-meta">
              <p>{{ secondaryDiskLabel }}</p>
              <p class="mono">{{ secondaryDiskUsageLabel }}</p>
            </div>
            <div class="storage-bar storage-bar--alt">
              <span :style="{ width: `${secondaryDiskUsageValue}%` }"></span>
            </div>
          </div>
        </div>
        <div class="storage-status">
          <span class="status-dot"></span>
          <span>{{ t("dashboard.allDisksHealthy") }}</span>
        </div>
      </article>
    </div>

    <article v-if="settings.module_toggles.show_memory" class="glass-panel memory-panel">
      <div class="memory-header">
        <div>
          <h3>{{ t("dashboard.memoryProfile") }}</h3>
          <p>{{ t("dashboard.memorySubtitle") }}</p>
        </div>
        <div class="memory-tags">
          <span class="mono">{{ t("dashboard.active") }}: {{ formatGb(snapshot.memory.used_mb) }}</span>
          <span class="mono">{{ t("dashboard.total") }}: {{ formatGb(snapshot.memory.total_mb) }}</span>
        </div>
      </div>
      <div class="memory-chart">
        <div class="memory-grid">
          <span v-for="index in 4" :key="index"></span>
        </div>
        <div class="memory-bars">
          <span v-for="(value, index) in memoryBars" :key="index" :style="{ height: `${value}%` }"></span>
        </div>
      </div>
      <div class="memory-axis mono">
        <span>-60 min</span>
        <span>-45 min</span>
        <span>-30 min</span>
        <span>-15 min</span>
        <span>{{ t("dashboard.now") }}</span>
      </div>
    </article>

    <div class="lower-grid">
      <article class="glass-panel process-panel">
        <h3>{{ t("dashboard.processMonitor") }}</h3>
        <div class="table-wrap">
          <table>
            <thead>
              <tr>
                <th>{{ t("dashboard.processName") }}</th>
                <th>PID</th>
                <th>CPU</th>
                <th>{{ t("dashboard.memory") }}</th>
                <th>{{ t("dashboard.user") }}</th>
                <th>{{ t("dashboard.status") }}</th>
              </tr>
            </thead>
            <tbody>
              <tr v-for="item in processList" :key="item.pid">
                <td>{{ item.name }}</td>
                <td class="mono muted">{{ item.pid }}</td>
                <td class="mono text-cyan">{{ item.cpu }}</td>
                <td class="mono">{{ item.memory }}</td>
                <td>{{ item.user }}</td>
                <td>
                  <span :class="['status-pill', item.tone]">{{ item.status }}</span>
                </td>
              </tr>
            </tbody>
          </table>
        </div>
      </article>

      <article class="glass-panel env-panel">
        <h3>{{ t("dashboard.environment") }}</h3>
        <div class="env-list">
          <div v-for="item in environmentStats" :key="item.label" class="env-item">
            <div class="env-meta">
              <span :class="['material-symbols-outlined', item.tone]">{{ item.icon }}</span>
              <span class="env-label">{{ item.label }}</span>
            </div>
            <span class="mono env-value">{{ item.value }}</span>
          </div>
        </div>
        <div class="env-action">
          <button type="button">{{ t("dashboard.exportReport") }}</button>
        </div>
      </article>
    </div>
  </section>
</template>

<script setup lang="ts">
import { computed } from "vue";
import { useI18n } from "vue-i18n";

import { useAppStore } from "../stores/app";

const { t } = useI18n();
const store = useAppStore();

const snapshot = computed(() => store.snapshot);
const hardware = computed(() => store.hardwareInfo);
const settings = computed(() => store.settings);
const downMbps = computed(() => (snapshot.value.network.download_bytes_per_sec * 8) / 1_000_000);
const upMbps = computed(() => (snapshot.value.network.upload_bytes_per_sec * 8) / 1_000_000);
const jitterMs = computed(() => store.lastPingResult?.jitter_ms ?? null);

const ringOffset = (percent: number) => {
  const clamped = Math.max(0, Math.min(100, percent));
  return 314.159 * (1 - clamped / 100);
};

const cpuRingOffset = computed(() => ringOffset(snapshot.value.cpu.usage_pct));
const gpuRingOffset = computed(() => ringOffset(snapshot.value.gpu.usage_pct ?? 0));
const gpuUsageLabel = computed(() =>
  snapshot.value.gpu.usage_pct == null ? t("common.na") : `${snapshot.value.gpu.usage_pct.toFixed(0)}%`
);

const formatVram = computed(() => {
  if (snapshot.value.gpu.memory_used_mb == null || snapshot.value.gpu.memory_total_mb == null) {
    return t("common.na");
  }
  return `${snapshot.value.gpu.memory_used_mb.toFixed(0)} MB / ${snapshot.value.gpu.memory_total_mb.toFixed(0)} MB`;
});

const primaryDiskLabel = computed(() => hardware.value.disk_models?.[0] ?? t("dashboard.storagePrimary"));
const secondaryDiskLabel = computed(() => hardware.value.disk_models?.[1] ?? t("dashboard.storageSecondary"));
const secondaryDiskUsageValue = computed(() => (hardware.value.disk_models?.length > 1 ? snapshot.value.disk.usage_pct : 0));
const secondaryDiskUsageLabel = computed(() =>
  hardware.value.disk_models?.length > 1 ? formatPercent(snapshot.value.disk.usage_pct) : t("common.na")
);

const memoryBars = computed(() => {
  const series = store.memoryHistory.slice(-20);
  const base = series.length > 0 ? series : [0];
  const padded =
    base.length < 20 ? Array.from({ length: 20 - base.length }, () => base[0] ?? 0) : [];
  return [...padded, ...base].map((value) => Math.min(88, Math.max(12, value)));
});

const processList = computed(() => [
  { name: "System Idle Process", pid: "0", cpu: "74.2%", memory: "12 KB", user: "SYSTEM", status: t("dashboard.statusBackground"), tone: "neutral" },
  { name: "PulseCoreEngine.exe", pid: "4291", cpu: "4.1%", memory: "452 MB", user: "Admin", status: t("dashboard.statusCritical"), tone: "critical" },
  { name: "Docker Desktop", pid: "1204", cpu: "2.8%", memory: "2.1 GB", user: "Admin", status: t("dashboard.statusRunning"), tone: "neutral" },
  { name: "Chrome Backend", pid: "8820", cpu: "1.2%", memory: "891 MB", user: "Admin", status: t("dashboard.statusRunning"), tone: "neutral" }
]);

const environmentStats = computed(() => [
  {
    icon: "thermostat",
    label: t("dashboard.ambientTemp"),
    value: formatTemp(snapshot.value.cpu.temperature_c),
    tone: "tone-warm"
  },
  {
    icon: "cloud",
    label: t("dashboard.fanSpeed"),
    value: t("common.na"),
    tone: "tone-cool"
  },
  {
    icon: "bolt",
    label: t("dashboard.totalPower"),
    value: snapshot.value.power_watts == null ? t("common.na") : `${snapshot.value.power_watts.toFixed(0)} W`,
    tone: "tone-purple"
  },
  {
    icon: "verified_user",
    label: t("dashboard.uptime"),
    value: t("common.na"),
    tone: "tone-green"
  }
]);

function formatTemp(temp: number | null): string {
  return temp == null ? t("common.na") : `${temp.toFixed(1)}°C`;
}

function formatPercent(value: number): string {
  return `${value.toFixed(0)}%`;
}

function formatMs(value: number | null): string {
  return value == null ? t("common.na") : `${value.toFixed(1)} ms`;
}

function formatGHz(value: number | null): string {
  return value == null ? t("common.na") : `${(value / 1000).toFixed(1)} GHz`;
}

function formatGb(valueMb: number): string {
  return `${(valueMb / 1024).toFixed(1)} GB`;
}
</script>
