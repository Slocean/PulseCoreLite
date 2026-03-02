import { onBeforeUnmount, readonly, ref, watch, type Ref } from 'vue';

import { api, inTauri } from '../services/tauri';

type UseFullscreenAutoHideOptions = {
  autoHideOnFullscreen: Readonly<Ref<boolean>>;
  alwaysOnTop: Readonly<Ref<boolean>>;
  applyTopmost: (enabled: boolean) => Promise<void>;
  pauseTopmostGuard: () => void;
  resumeTopmostGuard: () => void;
};

export function useFullscreenAutoHide({
  autoHideOnFullscreen,
  alwaysOnTop,
  applyTopmost,
  pauseTopmostGuard,
  resumeTopmostGuard
}: UseFullscreenAutoHideOptions) {
  const fullscreenSuppressed = ref(false);
  let fullscreenPollTimer: number | null = null;
  let fullscreenCheckInFlight = false;
  let fullscreenWindowHidden = false;

  async function setFullscreenSuppressed(suppressed: boolean) {
    if (!inTauri() || fullscreenSuppressed.value === suppressed) {
      return;
    }
    fullscreenSuppressed.value = suppressed;
    if (suppressed) {
      pauseTopmostGuard();
      if (!fullscreenWindowHidden) {
        try {
          const { getCurrentWindow } = await import('@tauri-apps/api/window');
          await getCurrentWindow().hide();
          fullscreenWindowHidden = true;
        } catch {
          // ignore
        }
      }
      return;
    }
    if (fullscreenWindowHidden) {
      try {
        const { getCurrentWindow } = await import('@tauri-apps/api/window');
        await getCurrentWindow().show();
        fullscreenWindowHidden = false;
      } catch {
        // ignore
      }
    }
    resumeTopmostGuard();
    await applyTopmost(alwaysOnTop.value);
  }

  function stopFullscreenAutoHideMonitor() {
    if (fullscreenPollTimer != null) {
      window.clearInterval(fullscreenPollTimer);
      fullscreenPollTimer = null;
    }
    fullscreenCheckInFlight = false;
    void setFullscreenSuppressed(false);
  }

  function startFullscreenAutoHideMonitor() {
    if (!inTauri() || fullscreenPollTimer != null) {
      return;
    }
    const poll = async () => {
      if (fullscreenCheckInFlight) {
        return;
      }
      fullscreenCheckInFlight = true;
      try {
        if (!autoHideOnFullscreen.value) {
          await setFullscreenSuppressed(false);
          return;
        }
        const isFullscreen = await api.isFullscreenWindowActive();
        await setFullscreenSuppressed(isFullscreen);
      } catch {
        // ignore
      } finally {
        fullscreenCheckInFlight = false;
      }
    };
    fullscreenPollTimer = window.setInterval(() => {
      void poll();
    }, 250);
    void poll();
  }

  watch(
    autoHideOnFullscreen,
    enabled => {
      if (!inTauri()) return;
      if (enabled) {
        startFullscreenAutoHideMonitor();
      } else {
        stopFullscreenAutoHideMonitor();
      }
    },
    { immediate: true }
  );

  onBeforeUnmount(() => {
    stopFullscreenAutoHideMonitor();
  });

  return {
    fullscreenSuppressed: readonly(fullscreenSuppressed),
    startFullscreenAutoHideMonitor,
    stopFullscreenAutoHideMonitor
  };
}
