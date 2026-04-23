<template>
  <div class="invest-history">
    <div class="invest-editor-header">
      <UiButton native-type="button" preset="toolkit-link" @click="emit('back')">
        <span class="material-symbols-outlined">arrow_back</span>
        <span>{{ t('invest.backToList') }}</span>
      </UiButton>
      <div class="invest-history-titles">
        <span class="invest-editor-title">{{ t('invest.backtestRecordsTitle') }}</span>
        -
        <span v-if="strategyName" class="invest-history-sub">{{ strategyName }}</span>
      </div>
    </div>

    <div v-if="loading" class="invest-loading">
      <span class="material-symbols-outlined invest-spin">progress_activity</span>
      <span>{{ t('invest.backtestHistoryLoading') }}</span>
    </div>

    <div v-else-if="entries.length === 0" class="invest-empty invest-history-empty">
      <span class="material-symbols-outlined invest-empty-icon">history</span>
      <p>{{ t('invest.backtestHistoryEmpty') }}</p>
    </div>

    <div v-else class="invest-history-rows">
      <button
        v-for="e in entries"
        :key="e.id"
        type="button"
        class="invest-history-row"
        @click="emit('open', e.id)">
        <div class="invest-history-row-main">
          <span class="invest-history-time">{{ formatRunAt(e.createdAt) }}</span>
          <span class="invest-history-range">{{ e.result.startDate }} → {{ e.result.endDate }}</span>
        </div>
        <div class="invest-history-row-metrics">
          <span class="invest-history-profit" :class="e.result.profit >= 0 ? 'invest-profit' : 'invest-loss'">
            {{ e.result.profit >= 0 ? '+' : '' }}¥{{ e.result.profit.toFixed(2) }}
          </span>
          <span class="invest-history-rate" :class="e.result.returnRate >= 0 ? 'invest-profit' : 'invest-loss'">
            {{ (e.result.returnRate * 100).toFixed(2) }}%
          </span>
          <span class="material-symbols-outlined invest-history-chevron">chevron_right</span>
        </div>
      </button>
    </div>
  </div>
</template>

<script setup lang="ts">
import { useI18n } from 'vue-i18n';

import UiButton from '@/components/ui/Button';
import type { InvestBacktestHistoryEntry } from '@/types/invest';

defineProps<{
  strategyName: string;
  entries: InvestBacktestHistoryEntry[];
  loading: boolean;
}>();

const emit = defineEmits<{
  (e: 'back'): void;
  (e: 'open', id: string): void;
}>();

const { t, locale } = useI18n();

function formatRunAt(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  return new Intl.DateTimeFormat(locale.value === 'zh-CN' ? 'zh-CN' : 'en-US', {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit'
  }).format(d);
}
</script>

<style scoped>
.invest-history-titles {
  display: flex;
  flex-direction: row;
  align-items: flex-start;
  gap: 2px;
  min-width: 0;
}
.invest-history-sub {
  font-size: 12px;
  color: rgba(255, 255, 255, 0.45);
  max-width: 100%;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}
.invest-history-empty {
  margin-top: 16px;
}
.invest-history-rows {
  display: flex;
  flex-direction: column;
  gap: 8px;
  margin-top: 12px;
}
.invest-history-row {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  width: 100%;
  text-align: left;
  padding: 10px 12px;
  border-radius: 8px;
  border: 1px solid rgba(255, 255, 255, 0.08);
  background: rgba(255, 255, 255, 0.03);
  color: inherit;
  cursor: pointer;
  transition:
    background 0.12s,
    border-color 0.12s;
}
.invest-history-row:hover {
  background: rgba(255, 255, 255, 0.06);
  border-color: rgba(255, 255, 255, 0.12);
}
.invest-history-row-main {
  display: flex;
  flex-direction: column;
  gap: 4px;
  min-width: 0;
}
.invest-history-time {
  font-size: 13px;
  font-weight: 500;
  color: rgba(255, 255, 255, 0.88);
}
.invest-history-range {
  font-size: 11px;
  color: rgba(255, 255, 255, 0.42);
}
.invest-history-row-metrics {
  display: flex;
  align-items: center;
  gap: 8px;
  flex-shrink: 0;
}
.invest-history-profit {
  font-size: 12px;
  font-variant-numeric: tabular-nums;
}
.invest-history-rate {
  font-size: 12px;
  font-variant-numeric: tabular-nums;
}
.invest-history-chevron {
  font-size: 20px;
  color: rgba(255, 255, 255, 0.28);
}
.invest-profit {
  color: rgba(80, 220, 140, 0.92);
}
.invest-loss {
  color: rgba(255, 120, 120, 0.9);
}
</style>
