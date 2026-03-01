import { ref, shallowRef } from "vue";
import { inTauri } from "../services/tauri";

type UpdatePayload = {
  version: string;
  date?: string;
  body?: string;
  downloadAndInstall: (onEvent?: (event: { event: string; data?: unknown }) => void) => Promise<void>;
};

export type UpdateInfo = {
  version: string;
  notes: string;
  date?: string;
};

function toMessage(error: unknown): string {
  if (error instanceof Error) {
    return error.message;
  }
  if (typeof error === "string") {
    return error;
  }
  return "Unknown error";
}

export function useUpdater() {
  const updateAvailable = ref(false);
  const updateInfo = ref<UpdateInfo | null>(null);
  const checkingUpdate = ref(false);
  const installingUpdate = ref(false);
  const updateError = ref<string | null>(null);
  // Keep the updater instance raw; Vue proxies break private fields on class instances.
  const updateRef = shallowRef<UpdatePayload | null>(null);

  async function checkForUpdates() {
    if (!inTauri() || checkingUpdate.value) {
      return;
    }
    checkingUpdate.value = true;
    updateError.value = null;
    try {
      const { check } = await import("@tauri-apps/plugin-updater");
      const update = (await check()) as UpdatePayload | null;
      updateRef.value = update;
      if (update) {
        updateAvailable.value = true;
        updateInfo.value = {
          version: update.version,
          notes: update.body ?? "",
          date: update.date
        };
      } else {
        updateAvailable.value = false;
        updateInfo.value = null;
      }
    } catch (error) {
      updateError.value = toMessage(error);
    } finally {
      checkingUpdate.value = false;
    }
  }

  async function installUpdate() {
    if (!inTauri() || installingUpdate.value) {
      return;
    }
    installingUpdate.value = true;
    updateError.value = null;
    try {
      let update = updateRef.value;
      if (!update) {
        const { check } = await import("@tauri-apps/plugin-updater");
        update = (await check()) as UpdatePayload | null;
        updateRef.value = update;
      }
      if (!update) {
        updateAvailable.value = false;
        updateInfo.value = null;
        return;
      }
      await update.downloadAndInstall();
      const { relaunch } = await import("@tauri-apps/plugin-process");
      await relaunch();
    } catch (error) {
      updateError.value = toMessage(error);
    } finally {
      installingUpdate.value = false;
    }
  }

  return {
    updateAvailable,
    updateInfo,
    checkingUpdate,
    installingUpdate,
    updateError,
    checkForUpdates,
    installUpdate
  };
}
