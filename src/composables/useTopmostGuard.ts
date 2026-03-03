import { onBeforeUnmount, type Ref } from 'vue';

import { inTauri } from '../services/tauri';

type UseTopmostGuardOptions = {
  alwaysOnTop: Readonly<Ref<boolean>>;
  applyTopmost: (enabled: boolean) => Promise<void>;
};

export function useTopmostGuard({ alwaysOnTop, applyTopmost }: UseTopmostGuardOptions) {
  let topmostRepairTimer: number | null = null;
  let topmostHeartbeatTimer: number | null = null;
  let unlistenFocusChanged: (() => void) | null = null;
  let topmostGuardPauseDepth = 0;

  function isTopmostGuardPaused() {
    return topmostGuardPauseDepth > 0;
  }

  function clearTopmostRepairTimer() {
    if (topmostRepairTimer != null) {
      window.clearTimeout(topmostRepairTimer);
      topmostRepairTimer = null;
    }
  }

  function scheduleTopmostRepair(delayMs = 0) {
    if (!inTauri() || !alwaysOnTop.value || isTopmostGuardPaused()) {
      return;
    }
    clearTopmostRepairTimer();
    topmostRepairTimer = window.setTimeout(() => {
      topmostRepairTimer = null;
      void applyTopmost(true);
    }, delayMs);
  }

  async function startTopmostGuard() {
    if (!inTauri() || isTopmostGuardPaused()) {
      return;
    }
    scheduleTopmostRepair(0);
    if (topmostHeartbeatTimer == null) {
      // Keep the monitor on the front of the TOPMOST band.
      topmostHeartbeatTimer = window.setInterval(() => {
        scheduleTopmostRepair(0);
      }, 1500);
    }
    if (!unlistenFocusChanged) {
      try {
        const { getCurrentWindow } = await import('@tauri-apps/api/window');
        unlistenFocusChanged = await getCurrentWindow().onFocusChanged(({ payload: focused }) => {
          if (!focused) {
            scheduleTopmostRepair(60);
          }
        });
      } catch {
        // ignore
      }
    }
  }

  function stopTopmostGuard() {
    clearTopmostRepairTimer();
    if (topmostHeartbeatTimer != null) {
      window.clearInterval(topmostHeartbeatTimer);
      topmostHeartbeatTimer = null;
    }
    if (unlistenFocusChanged) {
      unlistenFocusChanged();
      unlistenFocusChanged = null;
    }
  }

  function pauseTopmostGuard() {
    topmostGuardPauseDepth += 1;
    stopTopmostGuard();
  }

  function resumeTopmostGuard() {
    if (topmostGuardPauseDepth === 0) return;
    topmostGuardPauseDepth -= 1;
    if (topmostGuardPauseDepth === 0 && alwaysOnTop.value) {
      void startTopmostGuard();
    }
  }

  onBeforeUnmount(() => {
    stopTopmostGuard();
  });

  return {
    isTopmostGuardPaused,
    scheduleTopmostRepair,
    startTopmostGuard,
    stopTopmostGuard,
    pauseTopmostGuard,
    resumeTopmostGuard
  };
}
