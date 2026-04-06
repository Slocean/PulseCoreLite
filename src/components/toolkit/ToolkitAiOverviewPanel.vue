<template>
  <UiCollapsiblePanel
    v-model="openModel"
    class="toolkit-card"
    :title="t('toolkit.aiModelParametersTitle')"
    single-header-preset="toolkit-collapse"
    title-class="toolkit-section-title"
    indicator-class="toolkit-collapse-indicator"
    @toggle="emit('contentChange')">
    <div class="toolkit-ai-overview">
      <div class="toolkit-ai-status-layout">
        <section class="toolkit-ai-status-section toolkit-ai-status-section--model">
          <div class="toolkit-ai-status-head">
            <div class="toolkit-ai-inline-meta">
              <span class="toolkit-ai-status-label">{{ t('toolkit.aiStatusModel') }}</span>
              <strong class="toolkit-ai-status-value toolkit-ai-status-value--inline">
                {{ modelDisplayName }}
              </strong>
            </div>
            <div class="toolkit-ai-status-controls">
              <UiButton
                native-type="button"
                width="90px"
                preset="overlay-primary"
                :disabled="
                  statusBusy ||
                  !isTauriRuntime ||
                  ((!localStatus?.running && !selectedModelDir) ||
                    (!localStatus?.running && launcherNeedsSelection && !selectedLauncherDir))
                "
                @click="localStatus?.running ? emit('stop-local-ai') : emit('start-local-ai')">
                {{ actionLabel }}
              </UiButton>
            </div>
          </div>
          <p v-if="showDirectoryHint" class="toolkit-ai-status-hint">
            {{ t('toolkit.aiDirectorySettingsHint') }}
          </p>
        </section>
        <section class="toolkit-ai-status-section">
          <div class="toolkit-ai-status-head">
            <div class="toolkit-ai-inline-meta">
              <span class="toolkit-ai-status-label">{{ t('toolkit.aiStatusEndpoint') }}</span>
              <strong class="toolkit-ai-status-value toolkit-ai-status-value--inline">
                {{ localStatus?.serverUrl || '-' }}
              </strong>
            </div>
            <div class="toolkit-ai-state-pill toolkit-ai-state-pill--compact" :class="`is-${workspaceStateTone}`">
              <span class="toolkit-ai-state-dot" aria-hidden="true"></span>
              <span>{{ workspaceStateLabel }}</span>
            </div>
          </div>
        </section>
        <section class="toolkit-ai-status-section toolkit-ai-status-section--metrics">
          <div class="toolkit-ai-status-pair">
            <span class="toolkit-ai-status-label">{{ t('toolkit.aiMetricContext') }}</span>
            <strong class="toolkit-ai-status-value">{{ contextWindowSize }}</strong>
          </div>
          <div class="toolkit-ai-status-pair">
            <span class="toolkit-ai-status-label">{{ t('toolkit.aiMetricConversation') }}</span>
            <strong class="toolkit-ai-status-value">{{ conversationTurns }}</strong>
          </div>
          <div class="toolkit-ai-status-pair">
            <span class="toolkit-ai-status-label">{{ t('toolkit.aiMetricMode') }}</span>
            <strong class="toolkit-ai-status-value">{{ capabilityLabel }}</strong>
          </div>
          <div class="toolkit-ai-status-pair">
            <span class="toolkit-ai-status-label">{{ t('toolkit.aiMetricLaunchMode') }}</span>
            <strong class="toolkit-ai-status-value">{{ launchModeLabel }}</strong>
          </div>
        </section>
      </div>
    </div>
  </UiCollapsiblePanel>
</template>

<script setup lang="ts">
import { computed } from 'vue';
import { useI18n } from 'vue-i18n';

import UiButton from '@/components/ui/Button';
import UiCollapsiblePanel from '@/components/ui/CollapsiblePanel';
import type { LocalAiStatus } from '@/types';

const props = defineProps<{
  modelValue: boolean;
  localStatus: LocalAiStatus | null;
  selectedModelDir: string | null;
  selectedLauncherDir: string | null;
  launcherNeedsSelection: boolean;
  busyState: 'idle' | 'loading' | 'start' | 'stop';
  workspaceStateTone: string;
  workspaceStateLabel: string;
  contextWindowSize: number;
  conversationTurns: number;
  capabilityLabel: string;
  launchModeLabel: string;
  statusBusy: boolean;
  isTauriRuntime: boolean;
}>();

const emit = defineEmits<{
  (event: 'update:modelValue', value: boolean): void;
  (event: 'start-local-ai'): void;
  (event: 'stop-local-ai'): void;
  (event: 'contentChange'): void;
}>();

const { t } = useI18n();
const openModel = computed({
  get: () => props.modelValue,
  set: value => emit('update:modelValue', value)
});
const actionLabel = computed(() => (props.localStatus?.running ? t('toolkit.aiStop') : t('toolkit.aiStart')));
const modelDisplayName = computed(() => {
  const value = props.selectedModelDir?.trim();
  if (!value) return '-';
  const normalized = value.replace(/[\\/]+$/, '');
  const segments = normalized.split(/[\\/]/).filter(Boolean);
  return segments[segments.length - 1] || '-';
});
const showDirectoryHint = computed(
  () => !props.selectedModelDir || (props.launcherNeedsSelection && !props.selectedLauncherDir)
);
</script>

<style scoped>
.toolkit-ai-overview {
  display: grid;
  gap: 4px;
}

.toolkit-ai-status-label {
  font-size: 11px;
  letter-spacing: 0.08em;
  text-transform: uppercase;
  color: rgba(255, 255, 255, 0.54);
  white-space: nowrap;
}

.toolkit-ai-state-pill {
  display: inline-flex;
  align-items: center;
  gap: 8px;
  min-height: 30px;
  padding: 0 10px;
  border-radius: 999px;
  border: 1px solid rgba(255, 255, 255, 0.1);
  background: rgba(255, 255, 255, 0.04);
}

.toolkit-ai-state-pill--compact {
  min-height: 22px;
  padding: 0 8px;
  gap: 6px;
  font-size: 10px;
  letter-spacing: 0.04em;
}

.toolkit-ai-state-pill.is-ready {
  border-color: rgba(52, 211, 153, 0.3);
  color: rgba(195, 255, 219, 0.96);
  background: rgba(6, 95, 70, 0.24);
}

.toolkit-ai-state-pill.is-busy {
  border-color: rgba(96, 165, 250, 0.3);
  color: rgba(191, 219, 254, 0.96);
  background: rgba(30, 64, 175, 0.22);
}

.toolkit-ai-state-pill.is-offline {
  border-color: rgba(251, 191, 36, 0.28);
  color: rgba(254, 240, 138, 0.92);
  background: rgba(120, 53, 15, 0.2);
}

.toolkit-ai-state-dot {
  width: 6px;
  height: 6px;
  border-radius: 999px;
  background: currentColor;
}

.toolkit-ai-status-layout {
  display: grid;
  grid-template-columns: 1fr;
}

.toolkit-ai-status-section {
  display: grid;
  gap: 4px;
  min-width: 0;
  padding: 6px 0;
}

.toolkit-ai-status-section + .toolkit-ai-status-section {
  border-top: 1px solid rgba(255, 255, 255, 0.08);
  padding-top: 6px;
}

.toolkit-ai-inline-meta {
  display: inline-flex;
  align-items: baseline;
  gap: 6px;
  min-width: 0;
  flex-wrap: wrap;
}

.toolkit-ai-status-head {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 6px;
  min-width: 0;
  flex-wrap: wrap;
}

.toolkit-ai-status-controls {
  display: flex;
  align-items: center;
  justify-content: flex-end;
  gap: 6px;
}

.toolkit-ai-status-section--model .toolkit-ai-status-controls {
  flex: 1;
  flex-wrap: nowrap;
  overflow: hidden;
}

.toolkit-ai-status-controls :deep(.ui-button__content) {
  white-space: nowrap;
}

.toolkit-ai-state-pill {
  white-space: nowrap;
}

.toolkit-ai-status-section--metrics {
  display: flex;
  flex-wrap: nowrap;
  align-items: stretch;
  border-top: 1px solid rgba(255, 255, 255, 0.08);
  align-content: start;
}

.toolkit-ai-status-pair {
  display: grid;
  gap: 1px;
  min-width: 0;
  flex: 1 1 25%;
  max-width: 25%;
}

.toolkit-ai-status-value {
  font-size: 12px;
  color: rgba(255, 255, 255, 0.95);
  word-break: break-word;
  line-height: 1.35;
}

.toolkit-ai-status-hint {
  margin: 0;
  font-size: 11px;
  line-height: 1.45;
  color: rgba(255, 255, 255, 0.62);
}

.toolkit-ai-status-value--inline {
  word-break: break-all;
}
</style>
