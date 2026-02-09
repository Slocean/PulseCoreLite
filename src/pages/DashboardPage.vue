<template>
  <section class="dashboard-grid">
    <div class="dashboard-col dashboard-col--left">
      <article v-if="settings.module_toggles.show_cpu" class="glass-panel gauge-card gauge-card--cpu">
        <div class="gauge-header">
          <div>
            <h3>CPU LOAD</h3>
            <p>{{ hardware.cpu_model }}</p>
          </div>
          <span class="material-symbols-outlined">memory</span>
        </div>
        <div class="gauge-body">
          <div class="gauge-ring" :style="gaugeStyle(snapshot.cpu.usage_pct, '#00f3ff')">
            <div>
              <strong>{{ snapshot.cpu.usage_pct.toFixed(0) }}%</strong>
              <span>{{ snapshot.cpu.frequency_mhz ?? 'N/A' }} MHz</span>
            </div>
          </div>
          <div class="gauge-meta">
            <div>
              <span>TEMP</span>
              <strong>{{ formatTemp(snapshot.cpu.temperature_c) }}</strong>
            </div>
            <div>
              <span>MODE</span>
              <strong>{{ modeLabel }}</strong>
            </div>
          </div>
        </div>
      </article>

      <article v-if="settings.module_toggles.show_gpu" class="glass-panel gauge-card gauge-card--gpu">
        <div class="gauge-header">
          <div>
            <h3>GPU LOAD</h3>
            <p>{{ hardware.gpu_model }}</p>
          </div>
          <span class="material-symbols-outlined">videogame_asset</span>
        </div>
        <div class="gauge-body">
          <div class="gauge-ring" :style="gaugeStyle(snapshot.gpu.usage_pct ?? 0, '#bc13fe')">
            <div>
              <strong>{{ snapshot.gpu.usage_pct == null ? 'N/A' : `${snapshot.gpu.usage_pct.toFixed(0)}%` }}</strong>
              <span>{{ formatTemp(snapshot.gpu.temperature_c) }}</span>
            </div>
          </div>
          <div class="gauge-meta">
            <div>
              <span>VRAM</span>
              <strong>{{ snapshot.gpu.memory_used_mb ?? 'N/A' }} / {{ snapshot.gpu.memory_total_mb ?? 'N/A' }} MB</strong>
            </div>
            <div>
              <span>SENSOR</span>
              <strong>{{ settings.sensor_boost_enabled ? 'BOOST' : 'BEST-EFFORT' }}</strong>
            </div>
          </div>
        </div>
      </article>
    </div>

    <div class="dashboard-col dashboard-col--center">
      <article v-if="settings.module_toggles.show_memory" class="glass-panel panel-card">
        <header>
          <h3>RAM USAGE</h3>
          <strong>{{ snapshot.memory.usage_pct.toFixed(1) }}%</strong>
        </header>
        <LineChart :values="store.memoryHistory" color="#56a0ff" />
        <p class="panel-foot">{{ snapshot.memory.used_mb.toFixed(0) }} / {{ snapshot.memory.total_mb.toFixed(0) }} MB</p>
      </article>

      <article v-if="settings.module_toggles.show_disk" class="glass-panel panel-card">
        <header>
          <h3>DISK I/O</h3>
          <strong>{{ snapshot.disk.usage_pct.toFixed(1) }}%</strong>
        </header>
        <div class="disk-stats">
          <div>
            <span>USED</span>
            <strong>{{ snapshot.disk.used_gb.toFixed(1) }} GB</strong>
          </div>
          <div>
            <span>TOTAL</span>
            <strong>{{ snapshot.disk.total_gb.toFixed(1) }} GB</strong>
          </div>
          <div>
            <span>READ</span>
            <strong>{{ formatBytes(snapshot.disk.read_bytes_per_sec) }}</strong>
          </div>
          <div>
            <span>WRITE</span>
            <strong>{{ formatBytes(snapshot.disk.write_bytes_per_sec) }}</strong>
          </div>
        </div>
      </article>

      <article v-if="settings.module_toggles.show_network" class="glass-panel panel-card">
        <header>
          <h3>NETWORK FLOW</h3>
          <strong>{{ downMbps.toFixed(1) }} Mbps</strong>
        </header>
        <LineChart :values="store.networkDownHistory" color="#00f3ff" />
      </article>
    </div>

    <div class="dashboard-col dashboard-col--right">
      <article v-if="settings.module_toggles.show_network" class="glass-panel network-card">
        <header>
          <h3>NETWORK</h3>
          <span class="dot"></span>
        </header>
        <div class="network-speed">
          <div>
            <span>DOWN</span>
            <strong>{{ downMbps.toFixed(2) }} Mbps</strong>
          </div>
          <div>
            <span>UP</span>
            <strong>{{ upMbps.toFixed(2) }} Mbps</strong>
          </div>
          <div>
            <span>PING</span>
            <strong>{{ snapshot.network.latency_ms == null ? 'N/A' : `${snapshot.network.latency_ms.toFixed(1)} ms` }}</strong>
          </div>
        </div>
      </article>

      <article class="glass-panel hardware-card">
        <h3>DEVICE INFO</h3>
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
            <span>BOARD</span>
            <strong>{{ hardware.motherboard }}</strong>
          </li>
        </ul>
      </article>

      <article class="glass-panel warning-card">
        <h3>SYSTEM WARNINGS</h3>
        <ul v-if="store.warnings.length > 0">
          <li v-for="item in store.warnings.slice(0, 3)" :key="item.message + item.source">
            <span>{{ item.source }}</span>
            <p>{{ item.message }}</p>
          </li>
        </ul>
        <p v-else>No active warning.</p>
      </article>
    </div>
  </section>
</template>

<script setup lang="ts">
import { computed } from "vue";

import LineChart from "../components/LineChart.vue";
import { useAppStore } from "../stores/app";

const store = useAppStore();

const snapshot = computed(() => store.snapshot);
const hardware = computed(() => store.hardwareInfo);
const settings = computed(() => store.settings);
const modeLabel = computed(() => (store.mode === "low_power" ? "LOW" : "NORMAL"));
const downMbps = computed(() => snapshot.value.network.download_bytes_per_sec * 8 / 1_000_000);
const upMbps = computed(() => snapshot.value.network.upload_bytes_per_sec * 8 / 1_000_000);

function gaugeStyle(percent: number, color: string): Record<string, string> {
  const clamped = Math.max(0, Math.min(100, percent));
  return {
    background: `conic-gradient(${color} ${clamped * 3.6}deg, rgba(255,255,255,0.09) 0deg)`
  };
}

function formatTemp(temp: number | null): string {
  return temp == null ? "N/A" : `${temp.toFixed(1)} °C`;
}

function formatBytes(bytes: number | null): string {
  if (bytes == null) return "N/A";
  const mb = bytes / (1024 * 1024);
  return `${mb.toFixed(2)} MB/s`;
}
</script>
