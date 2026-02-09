<template>
  <section class="metric-card glass-panel">
    <header>
      <p>{{ title }}</p>
      <strong>{{ value }}</strong>
    </header>
    <small>{{ subtitle }}</small>
    <div class="progress">
      <div class="progress-inner" :style="{ width: `${Math.max(0, Math.min(100, percent))}%` }"></div>
    </div>
  </section>
</template>

<script setup lang="ts">
defineProps<{
  title: string;
  value: string;
  subtitle: string;
  percent: number;
}>();
</script>
