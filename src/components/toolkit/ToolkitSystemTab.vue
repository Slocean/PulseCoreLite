<template>
  <UiToast channel="toolkit" />

  <UiCollapsiblePanel
    class="toolkit-card toolkit-system-panel"
    :title="t('toolkit.systemStartupTitle')"
    v-model="panelOpen"
    header-mode="split"
    header-class="toolkit-section-header"
    split-title-preset="toolkit-collapse-title"
    split-toggle-preset="toolkit-collapse-icon"
    title-class="toolkit-section-title"
    indicator-class="toolkit-collapse-indicator"
    @toggle="handlePanelToggle">
    <template #header-actions>
      <SystemToolHintTrigger
        :active="hintOpen"
        :label="t('toolkit.systemToolHintLabel')"
        @toggle="hintOpen = !hintOpen" />
    </template>

    <div v-if="hintOpen" class="toolkit-system-hint-panel" role="note">
      {{ t('toolkit.systemStartupHint') }}
    </div>

    <div class="toolkit-system-summary">
      <div class="toolkit-system-stat">
        <span class="overlay-config-label">{{ t('toolkit.systemStartupTotal') }}</span>
        <span class="toolkit-system-value">{{ items.length }}</span>
      </div>
      <div class="toolkit-system-stat">
        <span class="overlay-config-label">{{ t('toolkit.systemStartupEnabledCount') }}</span>
        <span class="toolkit-system-value">{{ enabledCount }}</span>
      </div>
    </div>

    <div class="toolkit-system-actions">
      <UiButton
        native-type="button"
        preset="overlay-primary"
        :disabled="loading || !runtimeSupported"
        @click="refresh">
        {{ loading ? t('toolkit.systemStartupLoading') : t('toolkit.systemStartupRefresh') }}
      </UiButton>
    </div>

    <p v-if="!runtimeSupported" class="toolkit-error">{{ t('toolkit.systemStartupRequireDesktop') }}</p>
    <p v-else-if="errorMessage" class="toolkit-error">{{ errorMessage }}</p>

    <div v-if="!items.length && !loading" class="toolkit-system-empty">
      {{ t('toolkit.systemStartupEmpty') }}
    </div>

    <div v-else class="toolkit-system-list">
      <div
        v-for="item in items"
        :key="item.id"
        class="toolkit-system-item"
        :class="{ 'toolkit-system-item--disabled': !item.enabled }">
        <div class="toolkit-system-item-header">
          <div class="toolkit-system-item-main">
            <span class="toolkit-system-item-name" :title="item.name">{{ item.name }}</span>
            <div class="toolkit-system-item-meta">
              <span class="toolkit-system-badge" :class="item.enabled ? 'toolkit-system-badge--on' : 'toolkit-system-badge--off'">
                {{ item.enabled ? t('toolkit.systemStartupEnabled') : t('toolkit.systemStartupDisabled') }}
              </span>
              <span :title="sourceLabel(item.source)">{{ sourceLabel(item.source) }}</span>
              <span v-if="!item.writable" class="toolkit-system-readonly">{{ t('toolkit.systemStartupReadOnly') }}</span>
            </div>
          </div>
          <UiSwitch
            class="toolkit-system-item-switch"
            :model-value="item.enabled"
            :disabled="!item.writable || togglingId === item.id || loading"
            :aria-label="t('toolkit.systemStartupToggle')"
            @update:model-value="(value: boolean) => toggleItem(item, value)" />
        </div>
        <div class="toolkit-system-item-command" :title="item.command">{{ item.command }}</div>
      </div>
    </div>
  </UiCollapsiblePanel>

  <SystemToolsPanels @contentChange="emit('contentChange')" />
</template>

<script setup lang="ts">
import { nextTick, ref, watch } from 'vue';
import { useI18n } from 'vue-i18n';

import UiButton from '@/components/ui/Button';
import UiCollapsiblePanel from '@/components/ui/CollapsiblePanel';
import UiSwitch from '@/components/ui/Switch';
import UiToast from '@/components/ui/Toast';
import SystemToolsPanels from '@/components/toolkit/SystemToolsPanels.vue';
import SystemToolHintTrigger from '@/components/toolkit/SystemToolHintTrigger.vue';
import { useToolkitStartupItems } from '@/composables/useToolkitStartupItems';

const emit = defineEmits<{
  (event: 'contentChange'): void;
}>();

const { t } = useI18n();
const panelOpen = ref(true);
const hintOpen = ref(false);
const {
  items,
  loading,
  togglingId,
  errorMessage,
  runtimeSupported,
  enabledCount,
  sourceLabel,
  refresh,
  toggleItem
} = useToolkitStartupItems(t);

function handlePanelToggle(open: boolean) {
  if (!open) {
    hintOpen.value = false;
  }
  nextTick(() => emit('contentChange'));
}

watch([items, loading, errorMessage, hintOpen, panelOpen], () => {
  nextTick(() => emit('contentChange'));
});
</script>
