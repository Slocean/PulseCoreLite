<template></template>

<script setup lang="ts">
import { useI18n } from 'vue-i18n';

import type { TaskbarPrefs } from '../composables/useTaskbarPrefs';
import { inTauri } from '../services/tauri';
import { useAppStore } from '../stores/app';

const props = defineProps<{
  alwaysOnTop: boolean;
  rememberPosition: boolean;
  prefs: TaskbarPrefs;
  showMainWindow: () => Promise<void>;
  hideMainWindow: () => Promise<void>;
  applyTaskbarTopmost: (enabled: boolean) => Promise<void>;
  pauseTopmostGuard: () => void;
  resumeTopmostGuard: () => void;
}>();

const store = useAppStore();
const { t } = useI18n();

async function open(event: MouseEvent) {
  if (!inTauri()) {
    return;
  }

  props.pauseTopmostGuard();
  try {
    const [
      { Menu, CheckMenuItem, MenuItem, PredefinedMenuItem },
      { LogicalPosition },
      { getCurrentWindow },
      { WebviewWindow }
    ] = await Promise.all([
      import('@tauri-apps/api/menu'),
      import('@tauri-apps/api/dpi'),
      import('@tauri-apps/api/window'),
      import('@tauri-apps/api/webviewWindow')
    ]);

    let mainVisible = false;
    try {
      const mainWindow = await WebviewWindow.getByLabel('main');
      if (mainWindow) {
        mainVisible = await mainWindow.isVisible();
      }
    } catch {
      mainVisible = false;
    }

    const items = [
      await MenuItem.new({
        text: mainVisible ? t('overlay.hideMainWindow') : t('overlay.openMainWindow'),
        action: () => void (mainVisible ? props.hideMainWindow() : props.showMainWindow())
      }),
      await PredefinedMenuItem.new({ item: 'Separator' }),
      await CheckMenuItem.new({
        text: t('overlay.alwaysOnTop'),
        checked: props.alwaysOnTop,
        action: async () => {
          const next = !props.alwaysOnTop;
          store.setTaskbarAlwaysOnTop(next);
          await props.applyTaskbarTopmost(next);
        }
      }),
      await CheckMenuItem.new({
        text: t('overlay.rememberPosition'),
        checked: props.rememberPosition,
        action: () => store.setRememberOverlayPosition(!props.rememberPosition)
      }),
      await PredefinedMenuItem.new({ item: 'Separator' }),
      await CheckMenuItem.new({
        text: t('overlay.taskbarTwoLine'),
        checked: props.prefs.twoLineMode,
        action: () => (props.prefs.twoLineMode = !props.prefs.twoLineMode)
      }),
      await PredefinedMenuItem.new({ item: 'Separator' }),
      await CheckMenuItem.new({
        text: t('overlay.cpu'),
        checked: props.prefs.showCpu,
        action: () => (props.prefs.showCpu = !props.prefs.showCpu)
      }),
      await PredefinedMenuItem.new({ item: 'Separator' }),
      await CheckMenuItem.new({
        text: t('overlay.gpu'),
        checked: props.prefs.showGpu,
        action: () => (props.prefs.showGpu = !props.prefs.showGpu)
      }),
      await CheckMenuItem.new({
        text: t('overlay.memory'),
        checked: props.prefs.showMemory,
        action: () => (props.prefs.showMemory = !props.prefs.showMemory)
      }),
      await CheckMenuItem.new({
        text: t('overlay.app'),
        checked: props.prefs.showApp,
        action: () => (props.prefs.showApp = !props.prefs.showApp)
      }),
      await PredefinedMenuItem.new({ item: 'Separator' }),
      await CheckMenuItem.new({
        text: t('overlay.down'),
        checked: props.prefs.showDown,
        action: () => (props.prefs.showDown = !props.prefs.showDown)
      }),
      await CheckMenuItem.new({
        text: t('overlay.up'),
        checked: props.prefs.showUp,
        action: () => (props.prefs.showUp = !props.prefs.showUp)
      }),
      await PredefinedMenuItem.new({ item: 'Separator' }),
      await MenuItem.new({
        text: t('overlay.closeTaskbarMonitor'),
        action: async () => {
          await store.setTaskbarMonitorEnabled(false);
          try {
            await getCurrentWindow().close();
          } catch {}
        }
      })
    ];

    const menu = await Menu.new({ items });
    await menu.popup(new LogicalPosition(event.clientX, event.clientY), getCurrentWindow());
  } finally {
    window.setTimeout(() => {
      props.resumeTopmostGuard();
    }, 100);
  }
}

defineExpose({ open });
</script>
