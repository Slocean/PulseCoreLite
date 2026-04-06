export interface SteamShortcutAccount {
  id: string;
  label: string;
  shortcutsPath: string;
  gridDir: string;
  selected: boolean;
}

export interface EpicSteamGameSyncStatus {
  presentInSteam: boolean;
  managedByPulse: boolean;
  appId: number | null;
  source: 'new' | 'managed' | 'existing' | string;
}

export interface EpicInstalledGame {
  id: string;
  title: string;
  installDir: string;
  launchExecutable: string | null;
  launchCommand: string | null;
  epicAppName: string | null;
  iconPath: string | null;
  syncStatus: EpicSteamGameSyncStatus;
}

export interface EpicSteamScanResult {
  steamPath: string | null;
  steamRunning: boolean;
  selectedSteamUserId: string | null;
  accounts: SteamShortcutAccount[];
  epicGames: EpicInstalledGame[];
  warnings: string[];
}

export interface SyncEpicGamesRequest {
  steamUserId: string;
  gameIds: string[];
  removeMissingManaged?: boolean;
}

export interface SyncEpicGamesResult {
  shortcutsPath: string;
  gridDir: string;
  launcherDir: string;
  backupPath: string | null;
  createdCount: number;
  updatedCount: number;
  removedCount: number;
  syncedGameIds: string[];
  warnings: string[];
}
