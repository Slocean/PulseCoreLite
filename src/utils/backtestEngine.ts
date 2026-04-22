import type {
  BacktestResult,
  FundNavRecord,
  InvestStrategy,
  PurchaseRecord,
  TradeRecord
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

function generateInvestDates(strategy: InvestStrategy, availableDates: string[]): Set<string> {
  if (availableDates.length === 0) return new Set();

  const start = strategy.startDate;
  const end = strategy.endDate ?? formatDate(new Date());
  const result = new Set<string>();

  if (strategy.frequency === 'daily') {
    for (const d of availableDates) {
      if (d >= start && d <= end) result.add(d);
    }
    return result;
  }

  const startDt = parseDate(start);
  const endDt = parseDate(end);

  if (strategy.frequency === 'weekly') {
    const targetWeekday = strategy.weekday ?? 1;
    const current = new Date(startDt);
    const daysUntilTarget = (targetWeekday - current.getDay() + 7) % 7;
    current.setDate(current.getDate() + daysUntilTarget);
    while (current <= endDt) {
      result.add(formatDate(current));
      current.setDate(current.getDate() + 7);
    }
  } else if (strategy.frequency === 'monthly') {
    const targetDay = strategy.monthDay ?? 1;
    const current = new Date(startDt.getFullYear(), startDt.getMonth(), targetDay);
    if (current < startDt) current.setMonth(current.getMonth() + 1);
    while (current <= endDt) {
      result.add(formatDate(current));
      current.setMonth(current.getMonth() + 1);
    }
  }

  return result;
}

/** Find the nearest available trading date on or after targetDate */
function findNavOnOrAfter(
  navMap: Map<string, FundNavRecord>,
  sortedDates: string[],
  targetDate: string
): FundNavRecord | null {
  for (const d of sortedDates) {
    if (d >= targetDate) return navMap.get(d) ?? null;
  }
  return null;
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

  // Resolve scheduled invest dates to actual trading days (skip non-trading days)
  const scheduledTargetDates = generateInvestDates(strategy, sortedDates);
  const investTradingDates = new Set<string>();
  for (const target of scheduledTargetDates) {
    const actual = findNavOnOrAfter(navMap, sortedDates, target);
    if (actual) investTradingDates.add(actual.date);
  }

  const tradeRecords: TradeRecord[] = [];
  let totalCashIn = 0;
  let totalCashOut = 0;
  let totalShares = 0;

  for (let i = 0; i < sortedDates.length; i++) {
    const date = sortedDates[i];
    const navRecord = navMap.get(date)!;
    const prevNav = i > 0 ? (navMap.get(sortedDates[i - 1])?.nav ?? navRecord.nav) : navRecord.nav;
    const dailyChangePct = prevNav > 0 ? ((navRecord.nav - prevNav) / prevNav) * 100 : 0;

    // Scheduled buy
    if (investTradingDates.has(date)) {
      const shares = strategy.amount / navRecord.nav;
      totalCashIn += strategy.amount;
      totalShares += shares;
      tradeRecords.push({
        date,
        nav: navRecord.nav,
        action: 'buy',
        amount: strategy.amount,
        shares,
        triggerType: 'scheduled',
        totalShares,
        totalCashIn,
        totalCashOut
      });
    }

    // Rule-based trades (each rule fires at most once per day)
    if (strategy.rules) {
      for (const rule of strategy.rules) {
        if (!rule.enabled) continue;

        let conditionMet = false;
        switch (rule.condition) {
          case 'nav_above':
            conditionMet = navRecord.nav > rule.threshold;
            break;
          case 'nav_below':
            conditionMet = navRecord.nav < rule.threshold;
            break;
          case 'daily_change_above':
            conditionMet = dailyChangePct > rule.threshold;
            break;
          case 'daily_change_below':
            conditionMet = dailyChangePct < rule.threshold;
            break;
        }

        if (!conditionMet) continue;

        if (rule.action === 'buy') {
          const portfolioValue = totalShares * navRecord.nav;
          const buyAmount =
            rule.amountType === 'absolute'
              ? rule.amount
              : (portfolioValue * rule.amount) / 100;
          if (buyAmount <= 0) continue;

          const shares = buyAmount / navRecord.nav;
          totalCashIn += buyAmount;
          totalShares += shares;
          tradeRecords.push({
            date,
            nav: navRecord.nav,
            action: 'buy',
            amount: buyAmount,
            shares,
            triggerType: 'rule',
            ruleId: rule.id,
            totalShares,
            totalCashIn,
            totalCashOut
          });
        } else {
          // sell
          if (totalShares <= 0) continue;

          const sellShares =
            rule.amountType === 'absolute'
              ? Math.min(rule.amount / navRecord.nav, totalShares)
              : Math.min((totalShares * rule.amount) / 100, totalShares);
          if (sellShares <= 0) continue;

          const proceeds = sellShares * navRecord.nav;
          totalCashOut += proceeds;
          totalShares -= sellShares;
          tradeRecords.push({
            date,
            nav: navRecord.nav,
            action: 'sell',
            amount: proceeds,
            shares: sellShares,
            triggerType: 'rule',
            ruleId: rule.id,
            totalShares,
            totalCashIn,
            totalCashOut
          });
        }
      }
    }
  }

  const lastNavRecord = sortedDates.length > 0 ? navMap.get(sortedDates[sortedDates.length - 1]) : null;
  const currentNav = lastNavRecord?.nav ?? 0;
  const currentValue = totalShares * currentNav;
  const netInvested = totalCashIn - totalCashOut;
  const profit = currentValue - netInvested;
  const returnRate = netInvested > 0 ? profit / netInvested : 0;

  const firstTrade = tradeRecords[0];
  const lastTrade = tradeRecords[tradeRecords.length - 1];
  const startDate = firstTrade?.date ?? strategy.startDate;
  const endDate = lastTrade?.date ?? strategy.startDate;

  const daysElapsed = Math.max(
    1,
    (parseDate(endDate).getTime() - parseDate(startDate).getTime()) / (1000 * 60 * 60 * 24)
  );

  const annualizedReturn =
    netInvested > 0 && currentValue > 0
      ? Math.pow(currentValue / netInvested, 365 / daysElapsed) - 1
      : 0;

  // Legacy purchaseRecords (scheduled buys only) for backward compat
  const purchaseRecords: PurchaseRecord[] = tradeRecords
    .filter(r => r.action === 'buy' && r.triggerType === 'scheduled')
    .map(r => ({
      date: r.date,
      nav: r.nav,
      amount: r.amount,
      shares: r.shares,
      totalShares: r.totalShares,
      totalInvested: r.totalCashIn
    }));

  return {
    strategyId: strategy.id,
    strategyName: strategy.name,
    fundCode: strategy.fundCode,
    fundName: strategy.fundName,
    totalInvested: netInvested,
    totalShares,
    currentNav,
    currentValue,
    profit,
    returnRate,
    annualizedReturn,
    startDate,
    endDate,
    daysElapsed,
    tradeRecords,
    purchaseRecords,
    navHistory
  };
}
