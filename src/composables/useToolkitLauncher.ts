import { inTauri } from '../services/tauri';

export function useToolkitLauncher() {
  async function openToolkitWindow() {
    if (!inTauri()) {
      return;
    }
    const TOOLKIT_WIDTH = 980;
    const TOOLKIT_HEIGHT = 820;
    try {
      const { WebviewWindow } = await import('@tauri-apps/api/webviewWindow');
      const { LogicalSize } = await import('@tauri-apps/api/dpi');
      const existing = await WebviewWindow.getByLabel('toolkit');
      if (existing) {
        const size = new LogicalSize(TOOLKIT_WIDTH, TOOLKIT_HEIGHT);
        await existing.setSize(size);
        try {
          await existing.setMinSize(size);
        } catch {
          // Fallback: setSize still works even if min-size permission is unavailable.
        }
        await existing.show();
        await existing.setFocus();
        return;
      }
      new WebviewWindow('toolkit', {
        url: 'index.html',
        title: 'PulseCoreLite Toolkit',
        // width: TOOLKIT_WIDTH,
        // height: TOOLKIT_HEIGHT,
        // minWidth: TOOLKIT_WIDTH,
        // minHeight: TOOLKIT_HEIGHT,
        center: true,
        visible: true,
        focus: true,
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
