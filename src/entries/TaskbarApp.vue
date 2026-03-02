<template>
  <div class="app-root">
    <div class="overlay-shell overlay-shell--taskbar">
      <TaskbarMonitorPage />
    </div>
  </div>
</template>

<script setup lang="ts">
import TaskbarMonitorPage from '../pages/taskbar.vue';
import { useEntryBootstrap } from './useEntryBootstrap';

useEntryBootstrap({
  documentClassName: 'window-taskbar'
});
</script>
