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
              <strong class="toolkit-ai-status-value toolkit-ai-status-value--inline">{{ localStatus?.modelName || '0.8B' }}</strong>
            </div>
            <div class="toolkit-ai-status-controls">
              <UiButton native-type="button" preset="overlay-chip-soft" :disabled="statusBusy || !isTauriRuntime || !localStatus?.running" @click="emit('stop-local-ai')">
                停止
              </UiButton>
              <UiButton native-type="button" preset="overlay-chip-soft" :disabled="statusBusy || !isTauriRuntime" @click="emit('refresh-status')">
                刷新状态
              </UiButton>
            </div>
          </div>
        </section>
        <section class="toolkit-ai-status-section">
          <div class="toolkit-ai-status-head">
            <div class="toolkit-ai-inline-meta">
              <span class="toolkit-ai-status-label">{{ t('toolkit.aiStatusEndpoint') }}</span>
              <strong class="toolkit-ai-status-value toolkit-ai-status-value--inline">{{ localStatus?.serverUrl || '-' }}</strong>
            </div>
            <div class="toolkit-ai-state-pill toolkit-ai-state-pill--compact" :class="`is-${workspaceStateTone}`">
              <span class="toolkit-ai-state-dot" aria-hidden="true"></span>
              <span>{{ workspaceStateLabel }}</span>
            </div>
          </div>
        </section>
        <section class="toolkit-ai-status-section">
          <div class="toolkit-ai-status-head">
            <span class="toolkit-ai-status-label">模型目录</span>
            <UiButton native-type="button" preset="overlay-chip-soft" :disabled="statusBusy || !isTauriRuntime" @click="emit('choose-model-dir')">
              选择模型目录
            </UiButton>
          </div>
          <strong class="toolkit-ai-status-value">{{ selectedModelDir || '未选择' }}</strong>
        </section>
      </div>
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
        <div class="toolkit-ai-status-pair toolkit-ai-status-pair--action">
          <UiButton
            native-type="button"
            preset="overlay-primary"
            :disabled="statusBusy || !isTauriRuntime || !selectedModelDir"
            @click="emit('start-local-ai')">
            {{ statusBusy ? t('toolkit.aiStartPending') : t('toolkit.aiStart') }}
          </UiButton>
        </div>
      </section>
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
  workspaceStateTone: string;
  workspaceStateLabel: string;
  contextWindowSize: number;
  conversationTurns: number;
  capabilityLabel: string;
  statusBusy: boolean;
  isTauriRuntime: boolean;
}>();

const emit = defineEmits<{
  (event: 'update:modelValue', value: boolean): void;
  (event: 'choose-model-dir'): void;
  (event: 'start-local-ai'): void;
  (event: 'stop-local-ai'): void;
  (event: 'refresh-status'): void;
  (event: 'contentChange'): void;
}>();

const { t } = useI18n();
const openModel = computed({
  get: () => props.modelValue,
  set: value => emit('update:modelValue', value)
});
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
  grid-template-columns: minmax(120px, 0.8fr) minmax(160px, 1.1fr) minmax(180px, 1.4fr) minmax(140px, 1fr);
  gap: 0;
}

.toolkit-ai-status-section {
  display: grid;
  gap: 4px;
  min-width: 0;
  padding: 6px 0;
}

.toolkit-ai-status-section + .toolkit-ai-status-section {
  border-left: 1px solid rgba(255, 255, 255, 0.08);
  padding-left: 12px;
  margin-left: 12px;
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
  display: inline-flex;
  align-items: center;
  justify-content: flex-end;
  gap: 6px;
  min-width: 0;
  flex-wrap: wrap;
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
  padding-top: 8px;
  gap: 6px;
  align-content: start;
}

.toolkit-ai-status-pair {
  display: grid;
  gap: 1px;
  min-width: 0;
  flex: 0 0 calc((100% - 24px) / 4);
  max-width: calc((100% - 24px) / 4);
}

.toolkit-ai-status-pair--action {
  align-self: stretch;
}

.toolkit-ai-status-pair--action :deep(.ui-button) {
  width: 100%;
}

.toolkit-ai-status-value {
  font-size: 12px;
  color: rgba(255, 255, 255, 0.95);
  word-break: break-word;
  line-height: 1.35;
}

.toolkit-ai-status-value--inline {
  word-break: break-all;
}

@media (max-width: 760px) {
  .toolkit-ai-status-layout {
    grid-template-columns: 1fr;
    gap: 8px;
  }

  .toolkit-ai-status-section {
    padding: 0;
  }

  .toolkit-ai-status-section + .toolkit-ai-status-section {
    border-left: 0;
    border-top: 1px solid rgba(255, 255, 255, 0.08);
    padding-left: 0;
    padding-top: 8px;
    margin-left: 0;
  }

  .toolkit-ai-status-controls {
    gap: 4px;
  }
}
</style>
