<template>
  <UiToast channel="toolkit" />

  <InvestStrategyList
    v-if="viewMode === 'list'"
    :strategies="strategies"
    :selected-for-compare="selectedForCompare"
    :show-back="true"
    @back="emit('back')"
    @create="startCreate"
    @edit="startEdit"
    @delete="deleteStrategy"
    @backtest="startBacktest"
    @backtest-records="openBacktestRecords"
    @toggle-compare="toggleCompareSelection"
    @start-compare="startCompare"
    @compare-history="openCompareHistory"
    @content-change="emit('contentChange')" />

  <InvestStrategyEditor
    v-else-if="viewMode === 'editor'"
    :editing-id="editingId"
    :form="form"
    :fund-search-results="fundSearchResults"
    :fund-search-active-idx="fundSearchActiveIdx"
    :frequency-options="frequencyOptions"
    :weekday-options="weekdayOptions"
    :month-day-options="monthDayOptions"
    @back="returnToList"
    @save="saveStrategy"
    @fund-code-input="onFundCodeInput"
    @select-fund="selectFund"
    @add-fund="addFundEntry"
    @remove-fund="removeFundEntry"
    @content-change="emit('contentChange')" />

  <InvestBacktestHistoryList
    v-else-if="viewMode === 'backtestHistory'"
    :strategy-name="historyStrategyName"
    :entries="backtestHistoryEntries"
    :loading="backtestHistoryLoading"
    @back="returnToList"
    @open="openHistoryEntry"
    @delete-batch="deleteBatchBacktestEntries" />

  <InvestCompareHistoryList
    v-else-if="viewMode === 'compareHistory'"
    :entries="compareHistoryEntries"
    :loading="compareHistoryLoading"
    @back="returnToList"
    @open="openCompareHistoryEntry"
    @delete-batch="deleteBatchCompareEntries" />

  <InvestBacktestView
    v-else-if="viewMode === 'backtest'"
    :results="backtestResults"
    :loading="backtestLoading"
    :error="backtestError"
    mode="backtest"
    @back="returnFromBacktestView"
    @content-change="emit('contentChange')" />

  <InvestBacktestView
    v-else-if="viewMode === 'compare'"
    :results="compareResults"
    :loading="compareLoading"
    error=""
    mode="compare"
    @back="returnFromBacktestView"
    @content-change="emit('contentChange')" />
</template>

<script setup lang="ts">
import UiToast from '@/components/ui/Toast';
import InvestBacktestHistoryList from './InvestBacktestHistoryList.vue';
import InvestBacktestView from './InvestBacktestView.vue';
import InvestCompareHistoryList from './InvestCompareHistoryList.vue';
import InvestStrategyEditor from './InvestStrategyEditor.vue';
import InvestStrategyList from './InvestStrategyList.vue';
import { useInvestTabState } from './useInvestTabState';

const emit = defineEmits<{
  (event: 'back'): void;
  (event: 'contentChange'): void;
}>();

const {
  strategies,
  viewMode,
  editingId,
  form,
  backtestResults,
  backtestLoading,
  backtestError,
  compareResults,
  compareLoading,
  selectedForCompare,
  fundSearchResults,
  fundSearchActiveIdx,
  frequencyOptions,
  weekdayOptions,
  monthDayOptions,
  startCreate,
  startEdit,
  returnToList,
  saveStrategy,
  deleteStrategy,
  startBacktest,
  toggleCompareSelection,
  startCompare,
  onFundCodeInput,
  selectFund,
  addFundEntry,
  removeFundEntry,
  historyStrategyName,
  backtestHistoryEntries,
  backtestHistoryLoading,
  openBacktestRecords,
  openHistoryEntry,
  deleteBatchBacktestEntries,
  returnFromBacktestView,
  compareHistoryEntries,
  compareHistoryLoading,
  openCompareHistory,
  openCompareHistoryEntry,
  deleteBatchCompareEntries
} = useInvestTabState(event => emit(event));
</script>
