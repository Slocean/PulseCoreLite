import { tauriInvoke } from './core';
import type {
  SteamMarketInventoryScanResult,
  SteamMarketListingsResult,
  SteamMarketPriceQuote,
  SteamMarketSellBatchRequest,
  SteamMarketSellBatchResult,
  SteamMarketSellPlanResult,
  SteamMarketSellStrategy,
  SteamMarketSessionInput,
  SteamMarketSessionStatus
} from '@/types';

export const steamMarketApi = {
  startSteamMarketLogin: () => tauriInvoke<void>('start_steam_market_login'),
  captureSteamMarketLogin: () => tauriInvoke<SteamMarketSessionStatus>('capture_steam_market_login'),
  cancelSteamMarketLogin: () => tauriInvoke<void>('cancel_steam_market_login'),
  getSteamMarketSessionStatus: () => tauriInvoke<SteamMarketSessionStatus>('get_steam_market_session_status'),
  clearSteamMarketSession: () => tauriInvoke<void>('clear_steam_market_session'),
  saveSteamMarketSession: (session: SteamMarketSessionInput) =>
    tauriInvoke<SteamMarketSessionStatus>('save_steam_market_session', { session }),
  scanSteamMarketInventory: () => tauriInvoke<SteamMarketInventoryScanResult>('scan_steam_marketable_inventory'),
  refreshSteamMarketPrices: (itemIds: string[]) =>
    tauriInvoke<SteamMarketPriceQuote[]>('refresh_steam_market_prices', { itemIds }),
  previewSteamMarketSellPlan: (itemIds: string[], strategy: SteamMarketSellStrategy) =>
    tauriInvoke<SteamMarketSellPlanResult>('preview_steam_market_sell_plan', { itemIds, strategy }),
  sellSteamMarketItems: (request: SteamMarketSellBatchRequest) =>
    tauriInvoke<SteamMarketSellBatchResult>('sell_steam_market_items', { request }),
  getSteamMarketListings: () => tauriInvoke<SteamMarketListingsResult>('get_steam_market_listings')
};
