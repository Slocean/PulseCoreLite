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
      <div v-else-if="rangeResult !== null" class="invest-trading-result invest-trading-result--col">
        <!-- Two counts side by side -->
        <div class="invest-trading-counts">
          <div class="invest-trading-count-item">
            <span class="invest-trading-count-label">{{ t('invest.tradingDayCountLabel') }}</span>
            <span class="invest-trading-count-val invest-trading-count-val--trade">
              {{ rangeResult.tradingDays }}
            </span>
          </div>
          <div class="invest-trading-count-sep">/</div>
          <div class="invest-trading-count-item">
            <span class="invest-trading-count-label">{{ t('invest.tradingDayWorkdayLabel') }}</span>
            <span class="invest-trading-count-val invest-trading-count-val--work">
              {{ rangeResult.workdays }}
            </span>
          </div>
        </div>
        <div class="invest-trading-result-foot">
          <span class="invest-trading-result-detail">
            {{ rangeResult.startIso }} → {{ rangeResult.endIso }}
            &nbsp;（{{ rangeResult.totalDays }} 日历天）
          </span>
          <button type="button" class="invest-trading-detail-btn" @click="openDetail">
            <span class="material-symbols-outlined">calendar_view_day</span>
            {{ t('invest.tradingDayDetailBtn') }}
          </button>
        </div>
      </div>
    </div>

    <!-- Detail Dialog -->
    <UiDialog
      :open="detailOpen"
      :title="t('invest.tradingDayDetailTitle')"
      :show-actions="false"
      @cancel="detailOpen = false">
      <template #body>
        <div v-if="detailLoading" class="invest-trading-detail-loading">
          <span class="invest-trading-spinner material-symbols-outlined">autorenew</span>
        </div>
        <div v-else-if="detailError" class="invest-trading-error" style="padding:8px 0">
          <span class="material-symbols-outlined" style="font-size:13px">wifi_off</span>
          {{ t('invest.tradingDayNetError') }}
        </div>
        <div v-else class="invest-trading-detail-list">
          <!-- Summary strip -->
          <div class="invest-trading-detail-summary">
            <span class="invest-trading-detail-summary-item">
              <span class="invest-trading-detail-dot invest-trading-detail-dot--trade"></span>
              {{ t('invest.tradingDayCountLabel') }}
              <b>{{ detailItems.filter(d => d.isTrading).length }}</b>
            </span>
            <span class="invest-trading-detail-summary-item">
              <span class="invest-trading-detail-dot invest-trading-detail-dot--makeup"></span>
              {{ t('invest.tradingDayDetailMakeup') }}
              <b>{{ detailItems.filter(d => d.type === 'makeup').length }}</b>
            </span>
            <span class="invest-trading-detail-summary-item">
              <span class="invest-trading-detail-dot invest-trading-detail-dot--holiday"></span>
              {{ t('invest.tradingDayDetailHoliday') }}
              <b>{{ detailItems.filter(d => d.type === 'holiday').length }}</b>
            </span>
          </div>
          <!-- Day rows -->
          <div
            v-for="day in detailItems"
            :key="day.iso"
            class="invest-trading-detail-row"
            :class="`invest-trading-detail-row--${day.type}`">
            <span class="invest-trading-detail-row-dot"></span>
            <span class="invest-trading-detail-row-date">{{ day.iso }}</span>
            <span class="invest-trading-detail-row-dow">
              周{{ weekdayNames[day.dow] }}
            </span>
            <span class="invest-trading-detail-row-name">{{ day.name ?? '' }}</span>
            <span class="invest-trading-detail-row-status">
              {{ day.isTrading ? t('invest.tradingDayIsTrading') : t('invest.tradingDayNotTrading') }}
            </span>
          </div>
        </div>
      </template>
    </UiDialog>

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
import UiDialog from '@/components/ui/Dialog';
import {
  isTradingDay,
  countTradingDays,
  findNearbyTradingDays,
  getDailyDetails,
  WEEKDAY_ZH,
  type DayDetail
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

interface RangeResult {
  tradingDays: number;
  workdays: number;
  totalDays: number;
  startIso: string;
  endIso: string;
}
const rangeResult = ref<RangeResult | null>(null);

async function calcRange() {
  if (!rangeStart.value || !rangeEnd.value || rangeLoading.value) return;
  if (rangeStart.value > rangeEnd.value) return;
  rangeLoading.value = true;
  rangeError.value = false;
  rangeResult.value = null;
  try {
    const { tradingDays, workdays, totalDays } = await countTradingDays(rangeStart.value, rangeEnd.value);
    rangeResult.value = {
      tradingDays,
      workdays,
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

// ── Range detail dialog ───────────────────────────────────────────────────────

const detailOpen = ref(false);
const detailLoading = ref(false);
const detailError = ref(false);
const detailItems = ref<DayDetail[]>([]);

async function openDetail() {
  if (!rangeResult.value) return;
  detailOpen.value = true;
  detailLoading.value = true;
  detailError.value = false;
  detailItems.value = [];
  try {
    detailItems.value = await getDailyDetails(rangeResult.value.startIso, rangeResult.value.endIso);
  } catch {
    detailError.value = true;
  } finally {
    detailLoading.value = false;
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

/* Two-count result layout */
.invest-trading-result--col {
  flex-direction: column;
  align-items: flex-start;
  gap: 6px;
}
.invest-trading-counts {
  display: flex;
  align-items: center;
  gap: 10px;
}
.invest-trading-count-item {
  display: flex;
  flex-direction: column;
  gap: 1px;
}
.invest-trading-count-label {
  font-size: 10px;
  color: rgba(255, 255, 255, 0.38);
  text-transform: uppercase;
  letter-spacing: 0.04em;
}
.invest-trading-count-val {
  font-size: 22px;
  font-weight: 700;
  font-variant-numeric: tabular-nums;
  line-height: 1;
}
.invest-trading-count-val--trade { color: rgba(80, 160, 255, 0.92); }
.invest-trading-count-val--work  { color: rgba(80, 220, 140, 0.85); }
.invest-trading-count-sep {
  font-size: 18px;
  color: rgba(255, 255, 255, 0.18);
  padding-top: 12px;
}
.invest-trading-result-foot {
  display: flex;
  align-items: center;
  gap: 8px;
  flex-wrap: wrap;
  width: 100%;
}

/* Detail button */
.invest-trading-detail-btn {
  display: inline-flex;
  align-items: center;
  gap: 3px;
  padding: 2px 8px;
  border-radius: 6px;
  border: 1px solid rgba(255, 255, 255, 0.12);
  background: rgba(255, 255, 255, 0.05);
  color: rgba(255, 255, 255, 0.55);
  font-size: 11px;
  cursor: pointer;
  transition: background 0.15s, color 0.15s;
  margin-left: auto;
}
.invest-trading-detail-btn:hover {
  background: rgba(255, 255, 255, 0.1);
  color: rgba(255, 255, 255, 0.85);
}
.invest-trading-detail-btn .material-symbols-outlined {
  font-size: 13px;
}

/* Detail dialog content */
.invest-trading-detail-loading {
  display: flex;
  justify-content: center;
  padding: 20px;
}

.invest-trading-detail-summary {
  display: flex;
  gap: 12px;
  padding: 6px 0 10px;
  border-bottom: 1px solid rgba(255, 255, 255, 0.07);
  margin-bottom: 6px;
  flex-wrap: wrap;
}
.invest-trading-detail-summary-item {
  display: inline-flex;
  align-items: center;
  gap: 5px;
  font-size: 11px;
  color: rgba(255, 255, 255, 0.5);
}
.invest-trading-detail-summary-item b {
  font-variant-numeric: tabular-nums;
  color: rgba(255, 255, 255, 0.85);
}
.invest-trading-detail-dot {
  width: 7px;
  height: 7px;
  border-radius: 50%;
  flex-shrink: 0;
}
.invest-trading-detail-dot--trade  { background: rgba(80, 220, 140, 0.8); }
.invest-trading-detail-dot--holiday { background: rgba(255, 120, 100, 0.8); }
.invest-trading-detail-dot--makeup  { background: rgba(180, 130, 255, 0.8); }

/* Day rows */
.invest-trading-detail-list {
  display: flex;
  flex-direction: column;
  max-height: 340px;
  overflow-y: auto;
  padding-right: 2px;
}
.invest-trading-detail-row {
  display: flex;
  align-items: center;
  gap: 6px;
  padding: 4px 2px;
  border-radius: 4px;
  font-size: 12px;
}
.invest-trading-detail-row:not(:last-child) {
  border-bottom: 1px solid rgba(255, 255, 255, 0.04);
}

/* Row dot (left indicator) */
.invest-trading-detail-row-dot {
  width: 6px;
  height: 6px;
  border-radius: 50%;
  flex-shrink: 0;
}
.invest-trading-detail-row--trading  .invest-trading-detail-row-dot { background: rgba(80, 220, 140, 0.75); }
.invest-trading-detail-row--makeup   .invest-trading-detail-row-dot { background: rgba(180, 130, 255, 0.8); }
.invest-trading-detail-row--holiday  .invest-trading-detail-row-dot { background: rgba(255, 120, 100, 0.75); }
.invest-trading-detail-row--weekend  .invest-trading-detail-row-dot { background: rgba(255, 255, 255, 0.15); }

/* Row colors */
.invest-trading-detail-row--weekend { opacity: 0.45; }
.invest-trading-detail-row--holiday .invest-trading-detail-row-date,
.invest-trading-detail-row--holiday .invest-trading-detail-row-dow { color: rgba(255, 120, 100, 0.85); }
.invest-trading-detail-row--makeup  .invest-trading-detail-row-date,
.invest-trading-detail-row--makeup  .invest-trading-detail-row-dow { color: rgba(180, 130, 255, 0.9); }
.invest-trading-detail-row--trading .invest-trading-detail-row-date { color: rgba(255, 255, 255, 0.88); }

.invest-trading-detail-row-date {
  font-variant-numeric: tabular-nums;
  min-width: 82px;
  flex-shrink: 0;
}
.invest-trading-detail-row-dow {
  min-width: 30px;
  flex-shrink: 0;
  color: rgba(255, 255, 255, 0.4);
  font-size: 11px;
}
.invest-trading-detail-row-name {
  flex: 1;
  color: rgba(255, 255, 255, 0.4);
  font-size: 11px;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}
.invest-trading-detail-row--holiday .invest-trading-detail-row-name { color: rgba(255, 120, 100, 0.6); }
.invest-trading-detail-row--makeup  .invest-trading-detail-row-name { color: rgba(180, 130, 255, 0.6); }

.invest-trading-detail-row-status {
  font-size: 10px;
  flex-shrink: 0;
  color: rgba(255, 255, 255, 0.3);
}
.invest-trading-detail-row--trading .invest-trading-detail-row-status { color: rgba(80, 220, 140, 0.6); }
.invest-trading-detail-row--makeup  .invest-trading-detail-row-status { color: rgba(180, 130, 255, 0.6); }
.invest-trading-detail-row--holiday .invest-trading-detail-row-status { color: rgba(255, 120, 100, 0.5); }
</style>
