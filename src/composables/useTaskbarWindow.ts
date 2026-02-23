import { onMounted, onUnmounted, ref, watch, type Ref } from 'vue';

import { inTauri } from '../services/tauri';

const TASKBAR_POS_KEY = 'pulsecorelite.taskbar_pos';

interface UseTaskbarWindowOptions {
  rememberPosition: Ref<boolean>;
}

export function useTaskbarWindow({ rememberPosition }: UseTaskbarWindowOptions) {
  const barRef = ref<HTMLElement | null>(null);
  let resizeObserver: ResizeObserver | undefined;
  let resizeFrame: number | undefined;
  let lastSize = { width: 0, height: 0 };
  let windowApiPromise: Promise<typeof import('@tauri-apps/api/window')> | undefined;
  let moveUnlisten: (() => void) | undefined;
  let moveFrame: number | undefined;
  let correctingVerticalBounds = false;
  let lastPosition: { x: number; y: number } | null = null;
  let rememberInit = false;

  const getWindowApi = async () => {
    if (!windowApiPromise) {
      windowApiPromise = import('@tauri-apps/api/window');
    }
    return windowApiPromise;
  };

  const loadPosition = () => {
    if (!rememberPosition.value) {
      return null;
    }
    try {
      const raw = localStorage.getItem(TASKBAR_POS_KEY);
      if (!raw) return null;
      const parsed = JSON.parse(raw) as { x?: number; y?: number };
      if (typeof parsed.x !== 'number' || typeof parsed.y !== 'number') return null;
      return { x: parsed.x, y: parsed.y };
    } catch {
      return null;
    }
  };

  const savePosition = (next: { x: number; y: number }) => {
    if (!rememberPosition.value) return;
    if (lastPosition && next.x === lastPosition.x && next.y === lastPosition.y) return;
    lastPosition = next;
    localStorage.setItem(TASKBAR_POS_KEY, JSON.stringify(next));
  };

  type Rect = { left: number; top: number; right: number; bottom: number };
  type VerticalFrameInsets = { top: number; bottom: number };
  const clamp = (value: number, min: number, max: number) => Math.min(max, Math.max(min, value));

  const toMonitorRect = (monitor: { position: { x: number; y: number }; size: { width: number; height: number } }): Rect => ({
    left: monitor.position.x,
    top: monitor.position.y,
    right: monitor.position.x + monitor.size.width,
    bottom: monitor.position.y + monitor.size.height
  });

  const intersectionArea = (a: Rect, b: Rect) => {
    const width = Math.min(a.right, b.right) - Math.max(a.left, b.left);
    const height = Math.min(a.bottom, b.bottom) - Math.max(a.top, b.top);
    if (width <= 0 || height <= 0) return 0;
    return width * height;
  };

  const getVerticalFrameInsets = (outerHeight: number, innerHeight: number): VerticalFrameInsets => {
    const frame = Math.max(0, outerHeight - innerHeight);
    const top = Math.floor(frame / 2);
    return { top, bottom: frame - top };
  };

  const pickBestMonitorRect = (
    position: { x: number; y: number },
    windowSize: { width: number; height: number },
    monitorRects: Rect[]
  ): Rect => {
    const windowRect: Rect = {
      left: position.x,
      top: position.y,
      right: position.x + windowSize.width,
      bottom: position.y + windowSize.height
    };

    const bestVisible = monitorRects
      .map((rect, index) => ({ index, area: intersectionArea(windowRect, rect) }))
      .sort((a, b) => b.area - a.area)[0];

    const hasEnoughVisibleArea = bestVisible.area >= Math.min(windowSize.width * windowSize.height * 0.2, 320 * 80);
    if (hasEnoughVisibleArea) {
      return monitorRects[bestVisible.index];
    }

    const centerX = position.x + windowSize.width / 2;
    const centerY = position.y + windowSize.height / 2;
    return monitorRects
      .map(rect => {
        const monitorCenterX = (rect.left + rect.right) / 2;
        const monitorCenterY = (rect.top + rect.bottom) / 2;
        const distance = (monitorCenterX - centerX) ** 2 + (monitorCenterY - centerY) ** 2;
        return { rect, distance };
      })
      .sort((a, b) => a.distance - b.distance)[0].rect;
  };

  const clampYToMonitor = (
    y: number,
    windowOuterHeight: number,
    monitor: Rect,
    frameInsets: VerticalFrameInsets = { top: 0, bottom: 0 }
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

  const clampPositionToMonitor = (
    position: { x: number; y: number },
    windowSize: { width: number; height: number },
    monitor: Rect,
    frameInsets: VerticalFrameInsets = { top: 0, bottom: 0 }
  ) => {
    // Keep a small visible margin so users can always drag the bar back.
    const visibleMarginX = 120;
    const visibleMarginY = 32;
    const monitorWidth = monitor.right - monitor.left;
    const monitorHeight = monitor.bottom - monitor.top;

    const clampAxis = (pos: number, size: number, start: number, total: number, visibleMargin: number) => {
      const end = start + total;
      if (size <= total) {
        return clamp(pos, start, end - size);
      }
      return clamp(pos, start - size + visibleMargin, end - visibleMargin);
    };

    return {
      x: Math.round(clampAxis(position.x, windowSize.width, monitor.left, monitorWidth, visibleMarginX)),
      y: Math.round(
        clampAxis(
          position.y,
          windowSize.height,
          monitor.top - frameInsets.top,
          monitorHeight + frameInsets.top + frameInsets.bottom,
          visibleMarginY
        )
      )
    };
  };

  const sanitizePosition = async (saved: { x: number; y: number }) => {
    const { availableMonitors, getCurrentWindow } = await getWindowApi();
    const monitors = await availableMonitors();
    if (monitors.length === 0) return saved;

    const win = getCurrentWindow();
    const [windowSize, innerSize] = await Promise.all([win.outerSize(), win.innerSize()]);
    const monitorRects = monitors.map(toMonitorRect);
    const chosenMonitor = pickBestMonitorRect(saved, windowSize, monitorRects);
    const frameInsets = getVerticalFrameInsets(windowSize.height, innerSize.height);

    return clampPositionToMonitor(saved, windowSize, chosenMonitor, frameInsets);
  };

  const clampWindowToVerticalBounds = async () => {
    if (!inTauri()) return null;
    const { availableMonitors, getCurrentWindow, PhysicalPosition } = await getWindowApi();
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

    const monitor = pickBestMonitorRect({ x: pos.x, y: pos.y }, outerSize, monitors.map(toMonitorRect));
    const frameInsets = getVerticalFrameInsets(outerSize.height, innerSize.height);
    const nextY = clampYToMonitor(pos.y, outerSize.height, monitor, frameInsets);
    if (nextY === pos.y) {
      return { x: pos.x, y: pos.y };
    }

    correctingVerticalBounds = true;
    try {
      await win.setPosition(new PhysicalPosition(pos.x, nextY));
    } finally {
      correctingVerticalBounds = false;
    }
    return { x: pos.x, y: nextY };
  };

  const applyWindowSize = async (width: number, height: number) => {
    if (!inTauri()) return;
    const nextWidth = Math.max(1, Math.ceil(width));
    const nextHeight = Math.max(1, Math.ceil(height));
    if (nextWidth === lastSize.width && nextHeight === lastSize.height) return;
    lastSize = { width: nextWidth, height: nextHeight };
    const { getCurrentWindow, LogicalSize } = await getWindowApi();
    await getCurrentWindow().setSize(new LogicalSize(nextWidth, nextHeight));
    const corrected = await clampWindowToVerticalBounds();
    if (corrected && rememberPosition.value) {
      savePosition(corrected);
    }
  };

  const restorePosition = async () => {
    const saved = loadPosition();
    if (!saved) return;
    const safePosition = await sanitizePosition(saved);
    savePosition(safePosition);
    const { getCurrentWindow, PhysicalPosition } = await getWindowApi();
    await getCurrentWindow().setPosition(new PhysicalPosition(safePosition.x, safePosition.y));
  };

  const schedulePositionSave = () => {
    if (moveFrame != null) return;
    moveFrame = window.requestAnimationFrame(async () => {
      moveFrame = undefined;
      const corrected = await clampWindowToVerticalBounds();
      if (!corrected || !rememberPosition.value) return;
      savePosition(corrected);
    });
  };

  watch(
    rememberPosition,
    enabled => {
      lastPosition = null;
      if (!enabled) {
        localStorage.removeItem(TASKBAR_POS_KEY);
        rememberInit = true;
        return;
      }
      // When the user enables "remember position" at runtime, capture the current
      // window position immediately so the next launch restores to the expected spot.
      if (rememberInit && inTauri()) {
        void (async () => {
          try {
            const { getCurrentWindow } = await getWindowApi();
            const pos = await getCurrentWindow().outerPosition();
            savePosition({ x: pos.x, y: pos.y });
          } catch {
            // ignore
          }
        })();
      }
      rememberInit = true;
    },
    { immediate: true }
  );

  const scheduleResize = () => {
    if (resizeFrame != null) return;
    resizeFrame = window.requestAnimationFrame(() => {
      resizeFrame = undefined;
      const element = barRef.value;
      if (!element) return;
      const rect = element.getBoundingClientRect();
      void applyWindowSize(rect.width, rect.height);
    });
  };

  const startDragging = async () => {
    if (!inTauri()) return;
    const { getCurrentWindow } = await getWindowApi();
    await getCurrentWindow().startDragging();
  };

  const handleMouseDown = (event: MouseEvent) => {
    if (event.button !== 0) return;
    const target = event.target as HTMLElement | null;
    if (!target) return;
    if (target.closest('button, input, select, textarea, a')) return;
    void startDragging();
  };

  onMounted(() => {
    if (!inTauri()) return;
    if (rememberPosition.value) {
      void restorePosition();
    }
    void getWindowApi()
      .then(({ getCurrentWindow }) =>
        getCurrentWindow().onMoved(() => {
          if (correctingVerticalBounds) return;
          schedulePositionSave();
        })
      )
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
          const { getCurrentWindow } = await getWindowApi();
          const pos = await getCurrentWindow().outerPosition();
          savePosition({ x: pos.x, y: pos.y });
        } catch {
          // ignore
        }
      })();
    }
    if (resizeObserver && barRef.value) {
      resizeObserver.unobserve(barRef.value);
    }
    resizeObserver = undefined;
    if (resizeFrame != null) {
      window.cancelAnimationFrame(resizeFrame);
    }
    if (moveUnlisten) {
      moveUnlisten();
    }
    moveUnlisten = undefined;
    if (moveFrame != null) {
      window.cancelAnimationFrame(moveFrame);
    }
  });

  return { barRef, handleMouseDown, startDragging, scheduleResize };
}
