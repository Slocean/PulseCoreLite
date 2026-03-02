import { onMounted, onUnmounted, ref, watch, type Ref } from 'vue';

import { inTauri } from '../services/tauri';
import { storageKeys } from '../services/storageRepository';
import {
  clamp,
  getVerticalFrameInsets,
  pickBestMonitorRect,
  toMonitorRect,
  useWindowPositioningCore,
  type MonitorRect,
  type WindowFrameInsets,
  type WindowPosition,
  type WindowSize
} from './useWindowPositioningCore';

interface UseTaskbarWindowOptions {
  rememberPosition: Ref<boolean>;
  positionLocked: Ref<boolean>;
}

export function useTaskbarWindow({ rememberPosition, positionLocked }: UseTaskbarWindowOptions) {
  const barRef = ref<HTMLElement | null>(null);
  let resizeObserver: ResizeObserver | undefined;
  let moveUnlisten: (() => void) | undefined;
  let correctingVerticalBounds = false;
  let lockedPosition: WindowPosition | null = null;
  let restoringLockedPosition = false;
  let restoringInitialPosition = false;
  let rememberInit = false;

  const core = useWindowPositioningCore({
    rememberPosition,
    storageKey: storageKeys.taskbarPosition,
    visibleMargins: { x: 120, y: 32 },
    minVisibleArea: 320 * 80,
    resolveFrameInsets: async (windowApi, outerSize) => {
      const innerSize = await windowApi.getCurrentWindow().innerSize();
      return getVerticalFrameInsets(outerSize.height, innerSize.height);
    }
  });

  const clampYToMonitor = (
    y: number,
    windowOuterHeight: number,
    monitor: MonitorRect,
    frameInsets: WindowFrameInsets = { top: 0, bottom: 0 }
  ) => {
    const monitorHeight = monitor.bottom - monitor.top;
    const visibleHeight = Math.max(1, windowOuterHeight - frameInsets.top - frameInsets.bottom);
    const minY = monitor.top - frameInsets.top;
    const maxY = monitor.bottom - windowOuterHeight + frameInsets.bottom;
    if (visibleHeight >= monitorHeight) {
      return Math.round(minY);
    }
    return Math.round(clamp(y, minY, maxY));
  };

  const clampWindowToVerticalBounds = async (): Promise<WindowPosition | null> => {
    if (!inTauri()) {
      return null;
    }

    const { availableMonitors, getCurrentWindow } = await core.getWindowApi();
    const win = getCurrentWindow();
    const [pos, outerSize, innerSize, monitors] = await Promise.all([
      win.outerPosition(),
      win.outerSize(),
      win.innerSize(),
      availableMonitors()
    ]);

    if (monitors.length === 0) {
      return { x: pos.x, y: pos.y };
    }

    const monitorRects = monitors.map(toMonitorRect);
    const monitor = pickBestMonitorRect({ x: pos.x, y: pos.y }, outerSize, monitorRects, 320 * 80);
    const frameInsets = getVerticalFrameInsets(outerSize.height, innerSize.height);
    const nextY = clampYToMonitor(pos.y, outerSize.height, monitor, frameInsets);

    if (nextY === pos.y) {
      return { x: pos.x, y: pos.y };
    }

    correctingVerticalBounds = true;
    try {
      await core.setCurrentPosition({ x: pos.x, y: nextY });
    } finally {
      correctingVerticalBounds = false;
    }

    return { x: pos.x, y: nextY };
  };

  const restorePosition = async () => {
    const saved = core.loadPosition();
    if (!saved) {
      return;
    }
    const safePosition = await core.resolveSafePosition(saved);
    core.savePosition(safePosition);

    restoringInitialPosition = true;
    try {
      await core.setCurrentPosition(safePosition);
    } finally {
      restoringInitialPosition = false;
    }

    if (positionLocked.value) {
      lockedPosition = { ...safePosition };
    }
  };

  const captureLockedPosition = async () => {
    if (!inTauri()) {
      return;
    }
    try {
      const pos = await core.getCurrentPosition();
      lockedPosition = pos;
    } catch {
      // ignore
    }
  };

  const restoreLockedPosition = async () => {
    if (!inTauri() || restoringLockedPosition || !positionLocked.value) {
      return;
    }
    const target = lockedPosition;
    if (!target) {
      await captureLockedPosition();
      return;
    }

    restoringLockedPosition = true;
    try {
      await core.setCurrentPosition(target);
    } finally {
      restoringLockedPosition = false;
    }
  };

  const resizeScheduler = core.createFrameScheduler(async () => {
    const element = barRef.value;
    if (!element) {
      return;
    }
    const rect = element.getBoundingClientRect();
    await core.setWindowSize(rect.width, rect.height);
    const corrected = await clampWindowToVerticalBounds();
    if (corrected && positionLocked.value) {
      lockedPosition = corrected;
    }
    if (corrected && rememberPosition.value) {
      core.savePosition(corrected);
    }
  });

  const moveScheduler = core.createFrameScheduler(async () => {
    const corrected = await clampWindowToVerticalBounds();
    if (!corrected || !rememberPosition.value) {
      return;
    }
    core.savePosition(corrected);
  });

  watch(
    rememberPosition,
    enabled => {
      core.resetPositionCache();
      if (!enabled) {
        core.clearSavedPosition();
        rememberInit = true;
        return;
      }

      if (rememberInit && inTauri()) {
        void (async () => {
          try {
            const pos = await core.getCurrentPosition();
            core.savePosition(pos);
          } catch {
            // ignore
          }
        })();
      }
      rememberInit = true;
    },
    { immediate: true }
  );

  watch(positionLocked, enabled => {
    if (!enabled) {
      lockedPosition = null;
      return;
    }
    void captureLockedPosition();
  });

  const scheduleResize = () => {
    resizeScheduler.schedule();
  };

  const startDragging = async () => {
    if (!inTauri() || positionLocked.value) {
      return;
    }
    const { getCurrentWindow } = await core.getWindowApi();
    await getCurrentWindow().startDragging();
  };

  const handleMouseDown = (event: MouseEvent) => {
    if (positionLocked.value) {
      return;
    }
    if (event.button !== 0) {
      return;
    }
    const target = event.target as HTMLElement | null;
    if (!target) {
      return;
    }
    if (target.closest('button, input, select, textarea, a')) {
      return;
    }
    void startDragging();
  };

  onMounted(() => {
    if (!inTauri()) {
      return;
    }

    if (rememberPosition.value) {
      void restorePosition();
    } else if (positionLocked.value) {
      void captureLockedPosition();
    }

    void core
      .listenMoved(async () => {
        if (correctingVerticalBounds || restoringInitialPosition) {
          return;
        }
        if (positionLocked.value) {
          await restoreLockedPosition();
          return;
        }
        moveScheduler.schedule();
      })
      .then(unlisten => {
        moveUnlisten = unlisten;
      });

    const element = barRef.value;
    if (!element || typeof ResizeObserver === 'undefined') {
      return;
    }
    resizeObserver = new ResizeObserver(() => {
      scheduleResize();
    });
    resizeObserver.observe(element);
    scheduleResize();
  });

  onUnmounted(() => {
    if (inTauri() && rememberPosition.value) {
      void (async () => {
        try {
          const pos = await core.getCurrentPosition();
          core.savePosition(pos);
        } catch {
          // ignore
        }
      })();
    }

    if (resizeObserver && barRef.value) {
      resizeObserver.unobserve(barRef.value);
    }
    resizeObserver = undefined;

    resizeScheduler.cancel();

    if (moveUnlisten) {
      moveUnlisten();
    }
    moveUnlisten = undefined;
    moveScheduler.cancel();
  });

  return { barRef, handleMouseDown, startDragging, scheduleResize };
}
