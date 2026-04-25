<template>
  <div class="invest-list">
    <div class="invest-list-header">
      <span class="invest-list-title">{{ t('invest.strategiesTitle') }}</span>
      <div class="invest-list-actions">
        <UiButton
          v-if="selectedForCompare.size >= 2"
          native-type="button"
          preset="overlay-chip"
          @click="emit('startCompare')">
          <span class="material-symbols-outlined">compare_arrows</span>
          <span>{{ t('invest.compareBtn') }}({{ selectedForCompare.size }})</span>
        </UiButton>
        <UiButton native-type="button" preset="overlay-chip" @click="emit('compareHistory')">
          <span class="material-symbols-outlined">history</span>
          <span>{{ t('invest.compareHistoryBtn') }}</span>
        </UiButton>
        <UiButton native-type="button" preset="overlay-primary" @click="emit('create')">
          <span class="material-symbols-outlined">add</span>
          <span>{{ t('invest.createBtn') }}</span>
        </UiButton>
      </div>
    </div>

    <div v-if="strategies.length === 0" class="invest-empty">
      <span class="material-symbols-outlined invest-empty-icon">savings</span>
      <p>{{ t('invest.emptyHint') }}</p>
    </div>

    <div v-else class="invest-strategy-cards">
      <UiCollapsiblePanel
        v-for="s in strategies"
        :key="s.id"
        class="toolkit-card invest-strategy-card"
        :class="{ 'is-selected': selectedForCompare.has(s.id) }"
        :title="s.name"
        :model-value="isCardOpen(s.id)"
        header-mode="split"
        header-class="toolkit-section-header"
        split-title-preset="toolkit-collapse-title"
        split-toggle-preset="toolkit-collapse-icon"
        title-class="invest-card-title"
        indicator-class="toolkit-collapse-indicator"
        @toggle="onCardToggle(s.id, $event)">

        <template #header-actions>
          <div class="invest-card-header-actions">
            <label class="invest-compare-checkbox" @click.stop>
              <input
                type="checkbox"
                :checked="selectedForCompare.has(s.id)"
                @change="emit('toggleCompare', s.id)" />
            </label>
            <span class="invest-tag">{{ formatFrequency(s.frequency) }}</span>
            <span class="invest-tag invest-tag--fund-count">
              {{ t('invest.fundCount', { n: s.funds.length }) }}
            </span>
          </div>
        </template>

        <div class="invest-card-body">
          <div class="invest-card-meta">
            <div class="invest-strategy-funds">
              <span
                v-for="fund in s.funds"
                :key="fund.id"
                class="invest-strategy-fund-tag">
                <span class="invest-strategy-fund-code">{{ fund.fundCode }}</span>
                <span v-if="fund.fundName" class="invest-strategy-fund-name"> {{ fund.fundName }}</span>
                <span class="invest-strategy-fund-amount">¥{{ fund.amount.toLocaleString() }}</span>
              </span>
            </div>
            <span class="invest-strategy-date">{{ s.startDate }} → {{ s.endDate || t('invest.today') }}</span>
          </div>
          <div class="invest-card-actions">
            <UiButton native-type="button" preset="overlay-chip" @click="openAllocationChart(s)">
              <span class="material-symbols-outlined">donut_small</span>
              <span>{{ t('invest.allocationChartBtn') }}</span>
            </UiButton>
            <UiButton native-type="button" preset="overlay-chip" @click="emit('backtestRecords', s.id)">
              <span class="material-symbols-outlined">history</span>
              <span>{{ t('invest.backtestRecordsBtn') }}</span>
            </UiButton>
            <UiButton native-type="button" preset="overlay-chip" @click="emit('backtest', s.id)">
              <span class="material-symbols-outlined">analytics</span>
              <span>{{ t('invest.backtestBtn') }}</span>
            </UiButton>
            <UiButton native-type="button" preset="overlay-chip" @click="emit('edit', s.id)">
              <span class="material-symbols-outlined">edit</span>
            </UiButton>
            <UiButton native-type="button" preset="overlay-action-danger" @click="emit('delete', s.id)">
              <span class="material-symbols-outlined">delete</span>
            </UiButton>
          </div>
        </div>
      </UiCollapsiblePanel>
    </div>
  </div>

  <!-- Fund Allocation Pie Chart Dialog -->
  <UiDialog
    v-model:open="allocationDialogOpen"
    :title="allocationStrategy ? `${allocationStrategy.name} · ${t('invest.allocationChartTitle')}` : t('invest.allocationChartTitle')"
    :show-actions="false"
    close-label="Close">
    <template #body>
      <div v-if="allocationStrategy" class="invest-allocation-body">
        <div v-if="allocationStrategy.funds.length === 0" class="invest-allocation-empty">
          {{ t('invest.emptyHint') }}
        </div>
        <template v-else>
          <!-- SVG Pie Chart -->
          <svg
            class="invest-allocation-pie"
            viewBox="0 0 200 200"
            aria-hidden="true">
            <g v-for="(slice, i) in allocationSlices" :key="i">
              <path
                :d="slice.d"
                :fill="slice.color"
                class="invest-allocation-slice"
                @mouseenter="hoveredSlice = i"
                @mouseleave="hoveredSlice = null" />
            </g>
            <!-- Center hole (donut) -->
            <circle cx="100" cy="100" r="48" fill="var(--invest-pie-bg, #1a1c2a)" />
            <!-- Center label -->
            <text x="100" y="96" text-anchor="middle" class="invest-allocation-center-label">
              {{ allocationStrategy.funds.length }}
            </text>
            <text x="100" y="110" text-anchor="middle" class="invest-allocation-center-sub">
              {{ t('invest.fundCount', { n: allocationStrategy.funds.length }) }}
            </text>
          </svg>

          <!-- Legend -->
          <div class="invest-allocation-legend">
            <div
              v-for="(slice, i) in allocationSlices"
              :key="i"
              class="invest-allocation-legend-item"
              :class="{ 'invest-allocation-legend-item--hover': hoveredSlice === i }"
              @mouseenter="hoveredSlice = i"
              @mouseleave="hoveredSlice = null">
              <span class="invest-allocation-legend-dot" :style="{ background: slice.color }" />
              <div class="invest-allocation-legend-info">
                <span class="invest-allocation-legend-code">{{ slice.fundCode }}</span>
                <span v-if="slice.fundName" class="invest-allocation-legend-name">{{ slice.fundName }}</span>
              </div>
              <div class="invest-allocation-legend-right">
                <span class="invest-allocation-legend-amount">¥{{ slice.amount.toLocaleString() }}</span>
                <span class="invest-allocation-legend-pct">{{ slice.pct }}</span>
              </div>
            </div>
          </div>
        </template>
      </div>
    </template>
  </UiDialog>
</template>

<script setup lang="ts">
import { computed, ref } from 'vue';
import { useI18n } from 'vue-i18n';

import UiButton from '@/components/ui/Button';
import UiCollapsiblePanel from '@/components/ui/CollapsiblePanel';
import UiDialog from '@/components/ui/Dialog';
import type { InvestFrequency, InvestStrategy } from '@/types/invest';

defineProps<{
  strategies: InvestStrategy[];
  selectedForCompare: Set<string>;
}>();

const emit = defineEmits<{
  (e: 'create'): void;
  (e: 'edit', id: string): void;
  (e: 'delete', id: string): void;
  (e: 'backtest', id: string): void;
  (e: 'backtestRecords', id: string): void;
  (e: 'toggleCompare', id: string): void;
  (e: 'startCompare'): void;
  (e: 'compareHistory'): void;
}>();

const { t } = useI18n();

/** Set of card IDs that are collapsed; all others are open by default */
const collapsedCards = ref(new Set<string>());

function isCardOpen(id: string): boolean {
  return !collapsedCards.value.has(id);
}

function onCardToggle(id: string, nowOpen: boolean): void {
  if (nowOpen) {
    collapsedCards.value.delete(id);
  } else {
    collapsedCards.value.add(id);
  }
}

function formatFrequency(freq: InvestFrequency): string {
  const map: Record<InvestFrequency, string> = {
    daily: t('invest.freqDaily'),
    weekly: t('invest.freqWeekly'),
    monthly: t('invest.freqMonthly')
  };
  return map[freq];
}

// ── Allocation Pie Chart ────────────────────────────────────────────────────

const SLICE_COLORS = [
  '#4A9EFF', '#50DC8C', '#FFB347', '#FF6B6B',
  '#A78BFA', '#22D3EE', '#FB923C', '#F472B6',
  '#34D399', '#FBBF24'
];

const allocationDialogOpen = ref(false);
const allocationStrategy = ref<InvestStrategy | null>(null);
const hoveredSlice = ref<number | null>(null);

function openAllocationChart(s: InvestStrategy) {
  allocationStrategy.value = s;
  hoveredSlice.value = null;
  allocationDialogOpen.value = true;
}

interface PieSlice {
  d: string;
  color: string;
  fundCode: string;
  fundName?: string;
  amount: number;
  pct: string;
}

function polarToXY(cx: number, cy: number, r: number, angleDeg: number): [number, number] {
  const rad = ((angleDeg - 90) * Math.PI) / 180;
  return [cx + r * Math.cos(rad), cy + r * Math.sin(rad)];
}

function buildSlicePath(cx: number, cy: number, r: number, startDeg: number, endDeg: number): string {
  const [x1, y1] = polarToXY(cx, cy, r, startDeg);
  const [x2, y2] = polarToXY(cx, cy, r, endDeg);
  const largeArc = endDeg - startDeg > 180 ? 1 : 0;
  return `M ${cx} ${cy} L ${x1} ${y1} A ${r} ${r} 0 ${largeArc} 1 ${x2} ${y2} Z`;
}

const allocationSlices = computed<PieSlice[]>(() => {
  const s = allocationStrategy.value;
  if (!s || s.funds.length === 0) return [];

  const total = s.funds.reduce((sum, f) => sum + f.amount, 0);
  if (total === 0) return [];

  const slices: PieSlice[] = [];
  let currentDeg = 0;

  for (let i = 0; i < s.funds.length; i++) {
    const fund = s.funds[i];
    const ratio = fund.amount / total;
    const sweepDeg = ratio * 360;
    const endDeg = currentDeg + sweepDeg;

    slices.push({
      d: buildSlicePath(100, 100, 90, currentDeg, endDeg),
      color: SLICE_COLORS[i % SLICE_COLORS.length],
      fundCode: fund.fundCode,
      fundName: fund.fundName,
      amount: fund.amount,
      pct: `${(ratio * 100).toFixed(1)}%`
    });

    currentDeg = endDeg;
  }

  return slices;
});
</script>

<style scoped>
.invest-tag--fund-count {
  background: rgba(80, 140, 255, 0.1);
  border: 1px solid rgba(80, 140, 255, 0.25);
  color: rgba(160, 190, 255, 0.85);
}

.invest-strategy-funds {
  display: flex;
  flex-wrap: wrap;
  gap: 4px;
}

.invest-strategy-fund-tag {
  display: inline-flex;
  align-items: center;
  gap: 4px;
  padding: 2px 8px;
  border-radius: 5px;
  background: rgba(255, 255, 255, 0.04);
  border: 1px solid rgba(255, 255, 255, 0.09);
  font-size: 11px;
}

.invest-strategy-fund-code {
  color: rgba(80, 160, 255, 0.85);
  font-weight: 500;
}

.invest-strategy-fund-name {
  color: rgba(255, 255, 255, 0.5);
  max-width: 100px;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.invest-strategy-fund-amount {
  color: rgba(80, 220, 140, 0.8);
  font-size: 10px;
  font-variant-numeric: tabular-nums;
}

/* ── Allocation Pie Chart ── */
.invest-allocation-body {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 20px;
  padding: 4px 0 8px;
}

.invest-allocation-empty {
  color: rgba(255, 255, 255, 0.4);
  font-size: 13px;
  padding: 20px 0;
}

.invest-allocation-pie {
  width: 180px;
  height: 180px;
  flex-shrink: 0;
  filter: drop-shadow(0 2px 8px rgba(0, 0, 0, 0.4));
}

.invest-allocation-slice {
  cursor: pointer;
  transition: opacity 0.15s;
  opacity: 0.88;
}

.invest-allocation-slice:hover {
  opacity: 1;
}

.invest-allocation-center-label {
  fill: rgba(255, 255, 255, 0.92);
  font-size: 20px;
  font-weight: 600;
  dominant-baseline: auto;
}

.invest-allocation-center-sub {
  fill: rgba(255, 255, 255, 0.38);
  font-size: 9px;
  dominant-baseline: auto;
}

.invest-allocation-legend {
  display: flex;
  flex-direction: column;
  gap: 6px;
  width: 100%;
  max-width: 320px;
}

.invest-allocation-legend-item {
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

.invest-allocation-legend-item--hover {
  background: rgba(255, 255, 255, 0.07);
  border-color: rgba(255, 255, 255, 0.12);
}

.invest-allocation-legend-dot {
  width: 10px;
  height: 10px;
  border-radius: 50%;
  flex-shrink: 0;
}

.invest-allocation-legend-info {
  display: flex;
  flex-direction: column;
  gap: 1px;
  flex: 1;
  min-width: 0;
}

.invest-allocation-legend-code {
  font-size: 12px;
  font-weight: 600;
  color: rgba(80, 160, 255, 0.9);
}

.invest-allocation-legend-name {
  font-size: 10px;
  color: rgba(255, 255, 255, 0.4);
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.invest-allocation-legend-right {
  display: flex;
  flex-direction: column;
  align-items: flex-end;
  gap: 1px;
  flex-shrink: 0;
}

.invest-allocation-legend-amount {
  font-size: 12px;
  color: rgba(80, 220, 140, 0.85);
  font-variant-numeric: tabular-nums;
}

.invest-allocation-legend-pct {
  font-size: 11px;
  color: rgba(255, 255, 255, 0.55);
  font-variant-numeric: tabular-nums;
}
</style>
