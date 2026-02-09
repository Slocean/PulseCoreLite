<template>
  <section class="page-grid hardware-page">
    <article class="glass-panel page-header">
      <h2>Hardware Matrix</h2>
      <p>Device profile and live hardware signal overview</p>
    </article>

    <article class="glass-panel hardware-tile">
      <header>
        <span class="material-symbols-outlined">computer</span>
        <small>PROCESSOR</small>
      </header>
      <h3>{{ info.cpu_model }}</h3>
      <p>{{ snapshot.cpu.frequency_mhz ?? 'N/A' }} MHz · {{ cpuTemp }}</p>
    </article>

    <article class="glass-panel hardware-tile">
      <header>
        <span class="material-symbols-outlined">videogame_asset</span>
        <small>GRAPHICS</small>
      </header>
      <h3>{{ info.gpu_model }}</h3>
      <p>{{ snapshot.gpu.usage_pct == null ? 'N/A' : `${snapshot.gpu.usage_pct.toFixed(1)}% load` }}</p>
    </article>

    <article class="glass-panel hardware-tile">
      <header>
        <span class="material-symbols-outlined">memory_alt</span>
        <small>MEMORY</small>
      </header>
      <h3>{{ info.ram_spec }}</h3>
      <p>{{ snapshot.memory.used_mb.toFixed(0) }} / {{ snapshot.memory.total_mb.toFixed(0) }} MB</p>
    </article>

    <article class="glass-panel hardware-tile">
      <header>
        <span class="material-symbols-outlined">developer_board</span>
        <small>MAINBOARD</small>
      </header>
      <h3>{{ info.motherboard }}</h3>
      <p>{{ info.device_brand }}</p>
    </article>

    <article class="glass-panel full-width hardware-list">
      <h3>Storage Devices</h3>
      <ul>
        <li v-for="disk in info.disk_models" :key="disk">
          <span class="material-symbols-outlined">database</span>
          <div>
            <strong>{{ disk }}</strong>
            <p>{{ snapshot.disk.usage_pct.toFixed(1) }}% used · {{ snapshot.disk.used_gb.toFixed(1) }} / {{ snapshot.disk.total_gb.toFixed(1) }} GB</p>
          </div>
        </li>
      </ul>
    </article>
  </section>
</template>

<script setup lang="ts">
import { computed } from "vue";

import { useAppStore } from "../stores/app";

const store = useAppStore();
const info = computed(() => store.hardwareInfo);
const snapshot = computed(() => store.snapshot);

const cpuTemp = computed(() => {
  const value = snapshot.value.cpu.temperature_c;
  return value == null ? "N/A" : `${value.toFixed(1)} °C`;
});
</script>
