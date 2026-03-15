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
      <div class="toolkit-ai-status-grid">
        <div class="toolkit-ai-status-item">
          <div class="toolkit-ai-status-head">
            <span class="toolkit-ai-status-label">{{ t('toolkit.aiStatusModel') }}</span>
            <div class="toolkit-ai-state-pill toolkit-ai-state-pill--compact" :class="`is-${workspaceStateTone}`">
              <span class="toolkit-ai-state-dot" aria-hidden="true"></span>
              <span>{{ workspaceStateLabel }}</span>
            </div>
          </div>
          <strong class="toolkit-ai-status-value">{{ localStatus?.modelName || '0.8B' }}</strong>
        </div>
        <div class="toolkit-ai-status-item">
          <span class="toolkit-ai-status-label">{{ t('toolkit.aiStatusEndpoint') }}</span>
          <strong class="toolkit-ai-status-value">{{ localStatus?.serverUrl || '-' }}</strong>
        </div>
        <div class="toolkit-ai-status-item toolkit-ai-status-item--stacked">
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
        </div>
      </div>

      <div class="toolkit-ai-actions">
        <UiButton native-type="button" preset="overlay-primary" :disabled="statusBusy || !isTauriRuntime" @click="emit('refresh-status')">
          {{ statusBusy ? t('toolkit.aiEnsurePending') : t('toolkit.aiEnsure') }}
        </UiButton>
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
  gap: 8px;
}

.toolkit-ai-actions {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 10px;
  flex-wrap: wrap;
}

.toolkit-ai-status-label {
  font-size: 11px;
  letter-spacing: 0.08em;
  text-transform: uppercase;
  color: rgba(255, 255, 255, 0.54);
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

.toolkit-ai-status-grid {
  display: grid;
  grid-template-columns: minmax(120px, 0.9fr) minmax(160px, 1.25fr) minmax(140px, 1fr);
  gap: 8px;
}

.toolkit-ai-status-item {
  border-radius: 14px;
  border: 1px solid rgba(255, 255, 255, 0.08);
  background: rgba(255, 255, 255, 0.04);
  display: grid;
  gap: 2px;
  padding: 8px 10px;
  min-width: 0;
}

.toolkit-ai-status-head {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 8px;
  min-width: 0;
}

.toolkit-ai-status-item--stacked {
  grid-template-columns: repeat(3, minmax(0, 1fr));
  gap: 8px;
  align-content: start;
}

.toolkit-ai-status-pair {
  display: grid;
  gap: 1px;
  min-width: 0;
}

.toolkit-ai-status-value {
  font-size: 12px;
  color: rgba(255, 255, 255, 0.95);
  word-break: break-word;
  line-height: 1.35;
}

@media (max-width: 760px) {
  .toolkit-ai-status-grid {
    grid-template-columns: 1fr;
  }

  .toolkit-ai-status-item--stacked {
    grid-template-columns: repeat(3, minmax(0, 1fr));
    gap: 6px;
  }
}
</style>
