import { onMounted, onUnmounted, ref, watch, type Ref } from 'vue';

import { inTauri } from '../services/tauri';
import { storageKeys } from '../services/storageRepository';
import { useWindowPositioningCore } from './useWindowPositioningCore';

interface UseOverlayWindowOptions {
  allowDrag: Ref<boolean>;
  rememberPosition: Ref<boolean>;
}

export function useOverlayWindow({ allowDrag, rememberPosition }: UseOverlayWindowOptions) {
  const overlayRef = ref<HTMLElement | null>(null);
  let resizeObserver: ResizeObserver | undefined;
  let moveUnlisten: (() => void) | undefined;

  const core = useWindowPositioningCore({
    rememberPosition,
    storageKey: storageKeys.overlayPosition,
    visibleMargins: { x: 72, y: 48 },
    minVisibleArea: 320 * 180
  });

  const resizeScheduler = core.createFrameScheduler(async () => {
    const element = overlayRef.value;
    if (!element) {
      return;
    }
    const rect = element.getBoundingClientRect();
    await core.setWindowSize(rect.width, rect.height);
  });

  const moveScheduler = core.createFrameScheduler(async () => {
    const pos = await core.getCurrentPosition();
    core.savePosition(pos);
  });

  watch(
    rememberPosition,
    enabled => {
      core.resetPositionCache();
      if (!enabled) {
        core.clearSavedPosition();
      }
    },
    { immediate: true }
  );

  const startDragging = async () => {
    if (!inTauri()) {
      return;
    }
    const { getCurrentWindow } = await core.getWindowApi();
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

    if (rememberPosition.value) {
      void core.restorePosition();
    }

    void core.listenMoved(() => {
      if (!rememberPosition.value) {
        return;
      }
      moveScheduler.schedule();
    }).then(unlisten => {
      moveUnlisten = unlisten;
    });

    const element = overlayRef.value;
    if (!element || typeof ResizeObserver === 'undefined') {
      return;
    }
    resizeObserver = new ResizeObserver(() => {
      resizeScheduler.schedule();
    });
    resizeObserver.observe(element);
    resizeScheduler.schedule();
  });

  onUnmounted(() => {
    if (inTauri() && rememberPosition.value) {
      void (async () => {
        try {
          const pos = await core.getCurrentPosition();
          core.savePosition(pos);
        } catch {
          // best-effort; ignore
        }
      })();
    }

    if (resizeObserver && overlayRef.value) {
      resizeObserver.unobserve(overlayRef.value);
    }
    resizeObserver = undefined;

    resizeScheduler.cancel();

    if (moveUnlisten) {
      moveUnlisten();
    }
    moveUnlisten = undefined;
    moveScheduler.cancel();
  });

  return { overlayRef, startDragging, handleOverlayMouseDown };
}
