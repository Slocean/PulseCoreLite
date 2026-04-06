import { tauriInvoke } from './core';
import type { EpicSteamScanResult, SyncEpicGamesRequest, SyncEpicGamesResult } from '@/types';

export const gameSyncApi = {
  scanEpicGamesForSync: (steamUserId?: string | null) =>
    tauriInvoke<EpicSteamScanResult>('scan_epic_games_for_sync', steamUserId ? { steamUserId } : {}),
  syncEpicGamesToSteam: (request: SyncEpicGamesRequest) =>
    tauriInvoke<SyncEpicGamesResult>('sync_epic_games_to_steam', { request })
};
