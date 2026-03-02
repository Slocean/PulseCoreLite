<template></template>

<script setup lang="ts">
import { useI18n } from 'vue-i18n';

import { buildTaskbarMenuItems, type TaskbarMenuItemDescriptor } from '@/components/taskbar/buildTaskbarMenuItems';
import type { TaskbarPrefs } from '../composables/useTaskbarPrefs';
import { inTauri } from '../services/tauri';
import { useAppStore } from '../stores/app';

const props = defineProps<{
  alwaysOnTop: boolean;
  autoHideOnFullscreen: boolean;
  rememberPosition: boolean;
  positionLocked: boolean;
  prefs: TaskbarPrefs;
  showMainWindow: () => Promise<void>;
  hideMainWindow: () => Promise<void>;
  applyTaskbarTopmost: (enabled: boolean) => Promise<void>;
  pauseTopmostGuard: () => void;
  resumeTopmostGuard: () => void;
}>();

const store = useAppStore();
const { t } = useI18n();

async function createNativeMenuItems(
  descriptors: TaskbarMenuItemDescriptor[],
  input: {
    MenuItem: { new: (options: { text: string; action: () => void }) => Promise<any> };
    CheckMenuItem: { new: (options: { text: string; checked: boolean; action: () => void }) => Promise<any> };
    PredefinedMenuItem: { new: (options: { item: 'Separator' }) => Promise<any> };
  }
) {
  const items: any[] = [];
  for (const descriptor of descriptors) {
    if (descriptor.kind === 'separator') {
      items.push(await input.PredefinedMenuItem.new({ item: 'Separator' }));
      continue;
    }
    if (descriptor.kind === 'check') {
      items.push(
        await input.CheckMenuItem.new({
          text: descriptor.text,
          checked: descriptor.checked,
          action: () => void descriptor.onTrigger()
        })
      );
      continue;
    }
    items.push(
      await input.MenuItem.new({
        text: descriptor.text,
        action: () => void descriptor.onTrigger()
      })
    );
  }
  return items;
}

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

    const descriptors = buildTaskbarMenuItems({
      mainVisible,
      alwaysOnTop: props.alwaysOnTop,
      autoHideOnFullscreen: props.autoHideOnFullscreen,
      rememberPosition: props.rememberPosition,
      positionLocked: props.positionLocked,
      prefs: props.prefs,
      labels: {
        openMainWindow: t('overlay.openMainWindow'),
        hideMainWindow: t('overlay.hideMainWindow'),
        alwaysOnTop: t('overlay.alwaysOnTop'),
        taskbarFullscreenAutoHide: t('overlay.taskbarFullscreenAutoHide'),
        rememberPosition: t('overlay.rememberPosition'),
        lockTaskbarPosition: t('overlay.lockTaskbarPosition'),
        unlockTaskbarPosition: t('overlay.unlockTaskbarPosition'),
        taskbarTwoLine: t('overlay.taskbarTwoLine'),
        cpu: t('overlay.cpu'),
        gpu: t('overlay.gpu'),
        memory: t('overlay.memory'),
        app: t('overlay.app'),
        down: t('overlay.down'),
        up: t('overlay.up'),
        closeTaskbarMonitor: t('overlay.closeTaskbarMonitor')
      },
      actions: {
        toggleMainWindow: isMainVisible => (isMainVisible ? props.hideMainWindow() : props.showMainWindow()),
        toggleAlwaysOnTop: async next => {
          store.setTaskbarAlwaysOnTop(next);
          await props.applyTaskbarTopmost(next);
        },
        toggleAutoHideOnFullscreen: next => store.setTaskbarAutoHideOnFullscreen(next),
        toggleRememberPosition: next => store.setRememberOverlayPosition(next),
        togglePositionLocked: next => store.setTaskbarPositionLocked(next),
        toggleTwoLineMode: next => {
          props.prefs.twoLineMode = next;
        },
        toggleShowCpu: next => {
          props.prefs.showCpu = next;
        },
        toggleShowGpu: next => {
          props.prefs.showGpu = next;
        },
        toggleShowMemory: next => {
          props.prefs.showMemory = next;
        },
        toggleShowApp: next => {
          props.prefs.showApp = next;
        },
        toggleShowDown: next => {
          props.prefs.showDown = next;
        },
        toggleShowUp: next => {
          props.prefs.showUp = next;
        },
        closeTaskbarMonitor: async () => {
          await store.setTaskbarMonitorEnabled(false);
          try {
            await getCurrentWindow().close();
          } catch {
            // ignore
          }
        }
      }
    });

    const items = await createNativeMenuItems(descriptors, { MenuItem, CheckMenuItem, PredefinedMenuItem });

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
