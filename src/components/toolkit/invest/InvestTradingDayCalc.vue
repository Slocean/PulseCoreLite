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

    <!-- Note -->
    <div class="invest-trading-note">
      <span class="material-symbols-outlined invest-trading-note-icon">info</span>
      <span>{{ t('invest.tradingDayNote') }}</span>
    </div>

    <!-- Section 1: Single date check -->
    <div class="toolkit-card invest-trading-section">
      <div class="invest-trading-section-title">{{ t('invest.tradingDaySingleTitle') }}</div>
      <div class="invest-trading-row">
        <label class="invest-trading-label">{{ t('invest.tradingDayDate') }}</label>
        <input
          v-model="singleDate"
          type="date"
          class="invest-input invest-input--date"
          :max="maxDate" />
        <UiButton native-type="button" preset="overlay-chip" @click="checkSingle">
          {{ t('invest.tradingDayCheckBtn') }}
        </UiButton>
      </div>
      <div v-if="singleResult !== null" class="invest-trading-result">
        <span
          class="invest-trading-result-badge"
          :class="singleResult.isTrading ? 'invest-trading-result-badge--yes' : 'invest-trading-result-badge--no'">
          <span class="material-symbols-outlined">{{ singleResult.isTrading ? 'check_circle' : 'cancel' }}</span>
          {{ singleResult.isTrading ? t('invest.tradingDayIsTrading') : t('invest.tradingDayNotTrading') }}
        </span>
        <span class="invest-trading-result-detail">
          {{ singleResult.dateLabel }} &nbsp;·&nbsp; 星期{{ weekdayNames[singleResult.weekday] }}
        </span>
      </div>
    </div>

    <!-- Section 2: Range calculation -->
    <div class="toolkit-card invest-trading-section">
      <div class="invest-trading-section-title">{{ t('invest.tradingDayRangeTitle') }}</div>
      <div class="invest-trading-row">
        <label class="invest-trading-label">{{ t('invest.tradingDayStartDate') }}</label>
        <input
          v-model="rangeStart"
          type="date"
          class="invest-input invest-input--date"
          :max="rangeEnd || maxDate" />
      </div>
      <div class="invest-trading-row">
        <label class="invest-trading-label">{{ t('invest.tradingDayEndDate') }}</label>
        <input
          v-model="rangeEnd"
          type="date"
          class="invest-input invest-input--date"
          :min="rangeStart"
          :max="maxDate" />
      </div>
      <div class="invest-trading-row invest-trading-row--actions">
        <UiButton native-type="button" preset="overlay-chip" @click="calcRange">
          {{ t('invest.tradingDayCalcBtn') }}
        </UiButton>
      </div>
      <div v-if="rangeResult !== null" class="invest-trading-result">
        <span class="invest-trading-result-count">
          {{ t('invest.tradingDayCount', { n: rangeResult.count }) }}
        </span>
        <span class="invest-trading-result-detail">
          {{ rangeResult.startLabel }} → {{ rangeResult.endLabel }}
          &nbsp;（{{ rangeResult.totalDays }} 日历天）
        </span>
      </div>
    </div>

    <!-- Section 3: Nearest trading day -->
    <div class="toolkit-card invest-trading-section">
      <div class="invest-trading-section-title">{{ t('invest.tradingDayNearestTitle') }}</div>
      <div class="invest-trading-row">
        <label class="invest-trading-label">{{ t('invest.tradingDayDate') }}</label>
        <input
          v-model="nearestDate"
          type="date"
          class="invest-input invest-input--date"
          :max="maxDate" />
        <UiButton native-type="button" preset="overlay-chip" @click="findNearest">
          {{ t('invest.tradingDayCheckBtn') }}
        </UiButton>
      </div>
      <div v-if="nearestResult !== null" class="invest-trading-nearest">
        <div class="invest-trading-nearest-item">
          <span class="invest-trading-nearest-label">{{ t('invest.tradingDayPrev') }}</span>
          <span class="invest-trading-nearest-value invest-trading-nearest-value--prev">
            {{ nearestResult.prev }}
            <span class="invest-trading-nearest-dow">星期{{ weekdayNames[nearestResult.prevDow] }}</span>
          </span>
        </div>
        <div class="invest-trading-nearest-sep">
          <span
            class="invest-trading-nearest-today-badge"
            :class="nearestResult.todayIsTrading
              ? 'invest-trading-result-badge--yes'
              : 'invest-trading-result-badge--no'">
            {{ nearestResult.todayLabel }}
            {{ nearestResult.todayIsTrading ? '✓' : '✗' }}
          </span>
        </div>
        <div class="invest-trading-nearest-item">
          <span class="invest-trading-nearest-label">{{ t('invest.tradingDayNext') }}</span>
          <span class="invest-trading-nearest-value invest-trading-nearest-value--next">
            {{ nearestResult.next }}
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

const emit = defineEmits<{
  (e: 'back'): void;
}>();

const { t } = useI18n();

// Chinese weekday names (Sun=0 ... Sat=6)
const weekdayNames = ['日', '一', '二', '三', '四', '五', '六'];

const maxDate = new Date().toISOString().slice(0, 10);

// ── Section 1: Single date ────────────────────────────────────────────────

const singleDate = ref(maxDate);

interface SingleResult {
  isTrading: boolean;
  weekday: number;
  dateLabel: string;
}
const singleResult = ref<SingleResult | null>(null);

function isWeekday(d: Date): boolean {
  const day = d.getDay();
  return day !== 0 && day !== 6;
}

function parseDateLocal(str: string): Date {
  const [y, m, d] = str.split('-').map(Number);
  return new Date(y, m - 1, d);
}

function formatDateLabel(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

function checkSingle() {
  if (!singleDate.value) return;
  const d = parseDateLocal(singleDate.value);
  singleResult.value = {
    isTrading: isWeekday(d),
    weekday: d.getDay(),
    dateLabel: formatDateLabel(d)
  };
}

// ── Section 2: Range ──────────────────────────────────────────────────────

const rangeStart = ref('');
const rangeEnd = ref('');

interface RangeResult {
  count: number;
  totalDays: number;
  startLabel: string;
  endLabel: string;
}
const rangeResult = ref<RangeResult | null>(null);

function countWeekdays(start: Date, end: Date): number {
  if (start > end) return 0;
  const totalDays = Math.round((end.getTime() - start.getTime()) / 86400000) + 1;
  const fullWeeks = Math.floor(totalDays / 7);
  let count = fullWeeks * 5;
  const remainder = totalDays % 7;
  const startDow = start.getDay(); // 0=Sun
  for (let i = 0; i < remainder; i++) {
    const dow = (startDow + i) % 7;
    if (dow !== 0 && dow !== 6) count++;
  }
  return count;
}

function calcRange() {
  if (!rangeStart.value || !rangeEnd.value) return;
  const s = parseDateLocal(rangeStart.value);
  const e = parseDateLocal(rangeEnd.value);
  if (s > e) return;
  const totalDays = Math.round((e.getTime() - s.getTime()) / 86400000) + 1;
  rangeResult.value = {
    count: countWeekdays(s, e),
    totalDays,
    startLabel: formatDateLabel(s),
    endLabel: formatDateLabel(e)
  };
}

// ── Section 3: Nearest trading day ───────────────────────────────────────

const nearestDate = ref(maxDate);

interface NearestResult {
  prev: string;
  prevDow: number;
  todayLabel: string;
  todayIsTrading: boolean;
  next: string;
  nextDow: number;
}
const nearestResult = ref<NearestResult | null>(null);

function prevTradingDay(d: Date): Date {
  const p = new Date(d);
  p.setDate(p.getDate() - 1);
  while (!isWeekday(p)) p.setDate(p.getDate() - 1);
  return p;
}

function nextTradingDay(d: Date): Date {
  const n = new Date(d);
  n.setDate(n.getDate() + 1);
  while (!isWeekday(n)) n.setDate(n.getDate() + 1);
  return n;
}

function findNearest() {
  if (!nearestDate.value) return;
  const d = parseDateLocal(nearestDate.value);
  const prev = prevTradingDay(d);
  const next = nextTradingDay(d);
  nearestResult.value = {
    prev: formatDateLabel(prev),
    prevDow: prev.getDay(),
    todayLabel: formatDateLabel(d),
    todayIsTrading: isWeekday(d),
    next: formatDateLabel(next),
    nextDow: next.getDay()
  };
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
  background: rgba(255, 200, 80, 0.07);
  border: 1px solid rgba(255, 200, 80, 0.18);
  color: rgba(255, 200, 80, 0.8);
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
