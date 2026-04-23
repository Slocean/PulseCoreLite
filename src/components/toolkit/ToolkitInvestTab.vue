<template>
  <UiToast channel="toolkit" />

  <InvestStrategyList
    v-if="viewMode === 'list'"
    :strategies="strategies"
    :selected-for-compare="selectedForCompare"
    @create="startCreate"
    @edit="startEdit"
    @delete="deleteStrategy"
    @backtest="startBacktest"
    @backtest-records="openBacktestRecords"
    @toggle-compare="toggleCompareSelection"
    @start-compare="startCompare"
    @content-change="emit('contentChange')" />

  <InvestStrategyEditor
    v-else-if="viewMode === 'editor'"
    :editing-id="editingId"
    :form="form"
    :fund-search-results="fundSearchResults"
    :frequency-options="frequencyOptions"
    :weekday-options="weekdayOptions"
    :month-day-options="monthDayOptions"
    @back="returnToList"
    @save="saveStrategy"
    @fund-code-input="onFundCodeInput"
    @select-fund="selectFund"
    @content-change="emit('contentChange')" />

  <InvestBacktestHistoryList
    v-else-if="viewMode === 'backtestHistory'"
    :strategy-name="historyStrategyName"
    :entries="backtestHistoryEntries"
    :loading="backtestHistoryLoading"
    @back="returnToList"
    @open="openHistoryEntry"
    @delete-batch="deleteBatchBacktestEntries" />

  <InvestBacktestView
    v-else-if="viewMode === 'backtest'"
    :results="backtestResult ? [backtestResult] : []"
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
    @back="returnToList"
    @content-change="emit('contentChange')" />
</template>

<script setup lang="ts">
import UiToast from '@/components/ui/Toast';
import InvestBacktestHistoryList from './invest/InvestBacktestHistoryList.vue';
import InvestBacktestView from './invest/InvestBacktestView.vue';
import InvestStrategyEditor from './invest/InvestStrategyEditor.vue';
import InvestStrategyList from './invest/InvestStrategyList.vue';
import { useInvestTabState } from './invest/useInvestTabState';

const emit = defineEmits<{
  (event: 'contentChange'): void;
}>();

const {
  strategies,
  viewMode,
  editingId,
  form,
  backtestResult,
  backtestLoading,
  backtestError,
  compareResults,
  compareLoading,
  selectedForCompare,
  fundSearchResults,
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
  historyStrategyName,
  backtestHistoryEntries,
  backtestHistoryLoading,
  openBacktestRecords,
  openHistoryEntry,
  deleteBatchBacktestEntries,
  returnFromBacktestView
} = useInvestTabState(event => emit(event));
</script>
