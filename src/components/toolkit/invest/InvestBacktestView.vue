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
              <span class="invest-metric-value">{{ r.purchaseRecords.length }}</span>
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
                  <th>{{ t('invest.colNav') }}</th>
                  <th>{{ t('invest.colAmount') }}</th>
                  <th>{{ t('invest.colShares') }}</th>
                  <th>{{ t('invest.colTotalInvested') }}</th>
                  <th>{{ t('invest.colTotalShares') }}</th>
                </tr>
              </thead>
              <tbody>
                <tr v-for="rec in results[0].purchaseRecords" :key="rec.date + rec.totalInvested">
                  <td>{{ rec.date }}</td>
                  <td>{{ rec.nav.toFixed(4) }}</td>
                  <td>¥{{ rec.amount.toFixed(2) }}</td>
                  <td>{{ rec.shares.toFixed(4) }}</td>
                  <td>¥{{ rec.totalInvested.toFixed(2) }}</td>
                  <td>{{ rec.totalShares.toFixed(4) }}</td>
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
</script>
