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

  const clampPositionToMonitor = (
    position: { x: number; y: number },
    windowSize: { width: number; height: number },
    monitor: Rect
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
      y: Math.round(clampAxis(position.y, windowSize.height, monitor.top, monitorHeight, visibleMarginY))
    };
  };

  const sanitizePosition = async (saved: { x: number; y: number }) => {
    const { availableMonitors, getCurrentWindow } = await getWindowApi();
    const monitors = await availableMonitors();
    if (monitors.length === 0) return saved;

    const windowSize = await getCurrentWindow().outerSize();
    const savedRect: Rect = {
      left: saved.x,
      top: saved.y,
      right: saved.x + windowSize.width,
      bottom: saved.y + windowSize.height
    };

    const monitorRects = monitors.map(toMonitorRect);
    const bestVisible = monitorRects
      .map((rect, index) => ({ index, area: intersectionArea(savedRect, rect) }))
      .sort((a, b) => b.area - a.area)[0];

    const hasEnoughVisibleArea = bestVisible.area >= Math.min(windowSize.width * windowSize.height * 0.2, 320 * 80);

    const chosenMonitor = hasEnoughVisibleArea
      ? monitorRects[bestVisible.index]
      : monitorRects
          .map(rect => {
            const centerX = (rect.left + rect.right) / 2;
            const centerY = (rect.top + rect.bottom) / 2;
            const savedCenterX = saved.x + windowSize.width / 2;
            const savedCenterY = saved.y + windowSize.height / 2;
            const distance = (centerX - savedCenterX) ** 2 + (centerY - savedCenterY) ** 2;
            return { rect, distance };
          })
          .sort((a, b) => a.distance - b.distance)[0].rect;

    return clampPositionToMonitor(saved, windowSize, chosenMonitor);
  };

  const applyWindowSize = async (width: number, height: number) => {
    if (!inTauri()) return;
    const nextWidth = Math.max(1, Math.ceil(width));
    const nextHeight = Math.max(1, Math.ceil(height));
    if (nextWidth === lastSize.width && nextHeight === lastSize.height) return;
    lastSize = { width: nextWidth, height: nextHeight };
    const { getCurrentWindow, LogicalSize } = await getWindowApi();
    await getCurrentWindow().setSize(new LogicalSize(nextWidth, nextHeight));
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
      const { getCurrentWindow } = await getWindowApi();
      const pos = await getCurrentWindow().outerPosition();
      savePosition({ x: pos.x, y: pos.y });
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
          if (!rememberPosition.value) return;
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
