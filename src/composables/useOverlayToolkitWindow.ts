import { ref } from 'vue';

import { inTauri } from '../services/tauri';
import { closeWindow, getWindowByLabel, listenWindowDestroyed, showAndFocusWindow } from '../services/windowManager';

type ToolkitWindowState = 'closed' | 'open' | 'hidden';

interface UseOverlayToolkitWindowOptions {
  openToolkitWindow: () => Promise<void>;
}

export function useOverlayToolkitWindow(options: UseOverlayToolkitWindowOptions) {
  const { openToolkitWindow } = options;
  const toolkitState = ref<ToolkitWindowState>('closed');
  let unlistenToolkitDestroyed: (() => void) | null = null;

  function clearToolkitDestroyedListener() {
    if (!unlistenToolkitDestroyed) {
      return;
    }
    unlistenToolkitDestroyed();
    unlistenToolkitDestroyed = null;
  }

  async function ensureToolkitDestroyedListener() {
    if (!inTauri() || unlistenToolkitDestroyed) {
      return;
    }
    const unlisten = await listenWindowDestroyed('toolkit', () => {
      toolkitState.value = 'closed';
      clearToolkitDestroyedListener();
    });
    if (unlisten) {
      unlistenToolkitDestroyed = unlisten;
    }
  }

  async function refreshToolkitState() {
    if (!inTauri()) {
      toolkitState.value = 'closed';
      return;
    }
    const existing = await getWindowByLabel('toolkit');
    if (!existing) {
      clearToolkitDestroyedListener();
      toolkitState.value = 'closed';
      return;
    }
    await ensureToolkitDestroyedListener();
    let visible = true;
    try {
      visible = await existing.isVisible();
    } catch {
      // ignore
    }
    toolkitState.value = visible ? 'open' : 'hidden';
  }

  async function toggleToolkitWindow(forceOpen?: boolean) {
    if (!inTauri()) {
      return;
    }
    const existing = await getWindowByLabel('toolkit');
    if (existing) {
      await ensureToolkitDestroyedListener();
      let visible = true;
      try {
        visible = await existing.isVisible();
      } catch {
        // ignore
      }

      if (forceOpen === true) {
        await showAndFocusWindow('toolkit');
        toolkitState.value = 'open';
        return;
      }
      if (forceOpen === false) {
        await closeWindow('toolkit');
        toolkitState.value = 'closed';
        return;
      }
      if (visible) {
        await closeWindow('toolkit');
        toolkitState.value = 'closed';
        return;
      }
      await showAndFocusWindow('toolkit');
      toolkitState.value = 'open';
      return;
    }

    if (forceOpen === false) {
      toolkitState.value = 'closed';
      return;
    }
    await openToolkitWindow();
    await ensureToolkitDestroyedListener();
    await refreshToolkitState();
  }

  function dispose() {
    clearToolkitDestroyedListener();
  }

  return {
    toolkitState,
    refreshToolkitState,
    toggleToolkitWindow,
    dispose
  };
}
