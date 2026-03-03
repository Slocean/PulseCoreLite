<template>
  <div class="overlay-status">
    <div class="overlay-status-left">
      <span class="overlay-status-dot"></span>
      <span>{{ t('overlay.systemStable') }}</span>
    </div>
    <span class="overlay-status-uptime">{{ t('overlay.uptimePrefix') }} {{ uptimeLabel }}</span>
  </div>
</template>

<script setup lang="ts">
import { useI18n } from 'vue-i18n';

defineProps<{
  uptimeLabel: string;
}>();

const { t } = useI18n();
</script>
