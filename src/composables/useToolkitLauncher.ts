import { inTauri } from '../services/tauri';

export function useToolkitLauncher() {
  async function openToolkitWindow() {
    if (!inTauri()) {
      return;
    }
    const TOOLKIT_WIDTH = 260;
    try {
      const { WebviewWindow } = await import('@tauri-apps/api/webviewWindow');
      const { LogicalSize } = await import('@tauri-apps/api/dpi');
      const existing = await WebviewWindow.getByLabel('toolkit');
      if (existing) {
        await existing.show();
        await existing.setFocus();
        return;
      }
      new WebviewWindow('toolkit', {
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
