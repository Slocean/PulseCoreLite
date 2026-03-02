import { onMounted, onUnmounted } from 'vue';

import { useConfirmDialog } from '../services/dialogService';
import { matchesHotkeyEvent } from '../utils/hotkey';

interface AppStoreLike {
  settings: {
    factoryResetHotkey: string | null;
  };
  factoryReset: () => void;
  uninstallApp: (title: string, message: string) => Promise<void>;
}

interface UseFactoryResetOptions {
  store: AppStoreLike;
  t: (key: string) => string;
}

export function useFactoryReset(options: UseFactoryResetOptions) {
  const { store, t } = options;
  const { open: factoryResetDialogOpen, request: requestFactoryResetConfirm, resolve } =
    useConfirmDialog('factory-reset');

  function resolveFactoryReset(value: boolean) {
    resolve(value);
  }

  async function confirmFactoryReset(): Promise<boolean> {
    if (typeof window === 'undefined') return false;
    return await requestFactoryResetConfirm();
  }

  async function handleFactoryReset() {
    const confirmed = await confirmFactoryReset();
    if (!confirmed) {
      return;
    }
    store.factoryReset();
  }

  async function handleUninstall() {
    await store.uninstallApp(t('overlay.uninstallTitle'), t('overlay.uninstallConfirm'));
  }

  function shouldIgnoreHotkeyTarget(target: EventTarget | null): boolean {
    const el = target as HTMLElement | null;
    if (!el) return false;
    return Boolean(el.closest('input, textarea, select, [contenteditable="true"]'));
  }

  const hotkeyHandler = (event: KeyboardEvent) => {
    const hotkey = store.settings.factoryResetHotkey;
    if (!hotkey || shouldIgnoreHotkeyTarget(event.target)) {
      return;
    }
    if (!matchesHotkeyEvent(event, hotkey)) {
      return;
    }
    event.preventDefault();
    event.stopPropagation();
    void handleFactoryReset();
  };

  onMounted(() => {
    if (typeof window === 'undefined') {
      return;
    }
    window.addEventListener('keydown', hotkeyHandler);
  });

  onUnmounted(() => {
    if (typeof window === 'undefined') {
      return;
    }
    window.removeEventListener('keydown', hotkeyHandler);
  });

  return {
    factoryResetDialogOpen,
    resolveFactoryReset,
    handleFactoryReset,
    handleUninstall
  };
}
