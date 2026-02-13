import { onMounted, onUnmounted, ref, type Ref } from 'vue';

import { inTauri } from '../services/tauri';

const OVERLAY_POS_KEY = 'pulsecorelite.overlay_pos';

interface UseOverlayWindowOptions {
  allowDrag: Ref<boolean>;
}

export function useOverlayWindow({ allowDrag }: UseOverlayWindowOptions) {
  const overlayRef = ref<HTMLElement | null>(null);
  let resizeObserver: ResizeObserver | undefined;
  let resizeFrame: number | undefined;
  let lastSize = { width: 0, height: 0 };
  let windowApiPromise: Promise<typeof import('@tauri-apps/api/window')> | undefined;
  let moveUnlisten: (() => void) | undefined;
  let moveFrame: number | undefined;
  let lastPosition = { x: 0, y: 0 };

  const loadPosition = () => {
    try {
      const raw = localStorage.getItem(OVERLAY_POS_KEY);
      if (!raw) {
        return null;
      }
      const parsed = JSON.parse(raw) as { x?: number; y?: number };
      if (typeof parsed.x !== 'number' || typeof parsed.y !== 'number') {
        return null;
      }
      return { x: parsed.x, y: parsed.y };
    } catch {
      return null;
    }
  };

  const savePosition = (next: { x: number; y: number }) => {
    if (next.x === lastPosition.x && next.y === lastPosition.y) {
      return;
    }
    lastPosition = next;
    localStorage.setItem(OVERLAY_POS_KEY, JSON.stringify(next));
  };

  const getWindowApi = async () => {
    if (!windowApiPromise) {
      windowApiPromise = import('@tauri-apps/api/window');
    }
    return windowApiPromise;
  };

  const applyWindowSize = async (width: number, height: number) => {
    if (!inTauri()) {
      return;
    }
    const nextWidth = Math.max(1, Math.ceil(width));
    const nextHeight = Math.max(1, Math.ceil(height));
    if (nextWidth === lastSize.width && nextHeight === lastSize.height) {
      return;
    }
    lastSize = { width: nextWidth, height: nextHeight };
    const { getCurrentWindow, LogicalSize } = await getWindowApi();
    await getCurrentWindow().setSize(new LogicalSize(nextWidth, nextHeight));
  };

  const restorePosition = async () => {
    const saved = loadPosition();
    if (!saved) {
      return;
    }
    const { getCurrentWindow, LogicalPosition } = await getWindowApi();
    await getCurrentWindow().setPosition(new LogicalPosition(saved.x, saved.y));
  };

  const schedulePositionSave = () => {
    if (moveFrame != null) {
      return;
    }
    moveFrame = window.requestAnimationFrame(async () => {
      moveFrame = undefined;
      const { getCurrentWindow } = await getWindowApi();
      const pos = await getCurrentWindow().outerPosition();
      savePosition({ x: pos.x, y: pos.y });
    });
  };

  const scheduleResize = () => {
    if (resizeFrame != null) {
      return;
    }
    resizeFrame = window.requestAnimationFrame(() => {
      resizeFrame = undefined;
      const element = overlayRef.value;
      if (!element) {
        return;
      }
      const rect = element.getBoundingClientRect();
      void applyWindowSize(rect.width, rect.height);
    });
  };

  const startDragging = async () => {
    if (!inTauri()) {
      return;
    }
    const { getCurrentWindow } = await getWindowApi();
    await getCurrentWindow().startDragging();
  };

  const handleOverlayMouseDown = (event: MouseEvent) => {
    if (allowDrag.value) {
      return;
    }
    const target = event.target as HTMLElement | null;
    if (!target) {
      return;
    }
    if (target.closest('.overlay-header-actions')) {
      return;
    }
    if (target.closest('button, input, select, textarea, label, .overlay-config')) {
      return;
    }
    void startDragging();
  };

  onMounted(() => {
    if (!inTauri()) {
      return;
    }
    void restorePosition();
    void getWindowApi()
      .then(({ getCurrentWindow }) =>
        getCurrentWindow().onMoved(() => {
          schedulePositionSave();
        })
      )
      .then(unlisten => {
        moveUnlisten = unlisten;
      });

    const element = overlayRef.value;
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
    if (resizeObserver && overlayRef.value) {
      resizeObserver.unobserve(overlayRef.value);
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

  return { overlayRef, startDragging, handleOverlayMouseDown };
}
