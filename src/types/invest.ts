export type InvestFrequency = 'daily' | 'weekly' | 'monthly';

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
  createdAt: string;
  updatedAt: string;
}

export interface FundNavRecord {
  date: string;
  nav: number;
  accNav: number;
}

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
