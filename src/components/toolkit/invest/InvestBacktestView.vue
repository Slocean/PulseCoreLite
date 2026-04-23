<template>
  <div class="invest-backtest">
    <div class="invest-editor-header">
      <UiButton native-type="button" preset="toolkit-link" @click="emit('back')">
        <span class="material-symbols-outlined">arrow_back</span>
        <span>{{ t('invest.backToList') }}</span>
      </UiButton>
      <span class="invest-editor-title">{{ title }}</span>
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
      <div class="invest-summary-grid">
        <div v-for="r in results" :key="r.strategyId" class="invest-summary-card">
          <div class="invest-summary-name">{{ r.strategyName }}</div>
          <div class="invest-summary-fund">{{ r.fundCode }}<template v-if="r.fundName"> · {{ r.fundName }}</template></div>

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

      <template v-if="isBacktest && results[0]">
        <UiCollapsiblePanel
          class="toolkit-card invest-purchases-panel"
          :title="t('invest.purchaseHistory')"
          title-class="toolkit-section-title">
          <div class="invest-table-wrap">
            <table class="invest-table">
              <thead>
                <tr>
                  <th class="col-date">{{ t('invest.colDate') }}</th>
                  <th class="col-tags">{{ t('invest.colAction') }}</th>
                  <th class="col-nav">{{ t('invest.colNav') }}</th>
                  <th class="col-amount">{{ t('invest.colAmount') }}</th>
                  <th class="col-expand"></th>
                </tr>
              </thead>
              <tbody>
                <template v-for="rec in results[0].tradeRecords" :key="rowKey(rec)">
                  <!-- 主行：点击展开/收起 -->
                  <tr
                    class="invest-row invest-row--clickable"
                    :class="[
                      rec.action === 'sell' ? 'invest-row--sell' : 'invest-row--buy',
                      expandedRows[rowKey(rec)] ? 'invest-row--expanded' : ''
                    ]"
                    @click="toggleRow(rowKey(rec))">
                    <td class="col-date">{{ rec.date }}</td>
                    <td class="col-tags">
                      <span :class="rec.action === 'buy' ? 'invest-tag--buy' : 'invest-tag--sell'">
                        {{ rec.action === 'buy' ? t('invest.actionBuy') : t('invest.actionSell') }}
                      </span>
                      <span class="invest-trigger-badge" :class="rec.triggerType === 'rule' ? 'invest-trigger-badge--rule' : ''">
                        {{ rec.triggerType === 'rule' ? t('invest.triggerRule') : t('invest.triggerScheduled') }}
                      </span>
                    </td>
                    <td class="col-nav">{{ rec.nav.toFixed(4) }}</td>
                    <td class="col-amount" :class="rec.action === 'buy' ? 'invest-loss' : 'invest-profit'">
                      {{ rec.action === 'buy' ? '-' : '+' }}¥{{ rec.amount.toFixed(2) }}
                    </td>
                    <td class="col-expand">
                      <span class="material-symbols-outlined invest-expand-icon">
                        {{ expandedRows[rowKey(rec)] ? 'expand_less' : 'expand_more' }}
                      </span>
                    </td>
                  </tr>
                  <!-- 展开详情行 -->
                  <tr v-if="expandedRows[rowKey(rec)]" class="invest-row--detail">
                    <td colspan="5">
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
                    </td>
                  </tr>
                </template>
              </tbody>
            </table>
          </div>
        </UiCollapsiblePanel>
      </template>
    </template>
  </div>
</template>

<script setup lang="ts">
import { computed, ref } from 'vue';
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
}>();

const { t } = useI18n();

const isBacktest = computed(() => props.mode === 'backtest');

const title = computed(() =>
  props.mode === 'compare' ? t('invest.compareTitle') : t('invest.backtestTitle')
);

const expandedRows = ref<Record<string, boolean>>({});

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
.invest-row--buy td { background: transparent; }
.invest-row--sell td { background: rgba(255, 80, 80, 0.04); }
.invest-row--expanded td { background: rgba(255, 255, 255, 0.03); }

/* ── 可点击行 ── */
.invest-row--clickable {
  cursor: pointer;
  transition: background 0.12s;
}
.invest-row--clickable:hover td {
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

/* ── 展开图标 ── */
.invest-expand-icon {
  font-size: 14px;
  color: rgba(255, 255, 255, 0.3);
  line-height: 1;
  vertical-align: middle;
  transition: color 0.12s;
}
.invest-row--clickable:hover .invest-expand-icon {
  color: rgba(255, 255, 255, 0.6);
}

/* ── 展开详情行 ── */
.invest-row--detail td {
  padding: 0 !important;
  border-bottom: 1px solid rgba(255, 255, 255, 0.06);
}
.invest-detail-grid {
  display: flex;
  flex-wrap: wrap;
  gap: 4px 16px;
  padding: 6px 10px 8px;
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
