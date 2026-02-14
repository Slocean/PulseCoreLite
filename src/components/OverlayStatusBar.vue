<template>
  <div class="overlay-status">
    <div class="overlay-status-left">
      <span class="overlay-status-dot"></span>
      <span>SYSTEM STABLE</span>
    </div>
    <span class="overlay-status-uptime">Uptime: {{ uptimeLabel }}</span>
  </div>
</template>

<script setup lang="ts">
defineProps<{
  uptimeLabel: string;
}>();
</script>
