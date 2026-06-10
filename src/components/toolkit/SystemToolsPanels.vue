<template>
  <UiCollapsiblePanel
    class="toolkit-card toolkit-system-panel"
    :title="t('toolkit.systemUpdateTitle')"
    v-model="updatePanelOpen"
    header-mode="split"
    header-class="toolkit-section-header"
    split-title-preset="toolkit-collapse-title"
    split-toggle-preset="toolkit-collapse-icon"
    title-class="toolkit-section-title"
    indicator-class="toolkit-collapse-indicator"
    @toggle="handleUpdatePanelToggle">
    <template #header-actions>
      <SystemToolHintTrigger
        :active="updateHintOpen"
        :label="t('toolkit.systemToolHintLabel')"
        @toggle="updateHintOpen = !updateHintOpen" />
    </template>

    <div v-if="updateHintOpen" class="toolkit-system-hint-panel" role="note">
      {{ t('toolkit.systemUpdateHint') }}
    </div>

    <div class="toolkit-system-tool-status">
      <span class="overlay-config-label">{{ t('toolkit.systemUpdateStatus') }}</span>
      <span
        class="toolkit-system-badge"
        :class="status.windowsUpdateDisabled ? 'toolkit-system-badge--on' : 'toolkit-system-badge--off'">
        {{
          status.windowsUpdateDisabled
            ? t('toolkit.systemUpdateDisabled')
            : t('toolkit.systemUpdateEnabled')
        }}
      </span>
    </div>
    <div class="toolkit-system-actions">
      <UiButton
        native-type="button"
        preset="overlay-primary"
        :disabled="loading || !runtimeSupported || pendingAction != null"
        @click="toggleWindowsUpdate">
        {{
          status.windowsUpdateDisabled
            ? t('toolkit.systemUpdateRestoreAction')
            : t('toolkit.systemUpdateDisableAction')
        }}
      </UiButton>
    </div>
  </UiCollapsiblePanel>

  <UiCollapsiblePanel
    class="toolkit-card toolkit-system-panel"
    :title="t('toolkit.systemContextMenuTitle')"
    v-model="contextPanelOpen"
    header-mode="split"
    header-class="toolkit-section-header"
    split-title-preset="toolkit-collapse-title"
    split-toggle-preset="toolkit-collapse-icon"
    title-class="toolkit-section-title"
    indicator-class="toolkit-collapse-indicator"
    @toggle="handleContextPanelToggle">
    <template #header-actions>
      <SystemToolHintTrigger
        :active="contextHintOpen"
        :label="t('toolkit.systemToolHintLabel')"
        @toggle="contextHintOpen = !contextHintOpen" />
    </template>

    <div v-if="contextHintOpen" class="toolkit-system-hint-panel" role="note">
      {{ t('toolkit.systemContextMenuHint') }}
    </div>

    <div class="toolkit-system-tool-row">
      <span class="overlay-config-label">{{ t('toolkit.systemContextMenuStyle') }}</span>
      <UiSelect
        v-model="selectedContextMenuStyle"
        :options="contextMenuOptions"
        :disabled="loading || !runtimeSupported || pendingAction != null" />
    </div>
    <div class="toolkit-system-actions">
      <UiButton
        native-type="button"
        preset="overlay-primary"
        :disabled="loading || !runtimeSupported || pendingAction != null || !contextMenuDirty"
        @click="applyContextMenuStyle">
        {{ t('toolkit.systemContextMenuApply') }}
      </UiButton>
    </div>
  </UiCollapsiblePanel>

  <UiCollapsiblePanel
    class="toolkit-card toolkit-system-panel"
    :title="t('toolkit.systemActivationTitle')"
    v-model="activationPanelOpen"
    header-mode="split"
    header-class="toolkit-section-header"
    split-title-preset="toolkit-collapse-title"
    split-toggle-preset="toolkit-collapse-icon"
    title-class="toolkit-section-title"
    indicator-class="toolkit-collapse-indicator"
    @toggle="handleActivationPanelToggle">
    <template #header-actions>
      <SystemToolHintTrigger
        :active="activationHintOpen"
        :label="t('toolkit.systemToolHintLabel')"
        @toggle="activationHintOpen = !activationHintOpen" />
    </template>

    <div v-if="activationHintOpen" class="toolkit-system-hint-panel" role="note">
      {{ t('toolkit.systemActivationHint') }}
    </div>

    <div class="toolkit-system-actions toolkit-system-actions--dual">
      <UiButton
        native-type="button"
        preset="overlay-primary"
        :disabled="loading || !runtimeSupported || pendingAction != null"
        @click="activateWindows">
        {{ t('toolkit.systemActivationWindows') }}
      </UiButton>
      <UiButton
        native-type="button"
        preset="overlay-primary"
        :disabled="loading || !runtimeSupported || pendingAction != null"
        @click="activateOffice">
        {{ t('toolkit.systemActivationOffice') }}
      </UiButton>
    </div>
  </UiCollapsiblePanel>

  <p v-if="errorMessage" class="toolkit-error">{{ errorMessage }}</p>
</template>

<script setup lang="ts">
import { computed, nextTick, ref, watch } from 'vue';
import { useI18n } from 'vue-i18n';

import UiButton from '@/components/ui/Button';
import UiCollapsiblePanel from '@/components/ui/CollapsiblePanel';
import UiSelect from '@/components/ui/Select';
import SystemToolHintTrigger from '@/components/toolkit/SystemToolHintTrigger.vue';
import { useToolkitSystemTweaks } from '@/composables/useToolkitSystemTweaks';
import type { ContextMenuStyle } from '@/types/systemTools';

const emit = defineEmits<{
  (event: 'contentChange'): void;
}>();

const { t } = useI18n();
const updatePanelOpen = ref(true);
const contextPanelOpen = ref(true);
const activationPanelOpen = ref(false);
const updateHintOpen = ref(false);
const contextHintOpen = ref(false);
const activationHintOpen = ref(false);

const {
  status,
  loading,
  pendingAction,
  selectedContextMenuStyle,
  errorMessage,
  runtimeSupported,
  contextMenuDirty,
  toggleWindowsUpdate,
  applyContextMenuStyle,
  activateWindows,
  activateOffice
} = useToolkitSystemTweaks(t);

const contextMenuOptions = computed(() => [
  { value: 'win11' as ContextMenuStyle, label: t('toolkit.systemContextMenuWin11') },
  { value: 'win10' as ContextMenuStyle, label: t('toolkit.systemContextMenuWin10') }
]);

function handleUpdatePanelToggle(open: boolean) {
  if (!open) {
    updateHintOpen.value = false;
  }
  nextTick(() => emit('contentChange'));
}

function handleContextPanelToggle(open: boolean) {
  if (!open) {
    contextHintOpen.value = false;
  }
  nextTick(() => emit('contentChange'));
}

function handleActivationPanelToggle(open: boolean) {
  if (!open) {
    activationHintOpen.value = false;
  }
  nextTick(() => emit('contentChange'));
}

watch(
  [
    status,
    loading,
    errorMessage,
    updatePanelOpen,
    contextPanelOpen,
    activationPanelOpen,
    updateHintOpen,
    contextHintOpen,
    activationHintOpen,
    selectedContextMenuStyle
  ],
  () => {
    nextTick(() => emit('contentChange'));
  }
);
</script>
