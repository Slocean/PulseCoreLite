export type SteamMarketSellMode =
  | 'lowestSell'
  | 'highestBuy'
  | 'fixedDiscount'
  | 'percentDiscount'
  | 'manual';

export interface SteamMarketSessionStatus {
  loggedIn: boolean;
  steamId: string | null;
  personaName: string | null;
  currencyLabel: string | null;
  savedAt: string | null;
  loginWindowOpen: boolean;
  message: string | null;
}

export interface SteamMarketSessionInput {
  sessionId: string;
  steamLoginSecure: string;
  steamCountry?: string | null;
}

export interface SteamMarketItem {
  id: string;
  assetId: string;
  classId: string;
  instanceId: string;
  appId: number;
  contextId: string;
  name: string;
  marketHashName: string;
  iconUrl: string | null;
  amount: number;
  marketable: boolean;
  tradable: boolean;
}

export interface SteamMarketInventoryGroup {
  appId: number;
  contextId: string;
  appLabel: string;
  items: SteamMarketItem[];
}

export interface SteamMarketInventoryScanResult {
  steamId: string;
  groups: SteamMarketInventoryGroup[];
  totalMarketable: number;
  warnings: string[];
}

export interface SteamMarketPriceQuote {
  itemId: string;
  marketHashName: string;
  lowestSellCents: number | null;
  highestBuyCents: number | null;
  medianSellCents: number | null;
  currencyLabel: string;
  volume: number | null;
  stale: boolean;
  error: string | null;
}

export interface SteamMarketSellStrategy {
  mode: SteamMarketSellMode;
  discountCents?: number | null;
  discountPercent?: number | null;
}

export interface SteamMarketSellPlanItem {
  item: SteamMarketItem;
  referenceMode: SteamMarketSellMode;
  referenceCents: number | null;
  sellerReceivesCents: number;
  buyerPaysCents: number | null;
  skipped: boolean;
  skipReason: string | null;
}

export interface SteamMarketSellPlanResult {
  items: SteamMarketSellPlanItem[];
  totalSellerReceivesCents: number;
  warnings: string[];
}

export interface SteamMarketSellItemRequest {
  assetId: string;
  appId: number;
  contextId: string;
  amount: number;
  sellerReceivesCents: number;
}

export interface SteamMarketSellBatchRequest {
  items: SteamMarketSellItemRequest[];
}

export interface SteamMarketSellItemResult {
  assetId: string;
  success: boolean;
  message: string;
  requiresConfirmation: boolean;
  listingId: string | null;
}

export interface SteamMarketSellBatchResult {
  results: SteamMarketSellItemResult[];
  successCount: number;
  failureCount: number;
  confirmationCount: number;
}

export interface SteamMarketListingItem {
  listingId: string;
  name: string;
  priceCents: number;
  status: string;
}

export interface SteamMarketListingsResult {
  items: SteamMarketListingItem[];
  total: number;
}
