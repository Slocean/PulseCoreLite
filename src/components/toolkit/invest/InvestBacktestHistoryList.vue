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
        <!-- Holdings allocation button -->
        <button
          type="button"
          class="invest-history-alloc-btn"
          :title="t('invest.allocationChartTitle')"
          @click.stop="openAllocationChart(e)">
          <span class="material-symbols-outlined">donut_small</span>
        </button>
      </div>
    </div>
  </div>

  <!-- Holdings Allocation Dialog -->
  <UiDialog
    v-model:open="allocDialogOpen"
    :title="allocDialogTitle"
    :show-actions="false"
    close-label="Close">
    <template #body>
      <div class="invest-history-alloc-body">
        <!-- SVG Pie Chart -->
        <svg
          class="invest-history-alloc-pie"
          viewBox="0 0 200 200"
          aria-hidden="true">
          <g v-for="(slice, i) in allocSlices" :key="i">
            <path
              :d="slice.d"
              :fill="slice.color"
              class="invest-history-alloc-slice"
              @mouseenter="allocHover = i"
              @mouseleave="allocHover = null" />
          </g>
          <!-- Center donut hole -->
          <circle cx="100" cy="100" r="48" fill="var(--invest-pie-bg, #1a1c2a)" />
          <!-- Total value label -->
          <text x="100" y="95" text-anchor="middle" class="invest-history-alloc-center-val">
            ¥{{ allocTotalValue.toFixed(0) }}
          </text>
          <text x="100" y="110" text-anchor="middle" class="invest-history-alloc-center-sub">
            {{ t('invest.metricValue') }}
          </text>
        </svg>

        <!-- Legend -->
        <div class="invest-history-alloc-legend">
          <div
            v-for="(slice, i) in allocSlices"
            :key="i"
            class="invest-history-alloc-legend-item"
            :class="{ 'invest-history-alloc-legend-item--hover': allocHover === i }"
            @mouseenter="allocHover = i"
            @mouseleave="allocHover = null">
            <span class="invest-history-alloc-dot" :style="{ background: slice.color }" />
            <div class="invest-history-alloc-info">
              <span class="invest-history-alloc-code">{{ slice.label }}</span>
              <span v-if="slice.sublabel" class="invest-history-alloc-name">{{ slice.sublabel }}</span>
            </div>
            <div class="invest-history-alloc-right">
              <span class="invest-history-alloc-value">¥{{ slice.value.toFixed(2) }}</span>
              <span class="invest-history-alloc-pct">{{ slice.pct }}</span>
            </div>
          </div>
        </div>
      </div>
    </template>
  </UiDialog>
</template>

<script setup lang="ts">
import { computed, ref } from 'vue';
import { useI18n } from 'vue-i18n';

import UiButton from '@/components/ui/Button';
import UiDialog from '@/components/ui/Dialog';
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

// ── Holdings Allocation Chart ───────────────────────────────────────────────

const ALLOC_COLORS = [
  '#4A9EFF', '#50DC8C', '#FFB347', '#FF6B6B',
  '#A78BFA', '#22D3EE', '#FB923C', '#F472B6',
  '#34D399', '#FBBF24'
];

// Distinct colors for principal vs profit segments when single-fund
const COLOR_PRINCIPAL = '#4A9EFF';
const COLOR_PROFIT    = '#50DC8C';
const COLOR_LOSS      = '#FF6B6B';

const allocDialogOpen = ref(false);
const allocSourceEntry = ref<InvestBacktestHistoryEntry | null>(null);
const allocHover = ref<number | null>(null);

interface AllocSlice {
  d: string;
  color: string;
  label: string;
  sublabel?: string;
  value: number;
  pct: string;
}

function polarToXY(cx: number, cy: number, r: number, angleDeg: number): [number, number] {
  const rad = ((angleDeg - 90) * Math.PI) / 180;
  return [cx + r * Math.cos(rad), cy + r * Math.sin(rad)];
}

function buildArcPath(cx: number, cy: number, r: number, startDeg: number, endDeg: number): string {
  // Prevent invisible full-circle arc by clamping to just under 360
  const clampedEnd = endDeg - startDeg >= 360 ? startDeg + 359.999 : endDeg;
  const [x1, y1] = polarToXY(cx, cy, r, startDeg);
  const [x2, y2] = polarToXY(cx, cy, r, clampedEnd);
  const largeArc = clampedEnd - startDeg > 180 ? 1 : 0;
  return `M ${cx} ${cy} L ${x1} ${y1} A ${r} ${r} 0 ${largeArc} 1 ${x2} ${y2} Z`;
}

function buildSlices(segments: { value: number; color: string; label: string; sublabel?: string }[]): AllocSlice[] {
  const total = segments.reduce((s, x) => s + x.value, 0);
  if (total <= 0) return [];
  const slices: AllocSlice[] = [];
  let deg = 0;
  for (const seg of segments) {
    const sweep = (seg.value / total) * 360;
    slices.push({
      d: buildArcPath(100, 100, 90, deg, deg + sweep),
      color: seg.color,
      label: seg.label,
      sublabel: seg.sublabel,
      value: seg.value,
      pct: `${((seg.value / total) * 100).toFixed(1)}%`
    });
    deg += sweep;
  }
  return slices;
}

/**
 * Find all entries from the same backtest run as `entry`.
 * Entries share the same `startDate + endDate` range and come from the same strategy.
 * Duplicate fund codes within the group are de-duplicated by taking the latest entry.
 */
function findRunPeers(entry: InvestBacktestHistoryEntry): InvestBacktestHistoryEntry[] {
  const key = `${entry.result.startDate}|${entry.result.endDate}`;
  const peers = props.entries.filter(
    e => `${e.result.startDate}|${e.result.endDate}` === key
  );
  // De-duplicate by fundCode: keep one entry per fund (latest createdAt)
  const byCode = new Map<string, InvestBacktestHistoryEntry>();
  for (const p of peers) {
    const code = p.result.fundCode;
    const existing = byCode.get(code);
    if (!existing || p.createdAt > existing.createdAt) {
      byCode.set(code, p);
    }
  }
  return [...byCode.values()];
}

const allocSlices = computed<AllocSlice[]>(() => {
  const entry = allocSourceEntry.value;
  if (!entry) return [];

  const peers = findRunPeers(entry);

  if (peers.length >= 2) {
    // Multi-fund run: show each fund's currentValue proportion
    return buildSlices(
      peers.map((p, i) => ({
        value: p.result.currentValue,
        color: ALLOC_COLORS[i % ALLOC_COLORS.length],
        label: p.result.fundCode,
        sublabel: p.result.fundName
      }))
    );
  }

  // Single-fund: show principal vs profit (or loss) breakdown
  const r = entry.result;
  const principal = r.totalInvested;
  const profit = r.profit;

  if (profit >= 0) {
    return buildSlices([
      { value: principal, color: COLOR_PRINCIPAL, label: t('invest.metricInvested'), sublabel: r.fundCode },
      { value: profit,    color: COLOR_PROFIT,    label: t('invest.metricProfit') }
    ]);
  } else {
    // Loss: show currentValue (what's left) vs loss
    const currentVal = Math.max(r.currentValue, 0);
    const lossAbs    = Math.abs(profit);
    return buildSlices([
      { value: currentVal, color: COLOR_PRINCIPAL, label: t('invest.metricValue'),  sublabel: r.fundCode },
      { value: lossAbs,    color: COLOR_LOSS,       label: t('invest.metricProfit') }
    ]);
  }
});

const allocTotalValue = computed(() => {
  const entry = allocSourceEntry.value;
  if (!entry) return 0;
  const peers = findRunPeers(entry);
  if (peers.length >= 2) {
    return peers.reduce((s, p) => s + p.result.currentValue, 0);
  }
  return entry.result.currentValue;
});

const allocDialogTitle = computed(() => {
  const entry = allocSourceEntry.value;
  if (!entry) return t('invest.allocationChartTitle');
  return `${entry.result.startDate} → ${entry.result.endDate} · ${t('invest.allocationChartTitle')}`;
});

function openAllocationChart(entry: InvestBacktestHistoryEntry) {
  allocSourceEntry.value = entry;
  allocHover.value = null;
  allocDialogOpen.value = true;
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

/* ── Holdings allocation button on each row ── */
.invest-history-alloc-btn {
  display: flex;
  align-items: center;
  justify-content: center;
  flex-shrink: 0;
  width: 28px;
  height: 28px;
  border-radius: 6px;
  border: 1px solid rgba(255, 255, 255, 0.1);
  background: transparent;
  color: rgba(255, 255, 255, 0.38);
  cursor: pointer;
  transition:
    color 0.12s,
    background 0.12s,
    border-color 0.12s;
}
.invest-history-alloc-btn .material-symbols-outlined {
  font-size: 16px;
}
.invest-history-alloc-btn:hover {
  color: rgba(80, 160, 255, 0.9);
  background: rgba(80, 160, 255, 0.1);
  border-color: rgba(80, 160, 255, 0.3);
}

/* ── Allocation chart dialog body ── */
.invest-history-alloc-body {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 20px;
  padding: 4px 0 8px;
}

.invest-history-alloc-pie {
  width: 180px;
  height: 180px;
  flex-shrink: 0;
  filter: drop-shadow(0 2px 8px rgba(0, 0, 0, 0.4));
}

.invest-history-alloc-slice {
  cursor: pointer;
  transition: opacity 0.15s;
  opacity: 0.88;
}
.invest-history-alloc-slice:hover {
  opacity: 1;
}

.invest-history-alloc-center-val {
  fill: rgba(255, 255, 255, 0.9);
  font-size: 14px;
  font-weight: 600;
  dominant-baseline: auto;
}
.invest-history-alloc-center-sub {
  fill: rgba(255, 255, 255, 0.38);
  font-size: 9px;
  dominant-baseline: auto;
}

.invest-history-alloc-legend {
  display: flex;
  flex-direction: column;
  gap: 6px;
  width: 100%;
  max-width: 320px;
}

.invest-history-alloc-legend-item {
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 7px 10px;
  border-radius: 7px;
  border: 1px solid rgba(255, 255, 255, 0.06);
  background: rgba(255, 255, 255, 0.03);
  transition:
    background 0.12s,
    border-color 0.12s;
  cursor: default;
}
.invest-history-alloc-legend-item--hover {
  background: rgba(255, 255, 255, 0.07);
  border-color: rgba(255, 255, 255, 0.12);
}

.invest-history-alloc-dot {
  width: 10px;
  height: 10px;
  border-radius: 50%;
  flex-shrink: 0;
}

.invest-history-alloc-info {
  display: flex;
  flex-direction: column;
  gap: 1px;
  flex: 1;
  min-width: 0;
}

.invest-history-alloc-code {
  font-size: 12px;
  font-weight: 600;
  color: rgba(80, 160, 255, 0.9);
}

.invest-history-alloc-name {
  font-size: 10px;
  color: rgba(255, 255, 255, 0.4);
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.invest-history-alloc-right {
  display: flex;
  flex-direction: column;
  align-items: flex-end;
  gap: 1px;
  flex-shrink: 0;
}

.invest-history-alloc-value {
  font-size: 12px;
  color: rgba(80, 220, 140, 0.85);
  font-variant-numeric: tabular-nums;
}

.invest-history-alloc-pct {
  font-size: 11px;
  color: rgba(255, 255, 255, 0.55);
  font-variant-numeric: tabular-nums;
}
</style>
