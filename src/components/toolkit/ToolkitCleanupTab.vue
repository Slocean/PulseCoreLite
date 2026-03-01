<template>
  <div class="toolkit-card">
    <h2 class="toolkit-section-title">{{ t('toolkit.cleanupTitle') }}</h2>
    <div class="toolkit-cleanup-list">
      <div class="overlay-config-row">
        <span class="overlay-config-label">{{ t('toolkit.cleanupEnable') }}</span>
        <label class="overlay-switch" :aria-label="t('toolkit.cleanupEnable')">
          <input v-model="memoryTrimEnabled" type="checkbox" role="switch" />
          <span class="overlay-switch-track" aria-hidden="true"></span>
        </label>
      </div>
      <div class="overlay-config-row">
        <span class="overlay-config-label">{{ t('toolkit.cleanupSystem') }}</span>
        <label class="overlay-switch" :aria-label="t('toolkit.cleanupSystem')">
          <input v-model="memoryTrimSystemEnabled" type="checkbox" role="switch" />
          <span class="overlay-switch-track" aria-hidden="true"></span>
        </label>
      </div>
    </div>
    <div class="overlay-config-range">
      <button type="button" class="toolkit-link-label" @click="openTargetsDialog">
        {{ t('toolkit.cleanupInterval') }}
      </button>
      <span class="overlay-config-value">{{ memoryTrimIntervalMinutes }}{{ t('toolkit.minutes') }}</span>
      <input
        type="range"
        min="1"
        max="30"
        step="1"
        v-model.number="memoryTrimIntervalMinutes" />
    </div>
  </div>

  <OverlayDialog
    v-model:open="targetsDialogOpen"
    :title="t('toolkit.cleanupTargetsTitle')"
    :confirm-text="t('overlay.dialogConfirm')"
    :cancel-text="t('overlay.dialogCancel')"
    :close-label="t('overlay.dialogClose')"
    :autofocus-confirm="false"
    @confirm="confirmTargets"
    @cancel="cancelTargets">
    <template #body>
      <div v-if="enabledTargetOptions.length" class="overlay-config overlay-config--single-column">
        <label v-for="item in enabledTargetOptions" :key="item.id">
          <input v-model="tempTargets" type="checkbox" :value="item.id" />
          {{ item.label }}
        </label>
      </div>
      <div v-else class="overlay-dialog-message overlay-dialog-message--muted">
        {{ t('toolkit.cleanupTargetsEmpty') }}
      </div>
    </template>
  </OverlayDialog>
</template>

<script setup lang="ts">
import { computed, nextTick, ref, watch } from 'vue';
import { useI18n } from 'vue-i18n';

import OverlayDialog from '../OverlayDialog.vue';
import { useAppStore } from '../../stores/app';

const emit = defineEmits<{
  (event: 'contentChange'): void;
}>();

const { t } = useI18n();
const store = useAppStore();

const targetsDialogOpen = ref(false);
const tempTargets = ref<Array<'app' | 'system'>>([]);

const memoryTrimEnabled = computed({
  get: () => store.settings.memoryTrimEnabled,
  set: value => void store.setMemoryTrimEnabled(value)
});
const memoryTrimSystemEnabled = computed({
  get: () => store.settings.memoryTrimSystemEnabled,
  set: value => void store.setMemoryTrimSystemEnabled(value)
});
const memoryTrimTargets = computed(() => store.settings.memoryTrimTargets);

const memoryTrimIntervalMinutes = computed({
  get: () => store.settings.memoryTrimIntervalMinutes,
  set: value => void store.setMemoryTrimIntervalMinutes(value)
});

const enabledTargetOptions = computed(() => {
  const options: Array<{ id: 'app' | 'system'; label: string }> = [];
  if (memoryTrimEnabled.value) {
    options.push({ id: 'app', label: t('toolkit.cleanupEnable') });
  }
  if (memoryTrimSystemEnabled.value) {
    options.push({ id: 'system', label: t('toolkit.cleanupSystem') });
  }
  return options;
});

watch([memoryTrimEnabled, memoryTrimSystemEnabled, memoryTrimIntervalMinutes, memoryTrimTargets], () => {
  nextTick(() => emit('contentChange'));
});

watch(
  () => targetsDialogOpen.value,
  open => {
    if (!open) return;
    const enabledIds = enabledTargetOptions.value.map(item => item.id);
    tempTargets.value = memoryTrimTargets.value.filter(target => enabledIds.includes(target));
  }
);

function openTargetsDialog() {
  targetsDialogOpen.value = true;
}

async function confirmTargets() {
  await store.setMemoryTrimTargets(tempTargets.value);
}

function cancelTargets() {
  // no-op, temp selections are discarded
}
</script>
