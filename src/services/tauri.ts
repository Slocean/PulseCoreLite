import type { UnlistenFn } from "@tauri-apps/api/event";
import type {
  AppBootstrap,
  AppSettings,
  ExportResult,
  HardwareInfo,
  HistoryFilter,
  HistoryPage,
  PingResult,
  SettingsPatch,
  SpeedTestConfig,
  TimeRange
} from "../types";

const isTauri = typeof window !== "undefined" && "__TAURI_INTERNALS__" in window;

async function tauriInvoke<T>(cmd: string, args?: Record<string, unknown>): Promise<T> {
  if (!isTauri) {
    throw new Error("Not running inside Tauri runtime.");
  }
  const { invoke } = await import("@tauri-apps/api/core");
  return invoke<T>(cmd, args);
}

export async function listenEvent<T>(event: string, handler: (payload: T) => void): Promise<UnlistenFn> {
  if (!isTauri) {
    return () => undefined;
  }
  const { listen } = await import("@tauri-apps/api/event");
  return listen<T>(event, (e) => handler(e.payload));
}

export function inTauri(): boolean {
  return isTauri;
}

export const api = {
  getInitialState: () => tauriInvoke<AppBootstrap>("get_initial_state"),
  getHardwareInfo: () => tauriInvoke<HardwareInfo>("get_hardware_info"),
  getSettings: () => tauriInvoke<AppSettings>("get_settings"),
  updateSettings: (patch: SettingsPatch) => tauriInvoke<AppSettings>("update_settings", { patch }),
  startSpeedTest: (config: SpeedTestConfig) => tauriInvoke<string>("start_speed_test", { config }),
  cancelSpeedTest: (taskId: string) => tauriInvoke<boolean>("cancel_speed_test", { taskId }),
  runPingTest: (target: string, count: number) => tauriInvoke<PingResult>("run_ping_test", { target, count }),
  queryHistory: (filter: HistoryFilter) => tauriInvoke<HistoryPage>("query_history", { filter }),
  exportHistoryCsv: (range: TimeRange) => tauriInvoke<ExportResult>("export_history_csv", { range }),
  toggleOverlay: (visible: boolean) => tauriInvoke<boolean>("toggle_overlay", { visible }),
  setLowPowerMode: (lowPower: boolean) => tauriInvoke<boolean>("set_low_power_mode", { lowPower })
};
