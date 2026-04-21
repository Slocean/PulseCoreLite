import type {
  BacktestResult,
  FundNavRecord,
  InvestStrategy,
  PurchaseRecord
} from '../types/invest';

function parseDate(dateStr: string): Date {
  return new Date(dateStr + 'T00:00:00');
}

function formatDate(date: Date): string {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

function findNavOnOrAfter(
  navMap: Map<string, FundNavRecord>,
  sortedDates: string[],
  targetDate: string
): FundNavRecord | null {
  for (const d of sortedDates) {
    if (d >= targetDate) {
      return navMap.get(d) ?? null;
    }
  }
  return null;
}

function generateInvestDates(strategy: InvestStrategy, availableDates: string[]): string[] {
  if (availableDates.length === 0) return [];

  const start = strategy.startDate;
  const end = strategy.endDate ?? formatDate(new Date());
  const result: string[] = [];

  if (strategy.frequency === 'daily') {
    for (const d of availableDates) {
      if (d >= start && d <= end) {
        result.push(d);
      }
    }
    return result;
  }

  const startDt = parseDate(start);
  const endDt = parseDate(end);

  if (strategy.frequency === 'weekly') {
    const targetWeekday = strategy.weekday ?? 1;
    const current = new Date(startDt);
    const dayOfWeek = current.getDay();
    const daysUntilTarget = (targetWeekday - dayOfWeek + 7) % 7;
    current.setDate(current.getDate() + daysUntilTarget);

    while (current <= endDt) {
      result.push(formatDate(current));
      current.setDate(current.getDate() + 7);
    }
  } else if (strategy.frequency === 'monthly') {
    const targetDay = strategy.monthDay ?? 1;
    const current = new Date(startDt.getFullYear(), startDt.getMonth(), targetDay);
    if (current < startDt) {
      current.setMonth(current.getMonth() + 1);
    }

    while (current <= endDt) {
      result.push(formatDate(current));
      current.setMonth(current.getMonth() + 1);
    }
  }

  return result;
}

export function runBacktest(
  strategy: InvestStrategy,
  navHistory: FundNavRecord[]
): BacktestResult {
  const navMap = new Map<string, FundNavRecord>();
  for (const record of navHistory) {
    navMap.set(record.date, record);
  }

  const sortedDates = [...navMap.keys()].sort();

  const investDates = generateInvestDates(strategy, sortedDates);

  const purchaseRecords: PurchaseRecord[] = [];
  let totalInvested = 0;
  let totalShares = 0;

  for (const targetDate of investDates) {
    const navRecord = findNavOnOrAfter(navMap, sortedDates, targetDate);
    if (!navRecord) continue;

    const shares = strategy.amount / navRecord.nav;
    totalInvested += strategy.amount;
    totalShares += shares;

    purchaseRecords.push({
      date: navRecord.date,
      nav: navRecord.nav,
      amount: strategy.amount,
      shares,
      totalShares,
      totalInvested
    });
  }

  const lastNav = sortedDates.length > 0 ? navMap.get(sortedDates[sortedDates.length - 1]) : null;
  const currentNav = lastNav?.nav ?? 0;
  const currentValue = totalShares * currentNav;
  const profit = currentValue - totalInvested;
  const returnRate = totalInvested > 0 ? profit / totalInvested : 0;

  const firstPurchase = purchaseRecords[0];
  const lastPurchase = purchaseRecords[purchaseRecords.length - 1];
  const startDate = firstPurchase?.date ?? strategy.startDate;
  const endDate = lastPurchase?.date ?? strategy.startDate;

  const daysElapsed = Math.max(
    1,
    (parseDate(endDate).getTime() - parseDate(startDate).getTime()) / (1000 * 60 * 60 * 24)
  );

  const annualizedReturn =
    totalInvested > 0 && currentValue > 0
      ? Math.pow(currentValue / totalInvested, 365 / daysElapsed) - 1
      : 0;

  return {
    strategyId: strategy.id,
    strategyName: strategy.name,
    fundCode: strategy.fundCode,
    fundName: strategy.fundName,
    totalInvested,
    totalShares,
    currentNav,
    currentValue,
    profit,
    returnRate,
    annualizedReturn,
    startDate,
    endDate,
    daysElapsed,
    purchaseRecords,
    navHistory
  };
}
