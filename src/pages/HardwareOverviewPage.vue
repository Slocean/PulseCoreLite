<template>
  <section class="page-grid">
    <article class="glass-panel page-header">
      <h2>Hardware Matrix</h2>
      <p>Best-effort hardware identification for Windows-first release</p>
    </article>

    <article class="glass-panel stat-card">
      <h3>CPU</h3>
      <p>{{ info.cpu_model }}</p>
    </article>
    <article class="glass-panel stat-card">
      <h3>GPU</h3>
      <p>{{ info.gpu_model }}</p>
    </article>
    <article class="glass-panel stat-card">
      <h3>RAM</h3>
      <p>{{ info.ram_spec }}</p>
    </article>
    <article class="glass-panel stat-card">
      <h3>Motherboard</h3>
      <p>{{ info.motherboard }}</p>
    </article>
    <article class="glass-panel full-width">
      <h3>Storage Devices</h3>
      <ul>
        <li v-for="disk in info.disk_models" :key="disk">{{ disk }}</li>
      </ul>
    </article>
  </section>
</template>

<script setup lang="ts">
import { computed } from "vue";

import { useAppStore } from "../stores/app";

const store = useAppStore();
const info = computed(() => store.hardwareInfo);
</script>
