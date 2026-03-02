import type { Ref } from 'vue';

import { storageRepository } from '../services/storageRepository';

type WindowApiModule = typeof import('@tauri-apps/api/window');

export type WindowPosition = { x: number; y: number };
export type WindowSize = { width: number; height: number };
export type MonitorRect = { left: number; top: number; right: number; bottom: number };
export type WindowFrameInsets = { top: number; bottom: number };
export type VisibleMargins = { x: number; y: number };

interface UseWindowPositioningCoreOptions {
  rememberPosition: Ref<boolean>;
  storageKey: string;
  visibleMargins?: VisibleMargins;
  minVisibleArea?: number;
  resolveFrameInsets?: (
    windowApi: WindowApiModule,
    outerSize: WindowSize
  ) => Promise<WindowFrameInsets> | WindowFrameInsets;
}

const DEFAULT_VISIBLE_MARGINS: VisibleMargins = { x: 72, y: 48 };
const DEFAULT_MIN_VISIBLE_AREA = 320 * 180;

export function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

export function toMonitorRect(monitor: {
  position: { x: number; y: number };
  size: { width: number; height: number };
}): MonitorRect {
  return {
    left: monitor.position.x,
    top: monitor.position.y,
    right: monitor.position.x + monitor.size.width,
    bottom: monitor.position.y + monitor.size.height
  };
}

export function intersectionArea(a: MonitorRect, b: MonitorRect): number {
  const width = Math.min(a.right, b.right) - Math.max(a.left, b.left);
  const height = Math.min(a.bottom, b.bottom) - Math.max(a.top, b.top);
  if (width <= 0 || height <= 0) {
    return 0;
  }
  return width * height;
}

export function getVerticalFrameInsets(outerHeight: number, innerHeight: number): WindowFrameInsets {
  const frame = Math.max(0, outerHeight - innerHeight);
  const top = Math.floor(frame / 2);
  return { top, bottom: frame - top };
}

export function pickBestMonitorRect(
  position: WindowPosition,
  windowSize: WindowSize,
  monitorRects: MonitorRect[],
  minVisibleArea = DEFAULT_MIN_VISIBLE_AREA
): MonitorRect {
  const windowRect: MonitorRect = {
    left: position.x,
    top: position.y,
    right: position.x + windowSize.width,
    bottom: position.y + windowSize.height
  };

  const bestVisible = monitorRects
    .map((rect, index) => ({ index, area: intersectionArea(windowRect, rect) }))
    .sort((a, b) => b.area - a.area)[0];

  const hasEnoughVisibleArea =
    bestVisible.area >= Math.min(windowSize.width * windowSize.height * 0.2, minVisibleArea);
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
}

function clampAxisWithMargin(
  pos: number,
  size: number,
  start: number,
  total: number,
  visibleMargin: number
): number {
  const end = start + total;
  if (size <= total) {
    return clamp(pos, start, end - size);
  }
  return clamp(pos, start - size + visibleMargin, end - visibleMargin);
}

export function clampPositionToMonitor(
  position: WindowPosition,
  windowSize: WindowSize,
  monitor: MonitorRect,
  visibleMargins: VisibleMargins = DEFAULT_VISIBLE_MARGINS,
  frameInsets: WindowFrameInsets = { top: 0, bottom: 0 }
): WindowPosition {
  const monitorWidth = monitor.right - monitor.left;
  const monitorHeight = monitor.bottom - monitor.top;

  return {
    x: Math.round(clampAxisWithMargin(position.x, windowSize.width, monitor.left, monitorWidth, visibleMargins.x)),
    y: Math.round(
      clampAxisWithMargin(
        position.y,
        windowSize.height,
        monitor.top - frameInsets.top,
        monitorHeight + frameInsets.top + frameInsets.bottom,
        visibleMargins.y
      )
    )
  };
}

export function useWindowPositioningCore(options: UseWindowPositioningCoreOptions) {
  const {
    rememberPosition,
    storageKey,
    visibleMargins = DEFAULT_VISIBLE_MARGINS,
    minVisibleArea = DEFAULT_MIN_VISIBLE_AREA,
    resolveFrameInsets
  } = options;

  let windowApiPromise: Promise<WindowApiModule> | undefined;
  let lastPosition: WindowPosition | null = null;
  let lastSize = { width: 0, height: 0 };

  const getWindowApi = async () => {
    if (!windowApiPromise) {
      windowApiPromise = import('@tauri-apps/api/window');
    }
    return windowApiPromise;
  };

  const loadPosition = (): WindowPosition | null => {
    if (!rememberPosition.value) {
      return null;
    }
    const parsed = storageRepository.getJsonSync<{ x?: number; y?: number }>(storageKey);
    if (!parsed) {
      return null;
    }
    if (typeof parsed.x !== 'number' || typeof parsed.y !== 'number') {
      return null;
    }
    return { x: parsed.x, y: parsed.y };
  };

  const clearSavedPosition = () => {
    storageRepository.removeSync(storageKey);
  };

  const resetPositionCache = () => {
    lastPosition = null;
  };

  const savePosition = (next: WindowPosition) => {
    if (!rememberPosition.value) {
      return;
    }
    if (lastPosition && next.x === lastPosition.x && next.y === lastPosition.y) {
      return;
    }
    lastPosition = next;
    storageRepository.setJsonSync(storageKey, next);
  };

  const resolveSafePosition = async (saved: WindowPosition): Promise<WindowPosition> => {
    const windowApi = await getWindowApi();
    const { availableMonitors, getCurrentWindow } = windowApi;
    const monitors = await availableMonitors();
    if (monitors.length === 0) {
      return saved;
    }

    const win = getCurrentWindow();
    const outerSize = await win.outerSize();
    const monitorRects = monitors.map(toMonitorRect);
    const targetMonitor = pickBestMonitorRect(saved, outerSize, monitorRects, minVisibleArea);
    const frameInsets = resolveFrameInsets ? await resolveFrameInsets(windowApi, outerSize) : { top: 0, bottom: 0 };

    return clampPositionToMonitor(saved, outerSize, targetMonitor, visibleMargins, frameInsets);
  };

  const restorePosition = async (): Promise<WindowPosition | null> => {
    const saved = loadPosition();
    if (!saved) {
      return null;
    }
    const safePosition = await resolveSafePosition(saved);
    savePosition(safePosition);

    const { getCurrentWindow, PhysicalPosition } = await getWindowApi();
    await getCurrentWindow().setPosition(new PhysicalPosition(safePosition.x, safePosition.y));
    return safePosition;
  };

  const getCurrentPosition = async (): Promise<WindowPosition> => {
    const { getCurrentWindow } = await getWindowApi();
    const pos = await getCurrentWindow().outerPosition();
    return { x: pos.x, y: pos.y };
  };

  const setCurrentPosition = async (position: WindowPosition) => {
    const { getCurrentWindow, PhysicalPosition } = await getWindowApi();
    await getCurrentWindow().setPosition(new PhysicalPosition(position.x, position.y));
  };

  const setWindowSize = async (width: number, height: number) => {
    const nextWidth = Math.max(1, Math.ceil(width));
    const nextHeight = Math.max(1, Math.ceil(height));
    if (nextWidth === lastSize.width && nextHeight === lastSize.height) {
      return;
    }
    lastSize = { width: nextWidth, height: nextHeight };

    const { getCurrentWindow, LogicalSize } = await getWindowApi();
    await getCurrentWindow().setSize(new LogicalSize(nextWidth, nextHeight));
  };

  const createFrameScheduler = (task: () => void | Promise<void>) => {
    let frame: number | null = null;
    const schedule = () => {
      if (frame != null) {
        return;
      }
      frame = window.requestAnimationFrame(() => {
        frame = null;
        void task();
      });
    };
    const cancel = () => {
      if (frame == null) {
        return;
      }
      window.cancelAnimationFrame(frame);
      frame = null;
    };
    return { schedule, cancel };
  };

  const listenMoved = async (handler: () => void | Promise<void>) => {
    const { getCurrentWindow } = await getWindowApi();
    return await getCurrentWindow().onMoved(() => {
      void handler();
    });
  };

  return {
    getWindowApi,
    loadPosition,
    clearSavedPosition,
    resetPositionCache,
    savePosition,
    resolveSafePosition,
    restorePosition,
    getCurrentPosition,
    setCurrentPosition,
    setWindowSize,
    createFrameScheduler,
    listenMoved
  };
}
