<template>
  <div class="invest-backtest">
    <div
      class="invest-editor-header"
      :class="{ 'invest-editor-header--bar-title-left': mode === 'compare' }">
      <UiButton native-type="button" preset="toolkit-link" @click="emit('back')">
        <span class="material-symbols-outlined">arrow_back</span>
        <span>{{ t('invest.backToList') }}</span>
      </UiButton>
      <span
        class="invest-editor-title"
        :class="{ 'invest-editor-title--from-left': mode === 'compare' }">
        {{ headerBarTitle }}
      </span>
    </div>

    <div v-if="loading" class="invest-loading">
      <span class="material-symbols-outlined invest-spin">progress_activity</span>
      <span>{{ t('invest.loading') }}</span>
    </div>

    <div v-else-if="error" class="invest-error-box">
      <span class="material-symbols-outlined">error_outline</span>
      <span>{{ error }}</span>
    </div>

    <template v-else-if="results.length > 0">
      <UiCollapsiblePanel
        class="toolkit-card invest-backtest-section"
        :title="summaryHeaderTitle"
        v-model="summaryOpen"
        single-header-preset="toolkit-collapse"
        title-class="toolkit-section-title invest-backtest-header-title"
        indicator-class="toolkit-collapse-indicator"
        @toggle="onPanelToggle">
        <div class="invest-summary-grid">
          <div v-for="r in results" :key="r.strategyId" class="invest-summary-block">
            <template v-if="results.length > 1">
              <div class="invest-summary-name">{{ r.strategyName }}</div>
              <div class="invest-summary-fund">{{ r.fundCode }}<template v-if="r.fundName"> · {{ r.fundName }}</template></div>
            </template>

            <div class="invest-metrics">
              <div class="invest-metric">
                <span class="invest-metric-label">{{ t('invest.metricInvested') }}</span>
                <span class="invest-metric-value">¥{{ r.totalInvested.toFixed(2) }}</span>
              </div>
              <div class="invest-metric">
                <span class="invest-metric-label">{{ t('invest.metricCashIn') }}</span>
                <span class="invest-metric-value">¥{{ totalCashIn(r).toFixed(2) }}</span>
              </div>
              <div v-if="totalCashOut(r) > 0" class="invest-metric">
                <span class="invest-metric-label">{{ t('invest.metricCashOut') }}</span>
                <span class="invest-metric-value invest-profit">¥{{ totalCashOut(r).toFixed(2) }}</span>
              </div>
              <div class="invest-metric">
                <span class="invest-metric-label">{{ t('invest.metricValue') }}</span>
                <span class="invest-metric-value" :class="r.profit >= 0 ? 'invest-profit' : 'invest-loss'">
                  ¥{{ r.currentValue.toFixed(2) }}
                </span>
              </div>
              <div class="invest-metric">
                <span class="invest-metric-label">{{ t('invest.metricProfit') }}</span>
                <span class="invest-metric-value" :class="r.profit >= 0 ? 'invest-profit' : 'invest-loss'">
                  {{ r.profit >= 0 ? '+' : '' }}¥{{ r.profit.toFixed(2) }}
                </span>
              </div>
              <div class="invest-metric">
                <span class="invest-metric-label">{{ t('invest.metricReturn') }}</span>
                <span class="invest-metric-value" :class="r.returnRate >= 0 ? 'invest-profit' : 'invest-loss'">
                  {{ (r.returnRate * 100).toFixed(2) }}%
                </span>
              </div>
              <div class="invest-metric">
                <span class="invest-metric-label">{{ t('invest.metricAnnualized') }}</span>
                <span class="invest-metric-value" :class="r.annualizedReturn >= 0 ? 'invest-profit' : 'invest-loss'">
                  {{ (r.annualizedReturn * 100).toFixed(2) }}%
                </span>
              </div>
              <div class="invest-metric">
                <span class="invest-metric-label">{{ t('invest.metricDays') }}</span>
                <span class="invest-metric-value">{{ r.daysElapsed }}</span>
              </div>
              <div class="invest-metric">
                <span class="invest-metric-label">{{ t('invest.metricPurchases') }}</span>
                <span class="invest-metric-value">{{ buyCount(r) }}</span>
              </div>
              <div v-if="ruleTradeCount(r) > 0" class="invest-metric">
                <span class="invest-metric-label">{{ t('invest.metricRuleTrades') }}</span>
                <span class="invest-metric-value">{{ ruleTradeCount(r) }}</span>
              </div>
              <div class="invest-metric">
                <span class="invest-metric-label">{{ t('invest.metricCurrentNav') }}</span>
                <span class="invest-metric-value">{{ r.currentNav.toFixed(4) }}</span>
              </div>
            </div>
          </div>
        </div>
      </UiCollapsiblePanel>

      <template v-if="isBacktest && results[0]">
        <UiCollapsiblePanel
          class="toolkit-card invest-purchases-panel"
          :title="t('invest.purchaseHistory')"
          v-model="purchasesOpen"
          header-mode="split"
          header-class="toolkit-section-header"
          split-title-preset="toolkit-collapse-title"
          split-toggle-preset="toolkit-collapse-icon"
          title-class="toolkit-section-title"
          indicator-class="toolkit-collapse-indicator"
          @toggle="onPanelToggle">
          <template #header-actions>
            <span class="invest-purchases-hint">{{ t('invest.purchaseRowExpandHint') }}</span>
          </template>
          <div class="invest-vtable">
            <div class="invest-vtable-header invest-vtable-grid invest-vtable-grid--4">
              <div class="invest-vth col-date">{{ t('invest.colDate') }}</div>
              <div class="invest-vth col-tags">{{ t('invest.colAction') }}</div>
              <div class="invest-vth col-nav">{{ t('invest.colNav') }}</div>
              <div class="invest-vth col-amount">{{ t('invest.colAmount') }}</div>
            </div>
            <div ref="purchaseScrollEl" class="invest-table-wrap invest-vtable-body">
              <div
                class="invest-vtable-phantom"
                :style="{
                  height: `${rowVirtualizer.getTotalSize()}px`,
                  position: 'relative',
                  width: '100%'
                }">
                <div
                  v-for="vRow in virtualRows"
                  :key="String(vRow.key)"
                  :data-index="vRow.index"
                  :ref="purchaseRowMeasureRef"
                  class="invest-vtable-virtual-row"
                  :style="{
                    position: 'absolute',
                    top: 0,
                    left: 0,
                    width: '100%',
                    transform: `translateY(${vRow.start}px)`
                  }">
                  <template v-for="rec in tupleRecord(vRow)" :key="rowKey(rec)">
                    <div
                      class="invest-row invest-row--clickable invest-vtable-grid invest-vtable-grid--4 invest-vtable-cells"
                      :class="[
                        rec.action === 'sell' ? 'invest-row--sell' : 'invest-row--buy',
                        expandedRows[rowKey(rec)] ? 'invest-row--expanded' : ''
                      ]"
                      @click="toggleRow(rowKey(rec))">
                      <div class="col-date">{{ rec.date }}</div>
                      <div class="col-tags">
                        <span :class="rec.action === 'buy' ? 'invest-tag--buy' : 'invest-tag--sell'">
                          {{ rec.action === 'buy' ? t('invest.actionBuy') : t('invest.actionSell') }}
                        </span>
                        <span
                          class="invest-trigger-badge"
                          :class="rec.triggerType === 'rule' ? 'invest-trigger-badge--rule' : ''">
                          {{ rec.triggerType === 'rule' ? t('invest.triggerRule') : t('invest.triggerScheduled') }}
                        </span>
                      </div>
                      <div class="col-nav">{{ rec.nav.toFixed(4) }}</div>
                      <div class="col-amount" :class="rec.action === 'buy' ? 'invest-loss' : 'invest-profit'">
                        {{ rec.action === 'buy' ? '-' : '+' }}¥{{ rec.amount.toFixed(2) }}
                      </div>
                    </div>
                    <div v-if="expandedRows[rowKey(rec)]" class="invest-row--detail invest-vtable-detail">
                      <div class="invest-detail-grid">
                        <div class="invest-detail-item">
                          <span class="invest-detail-label">{{ t('invest.colShares') }}</span>
                          <span class="invest-detail-value">{{ rec.shares.toFixed(4) }}</span>
                        </div>
                        <div class="invest-detail-item">
                          <span class="invest-detail-label">{{ t('invest.colTotalShares') }}</span>
                          <span class="invest-detail-value">{{ rec.totalShares.toFixed(4) }}</span>
                        </div>
                        <div class="invest-detail-item">
                          <span class="invest-detail-label">{{ t('invest.colCashIn') }}</span>
                          <span class="invest-detail-value">¥{{ rec.totalCashIn.toFixed(2) }}</span>
                        </div>
                        <div v-if="rec.totalCashOut > 0" class="invest-detail-item">
                          <span class="invest-detail-label">{{ t('invest.colCashOut') }}</span>
                          <span class="invest-detail-value invest-profit">¥{{ rec.totalCashOut.toFixed(2) }}</span>
                        </div>
                      </div>
                    </div>
                  </template>
                </div>
              </div>
            </div>
          </div>
        </UiCollapsiblePanel>
      </template>
    </template>
  </div>
</template>

<script setup lang="ts">
import type { VirtualItem } from '@tanstack/vue-virtual';
import { useVirtualizer } from '@tanstack/vue-virtual';
import { computed, nextTick, ref, watch, type ComponentPublicInstance } from 'vue';
import { useI18n } from 'vue-i18n';

import UiButton from '@/components/ui/Button';
import UiCollapsiblePanel from '@/components/ui/CollapsiblePanel';
import type { BacktestResult, TradeRecord } from '@/types/invest';

const props = defineProps<{
  results: BacktestResult[];
  loading: boolean;
  error: string;
  mode: 'backtest' | 'compare';
}>();

const emit = defineEmits<{
  (e: 'back'): void;
  (e: 'contentChange'): void;
}>();

const { t } = useI18n();

const isBacktest = computed(() => props.mode === 'backtest');

const title = computed(() =>
  props.mode === 'compare' ? t('invest.compareTitle') : t('invest.backtestTitle')
);

/** 顶栏：对比模式为「策略对比 - 基金代码」（多基金时去重后 · 连接） */
const compareFundCodesLabel = computed(() => {
  if (props.mode !== 'compare' || props.results.length === 0) {
    return '';
  }
  const codes = [...new Set(props.results.map(r => r.fundCode).filter(Boolean))];
  return codes.join(' · ');
});

const headerBarTitle = computed(() => {
  if (props.mode === 'compare') {
    const codes = compareFundCodesLabel.value;
    return codes ? `${t('invest.compareTitle')} - ${codes}` : t('invest.compareTitle');
  }
  return t('invest.backtestTitle');
});

/** 单条结果时：与「回测指标 / 策略对比」同一行展示策略名与基金；多条时仅在正文展示 */
const summaryHeaderTitle = computed(() => {
  if (props.results.length !== 1) {
    return props.mode === 'compare' ? t('invest.compareDataPanel') : t('invest.backtestMetricsPanel');
  }
  const r = props.results[0]!;
  const base = props.mode === 'compare' ? t('invest.compareTitle') : t('invest.backtestMetricsPanel');
  const fundLine = r.fundName ? `${r.fundCode} · ${r.fundName}` : r.fundCode;
  return `${base} · ${r.strategyName} · ${fundLine}`;
});

const summaryOpen = ref(true);
const purchasesOpen = ref(true);

function onPanelToggle() {
  emit('contentChange');
}

const expandedRows = ref<Record<string, boolean>>({});

const purchaseScrollEl = ref<HTMLElement | null>(null);

const backtestTradeRecords = computed<TradeRecord[]>(() => {
  if (!isBacktest.value || !props.results[0]?.tradeRecords) {
    return [];
  }
  return props.results[0].tradeRecords;
});

const rowVirtualizer = useVirtualizer(
  computed(() => ({
    count: backtestTradeRecords.value.length,
    getScrollElement: () => purchaseScrollEl.value,
    estimateSize: (index: number) => {
      const rec = backtestTradeRecords.value[index];
      if (!rec) {
        return 40;
      }
      return expandedRows.value[rowKey(rec)] ? 96 : 40;
    },
    overscan: 10,
    getItemKey: (index: number) => {
      const rec = backtestTradeRecords.value[index];
      return rec ? rowKey(rec) : index;
    }
  }))
);

const virtualRows = computed(() => rowVirtualizer.value.getVirtualItems());

function purchaseRowMeasureRef(el: Element | ComponentPublicInstance | null) {
  const node =
    el && typeof el === 'object' && '$el' in el && (el as ComponentPublicInstance).$el instanceof Element
      ? ((el as ComponentPublicInstance).$el as Element)
      : (el as Element | null);
  rowVirtualizer.value.measureElement(node);
}

function tupleRecord(vRow: VirtualItem): TradeRecord[] {
  const r = backtestTradeRecords.value[vRow.index];
  return r ? [r] : [];
}

watch(
  () => props.results[0]?.tradeRecords,
  () => {
    expandedRows.value = {};
    void nextTick(() => {
      purchaseScrollEl.value?.scrollTo(0, 0);
      rowVirtualizer.value.measure();
    });
  }
);

function rowKey(rec: TradeRecord): string {
  return `${rec.date}-${rec.action}-${rec.ruleId ?? 'sched'}`;
}

function toggleRow(key: string) {
  expandedRows.value = {
    ...expandedRows.value,
    [key]: !expandedRows.value[key]
  };
}

function totalCashIn(r: BacktestResult): number {
  if (r.tradeRecords?.length) {
    const last = r.tradeRecords[r.tradeRecords.length - 1];
    return last.totalCashIn;
  }
  return r.totalInvested;
}

function totalCashOut(r: BacktestResult): number {
  if (r.tradeRecords?.length) {
    const last = r.tradeRecords[r.tradeRecords.length - 1];
    return last.totalCashOut;
  }
  return 0;
}

function buyCount(r: BacktestResult): number {
  if (r.tradeRecords?.length) {
    return r.tradeRecords.filter(rec => rec.action === 'buy' && rec.triggerType === 'scheduled').length;
  }
  return r.purchaseRecords.length;
}

function ruleTradeCount(r: BacktestResult): number {
  if (r.tradeRecords?.length) {
    return r.tradeRecords.filter(rec => rec.triggerType === 'rule').length;
  }
  return 0;
}
</script>

<style scoped>
/* ── 行颜色 ── */
.invest-row--buy.invest-vtable-cells > * {
  background: transparent;
}
.invest-row--sell.invest-vtable-cells > * {
  background: rgba(255, 80, 80, 0.04);
}
.invest-row--expanded.invest-vtable-cells > * {
  background: rgba(255, 255, 255, 0.03);
}

/* ── 可点击行 ── */
.invest-row--clickable {
  cursor: pointer;
  transition: background 0.12s;
}
.invest-row--clickable:hover.invest-vtable-cells > * {
  background: rgba(255, 255, 255, 0.04) !important;
}

/* ── 操作标签 ── */
.invest-tag--buy,
.invest-tag--sell {
  display: inline-block;
  padding: 1px 5px;
  border-radius: 4px;
  font-size: 10px;
  margin-right: 4px;
}
.invest-tag--buy {
  background: rgba(80, 220, 140, 0.14);
  color: rgba(80, 220, 140, 0.9);
  border: 1px solid rgba(80, 220, 140, 0.28);
}
.invest-tag--sell {
  background: rgba(255, 80, 80, 0.14);
  color: rgba(255, 80, 80, 0.9);
  border: 1px solid rgba(255, 80, 80, 0.28);
}

/* ── 触发标签 ── */
.invest-trigger-badge {
  display: inline-block;
  padding: 1px 5px;
  border-radius: 4px;
  font-size: 10px;
  background: rgba(255, 255, 255, 0.06);
  color: rgba(255, 255, 255, 0.45);
  border: 1px solid rgba(255, 255, 255, 0.1);
}
.invest-trigger-badge--rule {
  background: rgba(0, 242, 255, 0.08);
  color: rgba(0, 242, 255, 0.7);
  border-color: rgba(0, 242, 255, 0.2);
}

/* ── 展开详情行 ── */
.invest-row--detail {
  padding: 0;
}
.invest-detail-grid {
  display: flex;
  flex-wrap: wrap;
  gap: 4px 12px;
  padding: 6px 8px 8px;
  background: rgba(255, 255, 255, 0.025);
  border-top: 1px solid rgba(255, 255, 255, 0.06);
}
.invest-detail-item {
  display: flex;
  flex-direction: column;
  gap: 1px;
  min-width: 80px;
}
.invest-detail-label {
  font-size: 10px;
  color: rgba(255, 255, 255, 0.38);
}
.invest-detail-value {
  font-size: 11px;
  color: rgba(255, 255, 255, 0.82);
}
</style>
