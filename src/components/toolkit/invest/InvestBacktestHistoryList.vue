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
      <button
        v-if="entries.length > 0"
        type="button"
        class="invest-history-delete-btn"
        :class="{ 'invest-history-delete-btn--active': selectedIds.size > 0 }"
        :disabled="selectedIds.size === 0"
        @click="handleBatchDelete">
        <span class="material-symbols-outlined">delete</span>
        <span v-if="selectedIds.size > 0">{{ t('invest.batchDelete') }}({{ selectedIds.size }})</span>
        <span v-else>{{ t('invest.batchDelete') }}</span>
      </button>
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
      <div class="invest-history-select-all-row">
        <label class="invest-history-checkbox-wrap">
          <input
            type="checkbox"
            class="invest-history-checkbox"
            :checked="allSelected"
            :indeterminate="someSelected"
            @change="toggleSelectAll" />
          <span class="invest-history-select-all-label">{{ t('invest.selectAll') }}</span>
        </label>
      </div>

      <div
        v-for="e in entries"
        :key="e.id"
        class="invest-history-row"
        :class="{ 'invest-history-row--selected': selectedIds.has(e.id) }">
        <label class="invest-history-checkbox-wrap" @click.stop>
          <input
            type="checkbox"
            class="invest-history-checkbox"
            :checked="selectedIds.has(e.id)"
            @change="toggleSelect(e.id)" />
        </label>
        <button
          type="button"
          class="invest-history-row-content"
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
  </div>
</template>

<script setup lang="ts">
import { computed, ref } from 'vue';
import { useI18n } from 'vue-i18n';

import UiButton from '@/components/ui/Button';
import type { InvestBacktestHistoryEntry } from '@/types/invest';

const props = defineProps<{
  strategyName: string;
  entries: InvestBacktestHistoryEntry[];
  loading: boolean;
}>();

const emit = defineEmits<{
  (e: 'back'): void;
  (e: 'open', id: string): void;
  (e: 'delete-batch', ids: string[]): void;
}>();

const { t, locale } = useI18n();

const selectedIds = ref<Set<string>>(new Set());

const allSelected = computed(
  () => props.entries.length > 0 && props.entries.every(e => selectedIds.value.has(e.id))
);
const someSelected = computed(
  () => !allSelected.value && props.entries.some(e => selectedIds.value.has(e.id))
);

function toggleSelect(id: string) {
  const next = new Set(selectedIds.value);
  if (next.has(id)) {
    next.delete(id);
  } else {
    next.add(id);
  }
  selectedIds.value = next;
}

function toggleSelectAll() {
  if (allSelected.value) {
    selectedIds.value = new Set();
  } else {
    selectedIds.value = new Set(props.entries.map(e => e.id));
  }
}

function handleBatchDelete() {
  if (selectedIds.value.size === 0) return;
  const ids = [...selectedIds.value];
  selectedIds.value = new Set();
  emit('delete-batch', ids);
}

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
  flex: 1;
}
.invest-history-sub {
  font-size: 12px;
  color: rgba(255, 255, 255, 0.45);
  max-width: 100%;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}
.invest-history-delete-btn {
  display: flex;
  align-items: center;
  gap: 4px;
  padding: 4px 10px;
  border-radius: 6px;
  border: 1px solid rgba(255, 100, 100, 0.25);
  background: transparent;
  color: rgba(255, 255, 255, 0.35);
  font-size: 12px;
  cursor: not-allowed;
  flex-shrink: 0;
  transition:
    color 0.15s,
    background 0.15s,
    border-color 0.15s;
}
.invest-history-delete-btn .material-symbols-outlined {
  font-size: 15px;
}
.invest-history-delete-btn--active {
  color: rgba(255, 100, 100, 0.85);
  border-color: rgba(255, 100, 100, 0.5);
  cursor: pointer;
}
.invest-history-delete-btn--active:hover {
  background: rgba(255, 100, 100, 0.12);
  border-color: rgba(255, 100, 100, 0.75);
  color: rgba(255, 120, 120, 1);
}
.invest-history-empty {
  margin-top: 16px;
}
.invest-history-rows {
  display: flex;
  flex-direction: column;
  gap: 6px;
  margin-top: 12px;
}
.invest-history-select-all-row {
  display: flex;
  align-items: center;
  padding: 2px 4px;
}
.invest-history-checkbox-wrap {
  display: flex;
  align-items: center;
  gap: 6px;
  cursor: pointer;
  flex-shrink: 0;
}
.invest-history-checkbox {
  width: 15px;
  height: 15px;
  accent-color: rgba(80, 160, 255, 0.9);
  cursor: pointer;
  flex-shrink: 0;
}
.invest-history-select-all-label {
  font-size: 12px;
  color: rgba(255, 255, 255, 0.45);
  user-select: none;
}
.invest-history-row {
  display: flex;
  align-items: center;
  gap: 8px;
  width: 100%;
  padding: 6px 8px 6px 10px;
  border-radius: 8px;
  border: 1px solid rgba(255, 255, 255, 0.08);
  background: rgba(255, 255, 255, 0.03);
  transition:
    background 0.12s,
    border-color 0.12s;
}
.invest-history-row--selected {
  background: rgba(80, 140, 255, 0.08);
  border-color: rgba(80, 140, 255, 0.25);
}
.invest-history-row-content {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  flex: 1;
  min-width: 0;
  text-align: left;
  background: transparent;
  border: none;
  color: inherit;
  cursor: pointer;
  padding: 4px 0;
}
.invest-history-row:hover {
  background: rgba(255, 255, 255, 0.06);
  border-color: rgba(255, 255, 255, 0.12);
}
.invest-history-row--selected:hover {
  background: rgba(80, 140, 255, 0.12);
  border-color: rgba(80, 140, 255, 0.35);
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
