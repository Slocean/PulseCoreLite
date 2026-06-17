<template>
  <div class="toolkit-card invest-position-section">
    <div class="invest-position-section-title">{{ title }}</div>

    <div class="invest-position-row">
      <label class="invest-position-label" :for="`${mode}-shares`">{{ sharesLabel }}</label>
      <input
        :id="`${mode}-shares`"
        v-model.number="shares"
        type="number"
        min="0"
        step="100"
        class="invest-input invest-input--narrow"
        autocomplete="off"
        @input="emit('contentChange')" />
    </div>

    <div class="invest-position-row">
      <label class="invest-position-label" :for="`${mode}-pnl`">{{ pnlLabel }}</label>
      <div class="invest-position-input-wrap">
        <input
          :id="`${mode}-pnl`"
          v-model.number="pnlPct"
          type="number"
          step="0.01"
          class="invest-input invest-input--narrow"
          autocomplete="off"
          @input="emit('contentChange')" />
        <span class="invest-position-unit">%</span>
      </div>
    </div>

    <div class="invest-position-row">
      <label class="invest-position-label" :for="`${mode}-cost`">{{ costLabel }}</label>
      <div class="invest-position-input-wrap">
        <input
          :id="`${mode}-cost`"
          v-model.number="avgCost"
          type="number"
          min="0"
          step="0.001"
          class="invest-input invest-input--narrow"
          autocomplete="off"
          @input="emit('contentChange')" />
        <span class="invest-position-unit">¥</span>
      </div>
    </div>

    <div class="invest-position-row">
      <label class="invest-position-label" :for="`${mode}-current-price`">{{ currentPriceLabel }}</label>
      <div class="invest-position-input-wrap">
        <input
          :id="`${mode}-current-price`"
          v-model.number="currentPrice"
          type="number"
          min="0"
          step="0.001"
          class="invest-input invest-input--narrow"
          autocomplete="off"
          @input="emit('contentChange')" />
        <span class="invest-position-unit">¥</span>
      </div>
    </div>

    <div class="invest-position-row">
      <label class="invest-position-label" :for="`${mode}-price`">{{ priceLabel }}</label>
      <div class="invest-position-input-wrap">
        <input
          :id="`${mode}-price`"
          v-model.number="tradePrice"
          type="number"
          min="0"
          step="0.001"
          class="invest-input invest-input--narrow"
          autocomplete="off"
          @input="emit('contentChange')" />
        <span class="invest-position-unit">¥</span>
      </div>
    </div>

    <div class="invest-position-row">
      <label class="invest-position-label" :for="`${mode}-trade-shares`">{{ tradeSharesLabel }}</label>
      <input
        :id="`${mode}-trade-shares`"
        v-model.number="tradeShares"
        type="number"
        min="0"
        step="100"
        class="invest-input invest-input--narrow"
        autocomplete="off"
        @input="emit('contentChange')" />
    </div>

    <div class="invest-position-row invest-position-row--actions">
      <UiButton native-type="button" preset="overlay-chip" @click="runCalc">
        {{ calcBtn }}
      </UiButton>
    </div>

    <div v-if="errorMessage" class="invest-position-error">
      <span class="material-symbols-outlined" style="font-size:13px">error</span>
      {{ errorMessage }}
    </div>

    <div v-else-if="result" class="invest-position-result">
      <div class="invest-position-result-head">{{ resultTitle }}</div>
      <div class="invest-position-result-grid">
        <div class="invest-position-result-item invest-position-result-item--primary">
          <span class="invest-position-result-label">{{ newCostLabel }}</span>
          <span class="invest-position-result-value">¥{{ formatPrice(result.newAvgCost) }}</span>
        </div>
        <div class="invest-position-result-item">
          <span class="invest-position-result-label">{{ newSharesLabel }}</span>
          <span class="invest-position-result-value">{{ formatShares(result.newShares) }}</span>
        </div>
        <div class="invest-position-result-item">
          <span class="invest-position-result-label">{{ newPnlLabel }}</span>
          <span
            class="invest-position-result-value"
            :class="result.newPnlPct >= 0 ? 'invest-position-result-value--up' : 'invest-position-result-value--down'">
            {{ formatPnl(result.newPnlPct) }}
          </span>
        </div>
        <div v-if="result.realizedPnl != null && realizedPnlLabel" class="invest-position-result-item">
          <span class="invest-position-result-label">{{ realizedPnlLabel }}</span>
          <span
            class="invest-position-result-value"
            :class="result.realizedPnl >= 0 ? 'invest-position-result-value--up' : 'invest-position-result-value--down'">
            {{ formatMoney(result.realizedPnl) }}
          </span>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref } from 'vue';

import UiButton from '@/components/ui/Button';

import {
  calcAddPosition,
  calcReducePosition,
  type PositionCalcResult
} from '../../../utils/positionCalc';

const props = defineProps<{
  mode: 'add' | 'reduce';
  title: string;
  sharesLabel: string;
  pnlLabel: string;
  costLabel: string;
  currentPriceLabel: string;
  priceLabel: string;
  tradeSharesLabel: string;
  calcBtn: string;
  resultTitle: string;
  newCostLabel: string;
  newSharesLabel: string;
  newPnlLabel: string;
  realizedPnlLabel?: string;
  errorInvalid: string;
  errorReduceShares: string;
}>();

const emit = defineEmits<{
  (event: 'contentChange'): void;
}>();

const shares = ref<number | null>(null);
const pnlPct = ref<number | null>(null);
const avgCost = ref<number | null>(null);
const currentPrice = ref<number | null>(null);
const tradePrice = ref<number | null>(null);
const tradeShares = ref<number | null>(null);

const result = ref<PositionCalcResult | null>(null);
const errorMessage = ref('');

function formatPrice(value: number): string {
  return value.toFixed(3);
}

function formatShares(value: number): string {
  return value.toLocaleString('zh-CN', { maximumFractionDigits: 0 });
}

function formatPnl(value: number): string {
  const sign = value >= 0 ? '+' : '';
  return `${sign}${value.toFixed(2)}%`;
}

function formatMoney(value: number): string {
  const sign = value >= 0 ? '+' : '';
  return `${sign}¥${value.toFixed(2)}`;
}

function runCalc() {
  errorMessage.value = '';
  result.value = null;

  const input = {
    shares: shares.value ?? NaN,
    avgCost: avgCost.value ?? NaN,
    currentPrice: currentPrice.value ?? NaN,
    tradePrice: tradePrice.value ?? NaN,
    tradeShares: tradeShares.value ?? NaN
  };

  if (props.mode === 'reduce' && input.tradeShares >= input.shares) {
    errorMessage.value = props.errorReduceShares;
    return;
  }

  const calcResult =
    props.mode === 'add' ? calcAddPosition(input) : calcReducePosition(input);

  if (!calcResult) {
    errorMessage.value = props.errorInvalid;
    return;
  }

  result.value = calcResult;
  emit('contentChange');
}
</script>

<style scoped>
.invest-position-section {
  display: grid;
  gap: 8px;
  padding: 10px 12px;
}

.invest-position-section-title {
  font-size: 11px;
  font-weight: 600;
  color: rgba(255, 255, 255, 0.55);
  text-transform: uppercase;
  letter-spacing: 0.06em;
  padding-bottom: 4px;
  border-bottom: 1px solid rgba(255, 255, 255, 0.06);
}

.invest-position-row {
  display: flex;
  align-items: center;
  gap: 8px;
  flex-wrap: wrap;
}

.invest-position-row--actions {
  justify-content: flex-end;
}

.invest-position-label {
  font-size: 12px;
  color: rgba(255, 255, 255, 0.55);
  flex-shrink: 0;
  min-width: 72px;
}

.invest-position-input-wrap {
  display: flex;
  align-items: center;
  gap: 4px;
}

.invest-position-unit {
  font-size: 11px;
  color: rgba(255, 255, 255, 0.38);
  flex-shrink: 0;
}

.invest-position-error {
  display: flex;
  align-items: center;
  gap: 5px;
  font-size: 11px;
  color: rgba(255, 120, 100, 0.85);
  padding: 4px 0;
}

.invest-position-result {
  display: grid;
  gap: 8px;
  padding: 8px 0 2px;
}

.invest-position-result-head {
  font-size: 11px;
  font-weight: 600;
  color: rgba(255, 255, 255, 0.45);
}

.invest-position-result-grid {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 8px;
}

.invest-position-result-item {
  display: flex;
  flex-direction: column;
  gap: 2px;
  padding: 8px 10px;
  border-radius: 8px;
  background: rgba(255, 255, 255, 0.03);
  border: 1px solid rgba(255, 255, 255, 0.06);
}

.invest-position-result-item--primary {
  grid-column: 1 / -1;
  background: rgba(80, 160, 255, 0.08);
  border-color: rgba(80, 160, 255, 0.2);
}

.invest-position-result-label {
  font-size: 10px;
  color: rgba(255, 255, 255, 0.42);
}

.invest-position-result-value {
  font-size: 14px;
  font-weight: 700;
  font-variant-numeric: tabular-nums;
  color: rgba(255, 255, 255, 0.9);
}

.invest-position-result-item--primary .invest-position-result-value {
  font-size: 18px;
  color: rgba(80, 160, 255, 0.95);
}

.invest-position-result-value--up {
  color: rgba(80, 220, 140, 0.92);
}

.invest-position-result-value--down {
  color: rgba(255, 120, 120, 0.9);
}
</style>
