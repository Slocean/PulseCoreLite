import { computed, onMounted, reactive, ref } from 'vue';
import { useI18n } from 'vue-i18n';

import { useToastService } from '@/composables/useToastService';
import {
  appendInvestBacktestRecord,
  loadInvestBacktestHistoryItems,
  removeInvestBacktestEntriesByIds,
  removeInvestBacktestHistoryForStrategy,
  sortHistoryEntriesForStrategy
} from '@/services/investBacktestHistoryRepository';
import { storageKeys, storageRepository } from '@/services/storageRepository';
import { investApi } from '@/services/tauri/invest';
import type {
  BacktestResult,
  FundNavRecord,
  FundSearchResult,
  InvestBacktestHistoryEntry,
  InvestFrequency,
  InvestFundEntry,
  InvestRule,
  InvestStrategy,
  InvestStrategyStore
} from '@/types/invest';
import { runBacktestForFund } from '@/utils/backtestEngine';

type InvestTabEmit = (event: 'contentChange') => void;

type ViewMode = 'list' | 'editor' | 'backtest' | 'compare' | 'backtestHistory';

function newFundEntry(): InvestFundEntry {
  return {
    id: crypto.randomUUID(),
    fundCode: '',
    fundName: '',
    amount: 1000,
    rules: []
  };
}

function newStrategyForm() {
  return {
    id: '',
    name: '',
    frequency: 'monthly' as InvestFrequency,
    startDate: '',
    endDate: '',
    weekday: 1,
    monthDay: 1,
    funds: [] as InvestFundEntry[]
  };
}

/** Migrate legacy strategy format (fundCode/amount at top level) to v2 funds[] format */
function migrateStrategy(raw: unknown): InvestStrategy {
  const s = raw as Record<string, unknown>;
  if (!s['funds'] || !Array.isArray(s['funds']) || (s['funds'] as unknown[]).length === 0) {
    const legacyCode = s['fundCode'] as string | undefined;
    if (legacyCode) {
      s['funds'] = [
        {
          id: crypto.randomUUID(),
          fundCode: legacyCode,
          fundName: s['fundName'] as string | undefined,
          amount: (s['amount'] as number | undefined) ?? 1000,
          rules: s['rules']
        }
      ];
    } else {
      s['funds'] = [];
    }
  }
  return s as unknown as InvestStrategy;
}

export function useInvestTabState(emit: InvestTabEmit) {
  const { t } = useI18n();
  const { showToast } = useToastService('toolkit');

  const strategies = ref<InvestStrategy[]>([]);
  const viewMode = ref<ViewMode>('list');
  const editingId = ref<string | null>(null);
  const loading = ref(false);

  const form = reactive(newStrategyForm());

  const backtestResults = ref<BacktestResult[]>([]);
  const backtestLoading = ref(false);
  const backtestError = ref('');

  const compareResults = ref<BacktestResult[]>([]);
  const compareLoading = ref(false);
  const selectedForCompare = ref<Set<string>>(new Set());

  const backtestReturnTarget = ref<'list' | 'history'>('list');
  const historyStrategyId = ref<string | null>(null);
  const backtestHistoryEntries = ref<InvestBacktestHistoryEntry[]>([]);
  const backtestHistoryLoading = ref(false);

  const historyStrategyName = computed(() => {
    const id = historyStrategyId.value;
    if (!id) return '';
    return strategies.value.find(s => s.id === id)?.name ?? '';
  });

  const fundSearchResults = ref<FundSearchResult[]>([]);
  const fundSearchActiveIdx = ref<number>(-1);
  const fundSearchLoading = ref(false);
  let fundSearchTimer: ReturnType<typeof setTimeout> | null = null;

  async function loadStrategies() {
    const stored = await storageRepository.getJson<InvestStrategyStore>(storageKeys.investStrategies);
    const raw = stored?.strategies ?? [];
    strategies.value = raw.map(s => migrateStrategy(s));
  }

  async function saveStrategies() {
    const store: InvestStrategyStore = { strategies: strategies.value };
    await storageRepository.setJson(storageKeys.investStrategies, store);
  }

  function startCreate() {
    editingId.value = null;
    const today = new Date();
    const oneYearAgo = new Date(today);
    oneYearAgo.setFullYear(today.getFullYear() - 1);
    Object.assign(form, newStrategyForm(), {
      startDate: formatDateInput(oneYearAgo),
      endDate: formatDateInput(today),
      funds: [newFundEntry()]
    });
    fundSearchResults.value = [];
    fundSearchActiveIdx.value = -1;
    viewMode.value = 'editor';
    emit('contentChange');
  }

  function startEdit(id: string) {
    const s = strategies.value.find(s => s.id === id);
    if (!s) return;
    editingId.value = id;
    Object.assign(form, {
      id: s.id,
      name: s.name,
      frequency: s.frequency,
      startDate: s.startDate,
      endDate: s.endDate ?? '',
      weekday: s.weekday ?? 1,
      monthDay: s.monthDay ?? 1,
      funds: s.funds.map(f => ({
        ...f,
        rules: f.rules ? f.rules.map(r => ({ ...r })) : []
      }))
    });
    fundSearchResults.value = [];
    fundSearchActiveIdx.value = -1;
    viewMode.value = 'editor';
    emit('contentChange');
  }

  function returnToList() {
    viewMode.value = 'list';
    backtestResults.value = [];
    backtestError.value = '';
    compareResults.value = [];
    backtestReturnTarget.value = 'list';
    historyStrategyId.value = null;
    backtestHistoryEntries.value = [];
    emit('contentChange');
  }

  async function refreshBacktestHistoryEntries() {
    if (!historyStrategyId.value) {
      backtestHistoryEntries.value = [];
      return;
    }
    const all = await loadInvestBacktestHistoryItems();
    backtestHistoryEntries.value = sortHistoryEntriesForStrategy(all, historyStrategyId.value);
  }

  async function openBacktestRecords(strategyId: string) {
    historyStrategyId.value = strategyId;
    viewMode.value = 'backtestHistory';
    backtestHistoryLoading.value = true;
    emit('contentChange');
    try {
      await refreshBacktestHistoryEntries();
    } finally {
      backtestHistoryLoading.value = false;
      emit('contentChange');
    }
  }

  async function deleteBatchBacktestEntries(ids: string[]) {
    if (ids.length === 0) return;
    await removeInvestBacktestEntriesByIds(ids);
    showToast(t('invest.backtestBatchDeleteSuccess', { n: ids.length }), { variant: 'success' });
    backtestHistoryLoading.value = true;
    emit('contentChange');
    try {
      await refreshBacktestHistoryEntries();
    } finally {
      backtestHistoryLoading.value = false;
      emit('contentChange');
    }
  }

  function openHistoryEntry(entryId: string) {
    const entry = backtestHistoryEntries.value.find(x => x.id === entryId);
    if (!entry) return;
    backtestReturnTarget.value = 'history';
    backtestResults.value = [entry.result];
    backtestError.value = '';
    backtestLoading.value = false;
    viewMode.value = 'backtest';
    emit('contentChange');
  }

  async function returnFromBacktestView() {
    if (backtestReturnTarget.value === 'history' && historyStrategyId.value) {
      backtestResults.value = [];
      backtestError.value = '';
      viewMode.value = 'backtestHistory';
      backtestHistoryLoading.value = true;
      emit('contentChange');
      try {
        await refreshBacktestHistoryEntries();
      } finally {
        backtestHistoryLoading.value = false;
        emit('contentChange');
      }
    } else {
      returnToList();
    }
  }

  async function saveStrategy() {
    if (!form.name.trim()) {
      showToast(t('invest.errorNameRequired'), { variant: 'error' });
      return;
    }
    if (form.funds.length === 0) {
      showToast(t('invest.errorFundRequired'), { variant: 'error' });
      return;
    }
    for (const fund of form.funds) {
      if (!fund.fundCode.trim()) {
        showToast(t('invest.errorFundCodeRequired'), { variant: 'error' });
        return;
      }
    }
    if (!form.startDate) {
      showToast(t('invest.errorStartRequired'), { variant: 'error' });
      return;
    }

    const now = new Date().toISOString();
    const funds: InvestFundEntry[] = form.funds.map(f => ({
      id: f.id,
      fundCode: f.fundCode.trim(),
      fundName: f.fundName?.trim() || undefined,
      amount: f.amount,
      rules: f.rules && f.rules.length > 0 ? f.rules.map(r => ({ ...r })) : undefined
    }));

    if (editingId.value) {
      const idx = strategies.value.findIndex(s => s.id === editingId.value);
      if (idx !== -1) {
        strategies.value[idx] = {
          ...strategies.value[idx],
          name: form.name.trim(),
          funds,
          frequency: form.frequency,
          startDate: form.startDate,
          endDate: form.endDate || undefined,
          weekday: form.frequency === 'weekly' ? form.weekday : undefined,
          monthDay: form.frequency === 'monthly' ? form.monthDay : undefined,
          updatedAt: now
        };
      }
    } else {
      const strategy: InvestStrategy = {
        id: crypto.randomUUID(),
        name: form.name.trim(),
        funds,
        frequency: form.frequency,
        startDate: form.startDate,
        endDate: form.endDate || undefined,
        weekday: form.frequency === 'weekly' ? form.weekday : undefined,
        monthDay: form.frequency === 'monthly' ? form.monthDay : undefined,
        createdAt: now,
        updatedAt: now
      };
      strategies.value.push(strategy);
    }

    await saveStrategies();
    showToast(t('invest.saveSuccess'), { variant: 'success' });
    viewMode.value = 'list';
    emit('contentChange');
  }

  async function deleteStrategy(id: string) {
    strategies.value = strategies.value.filter(s => s.id !== id);
    selectedForCompare.value.delete(id);
    await removeInvestBacktestHistoryForStrategy(id);
    await saveStrategies();
    showToast(t('invest.deleteSuccess'), { variant: 'success' });
    emit('contentChange');
  }

  async function startBacktest(strategyId: string) {
    const strategy = strategies.value.find(s => s.id === strategyId);
    if (!strategy || strategy.funds.length === 0) return;

    backtestReturnTarget.value = 'list';
    historyStrategyId.value = null;
    backtestLoading.value = true;
    backtestError.value = '';
    backtestResults.value = [];
    viewMode.value = 'backtest';
    emit('contentChange');

    try {
      const endDate = strategy.endDate || formatDateInput(new Date());
      const results: BacktestResult[] = [];

      for (const fund of strategy.funds) {
        const navHistory = await investApi.fetchFundHistory(fund.fundCode, strategy.startDate, endDate);
        if (navHistory.length === 0) {
          backtestError.value = t('invest.errorNoNavDataForFund', { code: fund.fundCode });
          return;
        }
        results.push(runBacktestForFund(strategy, fund, navHistory));
      }

      backtestResults.value = results;

      // Save each fund's result separately to history
      try {
        for (const result of results) {
          await appendInvestBacktestRecord(strategy.id, result);
        }
      } catch {
        showToast(t('invest.backtestSaveHistoryFailed'), { variant: 'error' });
      }
    } catch (e) {
      backtestError.value = String(e);
    } finally {
      backtestLoading.value = false;
      emit('contentChange');
    }
  }

  function toggleCompareSelection(id: string) {
    if (selectedForCompare.value.has(id)) {
      selectedForCompare.value.delete(id);
    } else {
      selectedForCompare.value.add(id);
    }
  }

  async function startCompare() {
    if (selectedForCompare.value.size < 2) {
      showToast(t('invest.errorCompareMin'), { variant: 'error' });
      return;
    }

    compareLoading.value = true;
    compareResults.value = [];
    viewMode.value = 'compare';
    emit('contentChange');

    try {
      const results: BacktestResult[] = [];
      for (const id of selectedForCompare.value) {
        const strategy = strategies.value.find(s => s.id === id);
        if (!strategy || strategy.funds.length === 0) continue;
        const endDate = strategy.endDate || formatDateInput(new Date());
        // Use first fund for compare mode
        const fund = strategy.funds[0];
        const navHistory = await investApi.fetchFundHistory(fund.fundCode, strategy.startDate, endDate);
        if (navHistory.length > 0) {
          results.push(runBacktestForFund(strategy, fund, navHistory));
        }
      }
      compareResults.value = results;
    } catch (e) {
      showToast(String(e), { variant: 'error' });
    } finally {
      compareLoading.value = false;
      emit('contentChange');
    }
  }

  function onFundCodeInput(value: string, fundIdx: number) {
    if (fundIdx < 0 || fundIdx >= form.funds.length) return;
    form.funds[fundIdx].fundCode = value;
    fundSearchActiveIdx.value = fundIdx;

    if (fundSearchTimer) clearTimeout(fundSearchTimer);
    if (!value.trim()) {
      fundSearchResults.value = [];
      return;
    }
    fundSearchTimer = setTimeout(async () => {
      fundSearchLoading.value = true;
      try {
        fundSearchResults.value = await investApi.searchFund(value.trim());
      } catch {
        fundSearchResults.value = [];
      } finally {
        fundSearchLoading.value = false;
      }
    }, 400);
  }

  function selectFund(result: FundSearchResult, fundIdx: number) {
    if (fundIdx < 0 || fundIdx >= form.funds.length) return;
    form.funds[fundIdx].fundCode = result.code;
    form.funds[fundIdx].fundName = result.name;
    fundSearchResults.value = [];
    fundSearchActiveIdx.value = -1;
  }

  function addFundEntry() {
    form.funds.push(newFundEntry());
  }

  function removeFundEntry(idx: number) {
    form.funds.splice(idx, 1);
    if (fundSearchActiveIdx.value === idx) {
      fundSearchResults.value = [];
      fundSearchActiveIdx.value = -1;
    }
  }

  const frequencyOptions = [
    { value: 'daily', labelKey: 'invest.freqDaily' },
    { value: 'weekly', labelKey: 'invest.freqWeekly' },
    { value: 'monthly', labelKey: 'invest.freqMonthly' }
  ] as const;

  const weekdayOptions = [
    { value: 1, labelKey: 'invest.weekMon' },
    { value: 2, labelKey: 'invest.weekTue' },
    { value: 3, labelKey: 'invest.weekWed' },
    { value: 4, labelKey: 'invest.weekThu' },
    { value: 5, labelKey: 'invest.weekFri' }
  ] as const;

  const monthDayOptions = Array.from({ length: 28 }, (_, i) => ({
    value: i + 1,
    label: String(i + 1)
  }));

  onMounted(() => {
    loadStrategies();
  });

  return {
    t,
    strategies,
    viewMode,
    editingId,
    loading,
    form,
    backtestResults,
    backtestLoading,
    backtestError,
    compareResults,
    compareLoading,
    selectedForCompare,
    fundSearchResults,
    fundSearchActiveIdx,
    fundSearchLoading,
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
    returnFromBacktestView
  };
}

function formatDateInput(date: Date): string {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

export type { BacktestResult, FundNavRecord, InvestBacktestHistoryEntry, InvestStrategy };
