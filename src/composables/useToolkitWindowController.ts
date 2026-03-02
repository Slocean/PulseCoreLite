import { nextTick, onBeforeUnmount, onMounted, type Ref } from 'vue';

import { inTauri } from '../services/tauri';

const TOOLKIT_WIDTH = 300;

type UseToolkitWindowControllerOptions = {
  pageRef: Readonly<Ref<HTMLElement | null>>;
};

export function useToolkitWindowController({ pageRef }: UseToolkitWindowControllerOptions) {
  let resizeObserver: ResizeObserver | undefined;
  let resizeFrame: number | undefined;
  let lastHeight = 0;
  let windowApiPromise: Promise<typeof import('@tauri-apps/api/window')> | undefined;

  const getWindowApi = async () => {
    if (!windowApiPromise) {
      windowApiPromise = import('@tauri-apps/api/window');
    }
    return windowApiPromise;
  };

  function scheduleResize() {
    if (resizeFrame != null) return;
    resizeFrame = window.requestAnimationFrame(() => {
      resizeFrame = undefined;
      void updateWindowHeight();
    });
  }

  async function updateWindowHeight() {
    if (!inTauri()) return;
    try {
      const { getCurrentWindow } = await getWindowApi();
      const { LogicalSize } = await import('@tauri-apps/api/dpi');
      const content = pageRef.value ?? (document.querySelector('.toolkit-page') as HTMLElement | null);
      const rect = content ? content.getBoundingClientRect() : document.body.getBoundingClientRect();
      const height = Math.max(1, Math.ceil(rect.height));
      if (Math.abs(height - lastHeight) < 2) {
        return;
      }
      lastHeight = height;
      await getCurrentWindow().setSize(new LogicalSize(TOOLKIT_WIDTH, height));
    } catch {
      // ignore
    }
  }

  async function closeToolkitWindow() {
    if (!inTauri()) return;
    try {
      const { getCurrentWindow } = await import('@tauri-apps/api/window');
      await getCurrentWindow().close();
    } catch {
      // ignore
    }
  }

  async function minimizeToolkitWindow() {
    if (!inTauri()) return;
    try {
      const { getCurrentWindow } = await import('@tauri-apps/api/window');
      await getCurrentWindow().minimize();
    } catch {
      // ignore
    }
  }

  async function startDragging() {
    if (!inTauri()) return;
    try {
      const { getCurrentWindow } = await import('@tauri-apps/api/window');
      await getCurrentWindow().startDragging();
    } catch {
      // ignore
    }
  }

  function handleToolkitMouseDown(event: MouseEvent) {
    const target = event.target as HTMLElement | null;
    if (!target) return;
    if (target.closest('.overlay-header-actions')) return;
    if (target.closest('.toolkit-tabs, .toolkit-card')) return;
    if (target.closest('button, input, select, textarea, label, .overlay-config')) return;
    void startDragging();
  }

  function notifyContentChange() {
    nextTick(scheduleResize);
  }

  onMounted(() => {
    if (typeof ResizeObserver !== 'undefined') {
      resizeObserver = new ResizeObserver(() => {
        scheduleResize();
      });
      if (pageRef.value) {
        resizeObserver.observe(pageRef.value);
      }
    }
    setTimeout(scheduleResize, 100);
  });

  onBeforeUnmount(() => {
    if (resizeObserver && pageRef.value) {
      resizeObserver.unobserve(pageRef.value);
    }
    resizeObserver = undefined;
    if (resizeFrame != null) {
      window.cancelAnimationFrame(resizeFrame);
    }
  });

  return {
    scheduleResize,
    notifyContentChange,
    handleToolkitMouseDown,
    startDragging,
    closeToolkitWindow,
    minimizeToolkitWindow
  };
}
