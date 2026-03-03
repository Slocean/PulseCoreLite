<template>
  <div class="app-root">
    <div class="overlay-shell">
      <ReminderScreenEntry v-if="isReminderScreen" />
      <ToolkitEntry v-else />
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed } from 'vue';

import ReminderScreenEntry from './ReminderScreenEntry.vue';
import ToolkitEntry from './ToolkitEntry.vue';
const isReminderScreen = computed(() => {
  if (typeof window === 'undefined') {
    return false;
  }
  return new URLSearchParams(window.location.search).get('reminderScreen') === '1';
});
</script>
