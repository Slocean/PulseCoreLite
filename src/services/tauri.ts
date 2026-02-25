import type { UnlistenFn } from "@tauri-apps/api/event";
import type {
  AppBootstrap,
  HardwareInfo,
  ScheduleShutdownRequest,
  ShutdownPlan,
  TaskbarInfo
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
  toggleOverlay: (visible: boolean) => tauriInvoke<boolean>("toggle_overlay", { visible }),
  setRefreshRate: (rateMs: number) => tauriInvoke<void>("set_refresh_rate", { rateMs }),
  confirmFactoryReset: (title: string, message: string) =>
    tauriInvoke<boolean>("confirm_factory_reset", { title, message }),
  getInstallationMode: () => tauriInvoke<"installed" | "portable">("get_installation_mode"),
  uninstallApp: (title: string, message: string) => tauriInvoke<void>("uninstall_app", { title, message }),
  getTaskbarInfo: () => tauriInvoke<TaskbarInfo | null>("get_taskbar_info"),
  setWindowSystemTopmost: (label: string, topmost: boolean) =>
    tauriInvoke<void>("set_window_system_topmost", { label, topmost }),
  getAutoStartEnabled: () => tauriInvoke<boolean>("get_auto_start_enabled"),
  setAutoStartEnabled: (enabled: boolean) => tauriInvoke<boolean>("set_auto_start_enabled", { enabled }),
  saveExportConfig: (path: string, content: string) => tauriInvoke<void>("save_export_config", { path, content }),
  getShutdownPlan: () => tauriInvoke<ShutdownPlan | null>("get_shutdown_plan"),
  scheduleShutdown: (request: ScheduleShutdownRequest) =>
    tauriInvoke<ShutdownPlan>("schedule_shutdown", { request }),
  cancelShutdownSchedule: () => tauriInvoke<void>("cancel_shutdown_schedule"),
  exitApp: () => tauriInvoke<void>("exit_app")
};
