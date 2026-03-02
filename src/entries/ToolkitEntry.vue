<template>
  <ToolkitPage />
</template>

<script setup lang="ts">
import ToolkitPage from '../pages/toolkit.vue';
import { useEntryBootstrap } from './useEntryBootstrap';

useEntryBootstrap({
  documentClassName: 'window-toolkit'
});
</script>
