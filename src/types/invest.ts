export type InvestFrequency = 'daily' | 'weekly' | 'monthly';

/** Condition that triggers a rule */
export type ConditionType =
  | 'nav_above'           // current NAV > threshold
  | 'nav_below'           // current NAV < threshold
  | 'daily_change_above'  // daily change % > threshold
  | 'daily_change_below'; // daily change % < threshold

export type RuleAction = 'buy' | 'sell';

/** How the rule amount is interpreted */
export type AmountType =
  | 'absolute'  // fixed ¥ amount
  | 'percent';  // % of current portfolio value (buy) or % of shares held (sell)

export interface InvestRule {
  id: string;
  condition: ConditionType;
  /** NAV value (nav_* conditions) or percentage (daily_change_* conditions) */
  threshold: number;
  action: RuleAction;
  amountType: AmountType;
  /** ¥ amount if absolute; percentage 0–100 if percent */
  amount: number;
  enabled: boolean;
}

export interface InvestStrategy {
  id: string;
  name: string;
  fundCode: string;
  fundName?: string;
  frequency: InvestFrequency;
  amount: number;
  startDate: string;
  endDate?: string;
  weekday?: number;
  monthDay?: number;
  /** Optional condition-based trading rules checked every trading day */
  rules?: InvestRule[];
  createdAt: string;
  updatedAt: string;
}

export interface FundNavRecord {
  date: string;
  nav: number;
  accNav: number;
}

/** Unified buy/sell trade record produced by the backtest engine */
export interface TradeRecord {
  date: string;
  nav: number;
  action: 'buy' | 'sell';
  /** Money amount: spent (buy) or received (sell) */
  amount: number;
  /** Shares traded (always positive) */
  shares: number;
  triggerType: 'scheduled' | 'rule';
  ruleId?: string;
  /** Cumulative shares held after this trade */
  totalShares: number;
  /** Cumulative money spent on all buys */
  totalCashIn: number;
  /** Cumulative money received from all sells */
  totalCashOut: number;
}

/** @deprecated Use TradeRecord instead */
export interface PurchaseRecord {
  date: string;
  nav: number;
  amount: number;
  shares: number;
  totalShares: number;
  totalInvested: number;
}

export interface BacktestResult {
  strategyId: string;
  strategyName: string;
  fundCode: string;
  fundName?: string;
  /** Net invested = totalCashIn - totalCashOut */
  totalInvested: number;
  totalShares: number;
  currentNav: number;
  currentValue: number;
  profit: number;
  returnRate: number;
  annualizedReturn: number;
  startDate: string;
  endDate: string;
  daysElapsed: number;
  tradeRecords: TradeRecord[];
  /** @deprecated Kept for backward compat; use tradeRecords */
  purchaseRecords: PurchaseRecord[];
  navHistory: FundNavRecord[];
}

export interface FundSearchResult {
  code: string;
  name: string;
  type?: string;
}

export interface InvestStrategyStore {
  strategies: InvestStrategy[];
}
