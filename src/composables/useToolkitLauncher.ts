import { inTauri } from '../services/tauri';
import { ensureWindow } from '../services/windowManager';

export function useToolkitLauncher() {
  async function openToolkitWindow() {
    if (!inTauri()) {
      return;
    }
    const TOOLKIT_WIDTH = 300;
    try {
      await ensureWindow('toolkit', {
        url: 'toolkit.html',
        title: 'PulseCoreLite Toolkit',
        width: TOOLKIT_WIDTH,
        height: 400,
        minWidth: TOOLKIT_WIDTH,
        center: true,
        visible: true,
        focus: true,
        transparent: true,
        decorations: false,
        resizable: false,
        maximizable: false,
        minimizable: true,
        closable: true
      });
    } catch {}
  }

  return { openToolkitWindow };
}
