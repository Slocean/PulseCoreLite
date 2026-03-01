<template>
  <div class="toolkit-card">
    <h2 class="toolkit-section-title">{{ t('toolkit.cleanupTitle') }}</h2>
    <div class="overlay-config-row">
      <span class="overlay-config-label">{{ t('toolkit.cleanupEnable') }}</span>
      <label class="overlay-switch" :aria-label="t('toolkit.cleanupEnable')">
        <input v-model="memoryTrimEnabled" type="checkbox" role="switch" />
        <span class="overlay-switch-track" aria-hidden="true"></span>
      </label>
    </div>
    <div class="overlay-config-range">
      <span class="overlay-config-label">{{ t('toolkit.cleanupInterval') }}</span>
      <span class="overlay-config-value">{{ memoryTrimIntervalMinutes }}{{ t('toolkit.minutes') }}</span>
      <input
        type="range"
        min="1"
        max="30"
        step="1"
        v-model.number="memoryTrimIntervalMinutes"
        :disabled="!memoryTrimEnabled" />
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed, nextTick, watch } from 'vue';
import { useI18n } from 'vue-i18n';

import { useAppStore } from '../../stores/app';

const emit = defineEmits<{
  (event: 'contentChange'): void;
}>();

const { t } = useI18n();
const store = useAppStore();

const memoryTrimEnabled = computed({
  get: () => store.settings.memoryTrimEnabled,
  set: value => void store.setMemoryTrimEnabled(value)
});

const memoryTrimIntervalMinutes = computed({
  get: () => store.settings.memoryTrimIntervalMinutes,
  set: value => void store.setMemoryTrimIntervalMinutes(value)
});

watch([memoryTrimEnabled, memoryTrimIntervalMinutes], () => {
  nextTick(() => emit('contentChange'));
});
</script>
