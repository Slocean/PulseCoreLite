<template>
  <div class="invest-trading-calc">
    <!-- Header -->
    <div class="invest-editor-header">
      <UiButton native-type="button" preset="toolkit-link" @click="emit('back')">
        <span class="material-symbols-outlined">arrow_back</span>
        <span>{{ t('invest.backToHub') }}</span>
      </UiButton>
      <span class="invest-editor-title">{{ t('invest.tradingDayTitle') }}</span>
    </div>

    <!-- Info note -->
    <div class="invest-trading-note">
      <span class="material-symbols-outlined invest-trading-note-icon">info</span>
      <span>{{ t('invest.tradingDayNote') }}</span>
    </div>

    <!-- Section 1: Single date check -->
    <div class="toolkit-card invest-trading-section">
      <div class="invest-trading-section-title">{{ t('invest.tradingDaySingleTitle') }}</div>
      <div class="invest-trading-row">
        <label class="invest-trading-label">{{ t('invest.tradingDayDate') }}</label>
        <div class="invest-trading-date-wrap">
          <UiDateInput v-model="singleDate" />
        </div>
        <UiButton
          native-type="button"
          preset="overlay-chip"
          :disabled="singleLoading"
          @click="checkSingle">
          <span v-if="singleLoading" class="invest-trading-spinner material-symbols-outlined">autorenew</span>
          <span v-else>{{ t('invest.tradingDayCheckBtn') }}</span>
        </UiButton>
      </div>
      <div v-if="singleError" class="invest-trading-error">
        <span class="material-symbols-outlined" style="font-size:13px">wifi_off</span>
        {{ t('invest.tradingDayNetError') }}
      </div>
      <div v-else-if="singleResult !== null" class="invest-trading-result">
        <span
          class="invest-trading-result-badge"
          :class="singleResult.isTrading
            ? 'invest-trading-result-badge--yes'
            : 'invest-trading-result-badge--no'">
          <span class="material-symbols-outlined">
            {{ singleResult.isTrading ? 'check_circle' : 'cancel' }}
          </span>
          {{ singleResult.isTrading
            ? t('invest.tradingDayIsTrading')
            : t('invest.tradingDayNotTrading') }}
        </span>
        <span class="invest-trading-result-detail">
          {{ singleResult.iso }} &nbsp;·&nbsp; 星期{{ weekdayNames[singleResult.dow] }}
        </span>
      </div>
    </div>

    <!-- Section 2: Range calculation -->
    <div class="toolkit-card invest-trading-section">
      <div class="invest-trading-section-title">{{ t('invest.tradingDayRangeTitle') }}</div>
      <div class="invest-trading-row">
        <label class="invest-trading-label">{{ t('invest.tradingDayStartDate') }}</label>
        <div class="invest-trading-date-wrap">
          <UiDateInput v-model="rangeStart" :max="rangeEnd || undefined" />
        </div>
      </div>
      <div class="invest-trading-row">
        <label class="invest-trading-label">{{ t('invest.tradingDayEndDate') }}</label>
        <div class="invest-trading-date-wrap">
          <UiDateInput v-model="rangeEnd" :min="rangeStart" />
        </div>
      </div>
      <div class="invest-trading-row invest-trading-row--actions">
        <UiButton
          native-type="button"
          preset="overlay-chip"
          :disabled="rangeLoading"
          @click="calcRange">
          <span v-if="rangeLoading" class="invest-trading-spinner material-symbols-outlined">autorenew</span>
          <span v-else>{{ t('invest.tradingDayCalcBtn') }}</span>
        </UiButton>
      </div>
      <div v-if="rangeError" class="invest-trading-error">
        <span class="material-symbols-outlined" style="font-size:13px">wifi_off</span>
        {{ t('invest.tradingDayNetError') }}
      </div>
      <div v-else-if="rangeResult !== null" class="invest-trading-result">
        <span class="invest-trading-result-count">
          {{ t('invest.tradingDayCount', { n: rangeResult.count }) }}
        </span>
        <span class="invest-trading-result-detail">
          {{ rangeResult.startIso }} → {{ rangeResult.endIso }}
          &nbsp;（{{ rangeResult.totalDays }} 日历天）
        </span>
      </div>
    </div>

    <!-- Section 3: Nearest trading day -->
    <div class="toolkit-card invest-trading-section">
      <div class="invest-trading-section-title">{{ t('invest.tradingDayNearestTitle') }}</div>
      <div class="invest-trading-row">
        <label class="invest-trading-label">{{ t('invest.tradingDayDate') }}</label>
        <div class="invest-trading-date-wrap">
          <UiDateInput v-model="nearestDate" />
        </div>
        <UiButton
          native-type="button"
          preset="overlay-chip"
          :disabled="nearestLoading"
          @click="findNearest">
          <span v-if="nearestLoading" class="invest-trading-spinner material-symbols-outlined">autorenew</span>
          <span v-else>{{ t('invest.tradingDayCheckBtn') }}</span>
        </UiButton>
      </div>
      <div v-if="nearestError" class="invest-trading-error">
        <span class="material-symbols-outlined" style="font-size:13px">wifi_off</span>
        {{ t('invest.tradingDayNetError') }}
      </div>
      <div v-else-if="nearestResult !== null" class="invest-trading-nearest">
        <div class="invest-trading-nearest-item">
          <span class="invest-trading-nearest-label">{{ t('invest.tradingDayPrev') }}</span>
          <span class="invest-trading-nearest-value invest-trading-nearest-value--prev">
            {{ nearestResult.prevIso }}
            <span class="invest-trading-nearest-dow">星期{{ weekdayNames[nearestResult.prevDow] }}</span>
          </span>
        </div>
        <div class="invest-trading-nearest-sep">
          <span
            class="invest-trading-nearest-today-badge"
            :class="nearestResult.todayIsTrading
              ? 'invest-trading-result-badge--yes'
              : 'invest-trading-result-badge--no'">
            {{ nearestDate }}
            {{ nearestResult.todayIsTrading ? '✓' : '✗' }}
          </span>
        </div>
        <div class="invest-trading-nearest-item">
          <span class="invest-trading-nearest-label">{{ t('invest.tradingDayNext') }}</span>
          <span class="invest-trading-nearest-value invest-trading-nearest-value--next">
            {{ nearestResult.nextIso }}
            <span class="invest-trading-nearest-dow">星期{{ weekdayNames[nearestResult.nextDow] }}</span>
          </span>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref } from 'vue';
import { useI18n } from 'vue-i18n';

import UiButton from '@/components/ui/Button';
import UiDateInput from '@/components/ui/DateInput';
import {
  isTradingDay,
  countTradingDays,
  findNearbyTradingDays,
  WEEKDAY_ZH
} from '@/utils/tradingCalendar';

const emit = defineEmits<{
  (e: 'back'): void;
}>();

const { t } = useI18n();

const weekdayNames = WEEKDAY_ZH;
const today = new Date().toISOString().slice(0, 10);

// ── Section 1: Single date check ─────────────────────────────────────────────

const singleDate = ref(today);
const singleLoading = ref(false);
const singleError = ref(false);

interface SingleResult { isTrading: boolean; iso: string; dow: number }
const singleResult = ref<SingleResult | null>(null);

async function checkSingle() {
  if (!singleDate.value || singleLoading.value) return;
  singleLoading.value = true;
  singleError.value = false;
  singleResult.value = null;
  try {
    const info = await isTradingDay(singleDate.value);
    const [y, m, d] = singleDate.value.split('-').map(Number);
    singleResult.value = {
      isTrading: info.isTrading,
      iso: singleDate.value,
      dow: new Date(y, m - 1, d).getDay()
    };
  } catch {
    singleError.value = true;
  } finally {
    singleLoading.value = false;
  }
}

// ── Section 2: Range calculation ─────────────────────────────────────────────

const rangeStart = ref('');
const rangeEnd = ref('');
const rangeLoading = ref(false);
const rangeError = ref(false);

interface RangeResult { count: number; totalDays: number; startIso: string; endIso: string }
const rangeResult = ref<RangeResult | null>(null);

async function calcRange() {
  if (!rangeStart.value || !rangeEnd.value || rangeLoading.value) return;
  if (rangeStart.value > rangeEnd.value) return;
  rangeLoading.value = true;
  rangeError.value = false;
  rangeResult.value = null;
  try {
    const { count, totalDays } = await countTradingDays(rangeStart.value, rangeEnd.value);
    rangeResult.value = {
      count,
      totalDays,
      startIso: rangeStart.value,
      endIso: rangeEnd.value
    };
  } catch {
    rangeError.value = true;
  } finally {
    rangeLoading.value = false;
  }
}

// ── Section 3: Nearest trading day ───────────────────────────────────────────

const nearestDate = ref(today);
const nearestLoading = ref(false);
const nearestError = ref(false);

const nearestResult = ref<Awaited<ReturnType<typeof findNearbyTradingDays>> | null>(null);

async function findNearest() {
  if (!nearestDate.value || nearestLoading.value) return;
  nearestLoading.value = true;
  nearestError.value = false;
  nearestResult.value = null;
  try {
    nearestResult.value = await findNearbyTradingDays(nearestDate.value);
  } catch {
    nearestError.value = true;
  } finally {
    nearestLoading.value = false;
  }
}
</script>

<style scoped>
.invest-trading-calc {
  display: grid;
  gap: 8px;
}

.invest-trading-note {
  display: flex;
  align-items: flex-start;
  gap: 6px;
  padding: 8px 10px;
  border-radius: 7px;
  background: rgba(80, 160, 255, 0.06);
  border: 1px solid rgba(80, 160, 255, 0.16);
  color: rgba(120, 180, 255, 0.8);
  font-size: 11px;
  line-height: 1.5;
}
.invest-trading-note-icon {
  font-size: 14px;
  flex-shrink: 0;
  margin-top: 1px;
}

.invest-trading-section {
  display: grid;
  gap: 8px;
  padding: 10px 12px;
}

.invest-trading-section-title {
  font-size: 11px;
  font-weight: 600;
  color: rgba(255, 255, 255, 0.55);
  text-transform: uppercase;
  letter-spacing: 0.06em;
  padding-bottom: 4px;
  border-bottom: 1px solid rgba(255, 255, 255, 0.06);
}

.invest-trading-row {
  display: flex;
  align-items: center;
  gap: 8px;
  flex-wrap: wrap;
}

.invest-trading-row--actions {
  justify-content: flex-end;
}

.invest-trading-label {
  font-size: 12px;
  color: rgba(255, 255, 255, 0.55);
  flex-shrink: 0;
  min-width: 52px;
}

.invest-trading-date-wrap {
  flex: 1;
  min-width: 0;
  max-width: 200px;
}

/* Loading spinner */
.invest-trading-spinner {
  font-size: 15px;
  animation: invest-spin 0.8s linear infinite;
}
@keyframes invest-spin {
  to { transform: rotate(360deg); }
}

/* Error */
.invest-trading-error {
  display: flex;
  align-items: center;
  gap: 5px;
  font-size: 11px;
  color: rgba(255, 120, 100, 0.85);
  padding: 4px 0;
}

/* Result area */
.invest-trading-result {
  display: flex;
  align-items: center;
  gap: 10px;
  flex-wrap: wrap;
  padding: 6px 0 2px;
}

.invest-trading-result-badge {
  display: inline-flex;
  align-items: center;
  gap: 4px;
  padding: 3px 9px;
  border-radius: 6px;
  font-size: 12px;
  font-weight: 600;
}
.invest-trading-result-badge .material-symbols-outlined {
  font-size: 14px;
}
.invest-trading-result-badge--yes {
  background: rgba(80, 220, 140, 0.12);
  color: rgba(80, 220, 140, 0.92);
  border: 1px solid rgba(80, 220, 140, 0.25);
}
.invest-trading-result-badge--no {
  background: rgba(255, 120, 120, 0.1);
  color: rgba(255, 120, 120, 0.9);
  border: 1px solid rgba(255, 120, 120, 0.22);
}

.invest-trading-result-count {
  font-size: 14px;
  font-weight: 700;
  color: rgba(80, 160, 255, 0.92);
  font-variant-numeric: tabular-nums;
}

.invest-trading-result-detail {
  font-size: 11px;
  color: rgba(255, 255, 255, 0.42);
}

/* Nearest trading day */
.invest-trading-nearest {
  display: flex;
  align-items: center;
  gap: 6px;
  padding: 6px 0 2px;
  flex-wrap: wrap;
}

.invest-trading-nearest-item {
  display: flex;
  flex-direction: column;
  gap: 2px;
  flex: 1;
  min-width: 100px;
}

.invest-trading-nearest-label {
  font-size: 10px;
  color: rgba(255, 255, 255, 0.4);
  text-transform: uppercase;
  letter-spacing: 0.04em;
}

.invest-trading-nearest-value {
  font-size: 13px;
  font-weight: 600;
  font-variant-numeric: tabular-nums;
  display: flex;
  flex-direction: column;
  gap: 1px;
}
.invest-trading-nearest-value--prev {
  color: rgba(80, 160, 255, 0.88);
}
.invest-trading-nearest-value--next {
  color: rgba(80, 220, 140, 0.88);
}

.invest-trading-nearest-dow {
  font-size: 10px;
  font-weight: 400;
  color: rgba(255, 255, 255, 0.4);
}

.invest-trading-nearest-sep {
  display: flex;
  justify-content: center;
  align-items: center;
  padding: 0 4px;
}

.invest-trading-nearest-today-badge {
  display: inline-flex;
  align-items: center;
  gap: 3px;
  padding: 2px 8px;
  border-radius: 6px;
  font-size: 11px;
  font-weight: 600;
  white-space: nowrap;
}
</style>
