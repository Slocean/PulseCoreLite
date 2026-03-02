import { markRaw, ref, shallowRef, toRaw } from "vue";
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

type UpdateManifest = {
  version?: string;
  notes?: string;
  pub_date?: string;
  platforms?: Record<string, { url?: string }>;
};

const UPDATE_MANIFEST_URL =
  "https://github.com/Slocean/PulseCoreLite/releases/latest/download/latest.json";
const RELEASES_URL = "https://github.com/Slocean/PulseCoreLite/releases";

function isMojibakeLine(line: string): boolean {
  const latinMatches = line.match(/[\u00C0-\u00FF]/g);
  const cjkMatches = line.match(/[\u4E00-\u9FFF]/g);
  const latinCount = latinMatches ? latinMatches.length : 0;
  const cjkCount = cjkMatches ? cjkMatches.length : 0;
  return latinCount >= 3 && cjkCount === 0;
}

function decodeMojibake(line: string): string {
  try {
    const bytes = Uint8Array.from([...line].map(char => char.charCodeAt(0)));
    const decoded = new TextDecoder("utf-8", { fatal: false }).decode(bytes);
    return decoded || line;
  } catch {
    return line;
  }
}

function normalizeUpdateNotes(notes: string): string {
  if (!notes) return notes;
  const lines = notes.split(/\r?\n/);
  const normalized = lines.map(line => (isMojibakeLine(line) ? decodeMojibake(line) : line));
  return normalized.join("\n");
}

function toMessage(error: unknown): string {
  const message = error instanceof Error ? error.message : typeof error === "string" ? error : "Unknown error";
  const lower = message.toLowerCase();
  if (
    lower.includes("error sending request for url") ||
    lower.includes("failed to send request") ||
    lower.includes("dns") ||
    lower.includes("timeout") ||
    lower.includes("connection")
  ) {
    return `Update server connection failed. Please check your network and retry. Manual download: ${RELEASES_URL}`;
  }
  return message;
}

function keepRawUpdate(update: UpdatePayload | null): UpdatePayload | null {
  if (!update) {
    return null;
  }
  return markRaw(toRaw(update)) as UpdatePayload;
}

function normalizeVersion(version: string): number[] {
  const clean = version.trim().replace(/^v/i, "");
  const parts = clean.split(/[^\d]+/).filter(Boolean);
  return parts.map(part => Number.parseInt(part, 10) || 0);
}

function isRemoteVersionNewer(remoteVersion: string, currentVersion: string): boolean {
  const remote = normalizeVersion(remoteVersion);
  const current = normalizeVersion(currentVersion);
  const maxLength = Math.max(remote.length, current.length);
  for (let i = 0; i < maxLength; i += 1) {
    const remotePart = remote[i] ?? 0;
    const currentPart = current[i] ?? 0;
    if (remotePart > currentPart) return true;
    if (remotePart < currentPart) return false;
  }
  return false;
}

function getManifestWindowsDownloadUrl(manifest: UpdateManifest): string | null {
  if (!manifest.platforms) return null;
  const candidates = Object.entries(manifest.platforms)
    .filter(([key]) => key.toLowerCase().includes("windows"))
    .map(([, value]) => value?.url)
    .filter((url): url is string => typeof url === "string" && url.length > 0);
  return candidates[0] ?? null;
}

function openExternalUrl(url: string): boolean {
  try {
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.target = "_blank";
    anchor.rel = "noopener noreferrer";
    anchor.click();
    return true;
  } catch {
    return false;
  }
}

export function useUpdater(currentVersion: string) {
  const updateAvailable = ref(false);
  const updateInfo = ref<UpdateInfo | null>(null);
  const checkingUpdate = ref(false);
  const installingUpdate = ref(false);
  const updateError = ref<string | null>(null);
  // Keep the updater instance raw; Vue proxies break private fields on class instances.
  const updateRef = shallowRef<UpdatePayload | null>(null);
  const manualDownloadUrl = ref<string | null>(null);

  async function checkForUpdatesByManifestFallback() {
    const response = await fetch(UPDATE_MANIFEST_URL, { cache: "no-store" });
    if (!response.ok) {
      throw new Error(`Fallback request failed: HTTP ${response.status}`);
    }
    const manifest = (await response.json()) as UpdateManifest;
    const version = manifest.version?.trim();
    if (!version) {
      throw new Error("Fallback manifest missing version");
    }

    manualDownloadUrl.value = getManifestWindowsDownloadUrl(manifest);

    if (!isRemoteVersionNewer(version, currentVersion)) {
      updateAvailable.value = false;
      updateInfo.value = null;
      return;
    }

    updateAvailable.value = true;
    updateInfo.value = {
      version,
      notes: normalizeUpdateNotes(manifest.notes ?? ""),
      date: manifest.pub_date
    };
  }

  async function checkForUpdates() {
    if (!inTauri() || checkingUpdate.value) {
      return;
    }
    checkingUpdate.value = true;
    updateError.value = null;
    try {
      const { check } = await import("@tauri-apps/plugin-updater");
      const update = keepRawUpdate((await check()) as UpdatePayload | null);
      updateRef.value = update;
      manualDownloadUrl.value = null;
      if (update) {
        updateAvailable.value = true;
        updateInfo.value = {
          version: update.version,
          notes: normalizeUpdateNotes(update.body ?? ""),
          date: update.date
        };
      } else {
        updateAvailable.value = false;
        updateInfo.value = null;
      }
    } catch (error) {
      try {
        await checkForUpdatesByManifestFallback();
      } catch {
        updateError.value = toMessage(error);
      }
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
      let update = keepRawUpdate(updateRef.value);
      if (!update) {
        const { check } = await import("@tauri-apps/plugin-updater");
        update = keepRawUpdate((await check()) as UpdatePayload | null);
        updateRef.value = update;
      }
      if (!update) {
        if (manualDownloadUrl.value && openExternalUrl(manualDownloadUrl.value)) {
          return;
        }
        updateAvailable.value = false;
        updateInfo.value = null;
        updateError.value = `Automatic update is unavailable. Manual download: ${RELEASES_URL}`;
        return;
      }

      const downloadAndInstall = update.downloadAndInstall.bind(update);
      await downloadAndInstall();

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
