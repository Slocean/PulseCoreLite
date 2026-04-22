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
                  <th>{{ t('invest.colDate') }}</th>
                  <th>{{ t('invest.colAction') }}</th>
                  <th>{{ t('invest.colTrigger') }}</th>
                  <th>{{ t('invest.colNav') }}</th>
                  <th>{{ t('invest.colAmount') }}</th>
                  <th>{{ t('invest.colShares') }}</th>
                  <th>{{ t('invest.colTotalShares') }}</th>
                  <th>{{ t('invest.colCashIn') }}</th>
                  <th>{{ t('invest.colCashOut') }}</th>
                </tr>
              </thead>
              <tbody>
                <tr
                  v-for="rec in results[0].tradeRecords"
                  :key="rec.date + rec.action + (rec.ruleId ?? 'sched')"
                  :class="rec.action === 'sell' ? 'invest-row--sell' : 'invest-row--buy'">
                  <td>{{ rec.date }}</td>
                  <td>
                    <span :class="rec.action === 'buy' ? 'invest-tag--buy' : 'invest-tag--sell'">
                      {{ rec.action === 'buy' ? t('invest.actionBuy') : t('invest.actionSell') }}
                    </span>
                  </td>
                  <td>
                    <span class="invest-trigger-badge" :class="rec.triggerType === 'rule' ? 'invest-trigger-badge--rule' : ''">
                      {{ rec.triggerType === 'rule' ? t('invest.triggerRule') : t('invest.triggerScheduled') }}
                    </span>
                  </td>
                  <td>{{ rec.nav.toFixed(4) }}</td>
                  <td :class="rec.action === 'buy' ? '' : 'invest-profit'">
                    {{ rec.action === 'buy' ? '-' : '+' }}¥{{ rec.amount.toFixed(2) }}
                  </td>
                  <td>{{ rec.shares.toFixed(4) }}</td>
                  <td>{{ rec.totalShares.toFixed(4) }}</td>
                  <td>¥{{ rec.totalCashIn.toFixed(2) }}</td>
                  <td>{{ rec.totalCashOut > 0 ? '¥' + rec.totalCashOut.toFixed(2) : '—' }}</td>
                </tr>
              </tbody>
            </table>
          </div>
        </UiCollapsiblePanel>
      </template>
    </template>
  </div>
</template>

<script setup lang="ts">
import { computed } from 'vue';
import { useI18n } from 'vue-i18n';

import UiButton from '@/components/ui/Button';
import UiCollapsiblePanel from '@/components/ui/CollapsiblePanel';
import type { BacktestResult } from '@/types/invest';

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
    return r.tradeRecords.filter(t => t.action === 'buy' && t.triggerType === 'scheduled').length;
  }
  return r.purchaseRecords.length;
}

function ruleTradeCount(r: BacktestResult): number {
  if (r.tradeRecords?.length) {
    return r.tradeRecords.filter(t => t.triggerType === 'rule').length;
  }
  return 0;
}
</script>

<style scoped>
.invest-row--buy td {
  background: transparent;
}

.invest-row--sell td {
  background: rgba(255, 80, 80, 0.04);
}

.invest-tag--buy {
  display: inline-block;
  padding: 1px 6px;
  border-radius: 4px;
  font-size: 10px;
  background: rgba(80, 220, 140, 0.14);
  color: rgba(80, 220, 140, 0.9);
  border: 1px solid rgba(80, 220, 140, 0.28);
}

.invest-tag--sell {
  display: inline-block;
  padding: 1px 6px;
  border-radius: 4px;
  font-size: 10px;
  background: rgba(255, 80, 80, 0.14);
  color: rgba(255, 80, 80, 0.9);
  border: 1px solid rgba(255, 80, 80, 0.28);
}

.invest-trigger-badge {
  display: inline-block;
  padding: 1px 6px;
  border-radius: 4px;
  font-size: 10px;
  background: rgba(255, 255, 255, 0.06);
  color: rgba(255, 255, 255, 0.5);
  border: 1px solid rgba(255, 255, 255, 0.1);
}

.invest-trigger-badge--rule {
  background: rgba(0, 242, 255, 0.08);
  color: rgba(0, 242, 255, 0.7);
  border-color: rgba(0, 242, 255, 0.2);
}
</style>
