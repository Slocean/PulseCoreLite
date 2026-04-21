import type { FundNavRecord, FundSearchResult } from '../../types/invest';
import { tauriInvoke } from './core';

export const investApi = {
  fetchFundHistory: (fundCode: string, startDate: string, endDate: string) =>
    tauriInvoke<FundNavRecord[]>('fetch_fund_history', { fundCode, startDate, endDate }),
  searchFund: (keyword: string) =>
    tauriInvoke<FundSearchResult[]>('search_fund', { keyword })
};
