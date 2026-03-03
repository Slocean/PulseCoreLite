<template>
  <ReminderScreenPage />
</template>

<script setup lang="ts">
import ReminderScreenPage from '../pages/ReminderScreenPage.vue';
import { storageKeys, storageRepository } from '../services/storageRepository';
import { useEntryBootstrap } from './useEntryBootstrap';

useEntryBootstrap({
  bootstrapStore: false,
  documentClassName: 'window-toolkit',
  resolveStaticLanguage() {
    const parsed = storageRepository.getJsonSync<{ language?: 'zh-CN' | 'en-US' }>(storageKeys.settings);
    return parsed?.language === 'en-US' || parsed?.language === 'zh-CN' ? parsed.language : null;
  },
  shouldDisposeStore: false
});
</script>
