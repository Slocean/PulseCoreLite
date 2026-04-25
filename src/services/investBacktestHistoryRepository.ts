import type {
  BacktestResult,
  InvestBacktestHistoryEntry,
  InvestBacktestHistoryStore,
  InvestCompareHistoryEntry,
  InvestCompareHistoryStore
} from '../types/invest';
import { storageKeys, storageRepository } from './storageRepository';

const STORE_VERSION = 1 as const;
const MAX_PER_STRATEGY = 40;

function slimBacktestResult(result: BacktestResult): BacktestResult {
  return { ...result, navHistory: [] };
}

export async function loadInvestBacktestHistoryItems(): Promise<InvestBacktestHistoryEntry[]> {
  const data = await storageRepository.getJson<InvestBacktestHistoryStore>(storageKeys.investBacktestHistory);
  if (!data || data.version !== STORE_VERSION || !Array.isArray(data.items)) {
    return [];
  }
  return data.items;
}

async function saveItems(items: InvestBacktestHistoryEntry[]): Promise<void> {
  const store: InvestBacktestHistoryStore = { version: STORE_VERSION, items };
  await storageRepository.setJson(storageKeys.investBacktestHistory, store);
}

export function sortHistoryEntriesForStrategy(
  items: InvestBacktestHistoryEntry[],
  strategyId: string
): InvestBacktestHistoryEntry[] {
  return items
    .filter(e => e.strategyId === strategyId)
    .sort((a, b) => b.createdAt.localeCompare(a.createdAt));
}

export async function appendInvestBacktestRecord(strategyId: string, result: BacktestResult): Promise<void> {
  const items = await loadInvestBacktestHistoryItems();
  const rest = items.filter(i => i.strategyId !== strategyId);
  const forStrategy = items.filter(i => i.strategyId === strategyId);
  const entry: InvestBacktestHistoryEntry = {
    id: crypto.randomUUID(),
    strategyId,
    createdAt: new Date().toISOString(),
    result: slimBacktestResult({ ...result, strategyId })
  };
  const nextForStrategy = [entry, ...forStrategy].slice(0, MAX_PER_STRATEGY);
  await saveItems([...rest, ...nextForStrategy]);
}

export async function removeInvestBacktestHistoryForStrategy(strategyId: string): Promise<void> {
  const items = await loadInvestBacktestHistoryItems();
  await saveItems(items.filter(i => i.strategyId !== strategyId));
}

export async function removeInvestBacktestEntriesByIds(ids: string[]): Promise<void> {
  const set = new Set(ids);
  const items = await loadInvestBacktestHistoryItems();
  await saveItems(items.filter(i => !set.has(i.id)));
}

// ── Compare History ──────────────────────────────────────────────────────────

const COMPARE_STORE_VERSION = 1 as const;
const MAX_COMPARE_ENTRIES = 40;

async function loadCompareItems(): Promise<InvestCompareHistoryEntry[]> {
  const data = await storageRepository.getJson<InvestCompareHistoryStore>(storageKeys.investCompareHistory);
  if (!data || data.version !== COMPARE_STORE_VERSION || !Array.isArray(data.items)) {
    return [];
  }
  return data.items;
}

async function saveCompareItems(items: InvestCompareHistoryEntry[]): Promise<void> {
  const store: InvestCompareHistoryStore = { version: COMPARE_STORE_VERSION, items };
  await storageRepository.setJson(storageKeys.investCompareHistory, store);
}

export async function loadInvestCompareHistoryItems(): Promise<InvestCompareHistoryEntry[]> {
  const items = await loadCompareItems();
  return [...items].sort((a, b) => b.createdAt.localeCompare(a.createdAt));
}

export async function appendInvestCompareRecord(
  strategyIds: string[],
  strategyNames: string[],
  results: BacktestResult[]
): Promise<void> {
  const items = await loadCompareItems();
  const entry: InvestCompareHistoryEntry = {
    id: crypto.randomUUID(),
    createdAt: new Date().toISOString(),
    strategyIds,
    strategyNames,
    results: results.map(r => ({ ...r, navHistory: [] }))
  };
  const next = [entry, ...items].slice(0, MAX_COMPARE_ENTRIES);
  await saveCompareItems(next);
}

export async function removeInvestCompareEntriesByIds(ids: string[]): Promise<void> {
  const set = new Set(ids);
  const items = await loadCompareItems();
  await saveCompareItems(items.filter(i => !set.has(i.id)));
}
