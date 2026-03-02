import { onMounted, onUnmounted, watch } from 'vue';

import { setI18nLanguage } from '../i18n';
import { useAppStore } from '../stores/app';
import type { AppSettings } from '../types';

type EntryLanguage = AppSettings['language'];

interface UseEntryBootstrapOptions {
  bootstrapStore?: boolean;
  disableContextMenu?: boolean;
  documentClassName?: string;
  afterBootstrap?: () => void | Promise<void>;
  resolveStaticLanguage?: () => EntryLanguage | null;
  shouldDisposeStore?: boolean;
}

const SUPPORTED_LANGUAGES: readonly EntryLanguage[] = ['zh-CN', 'en-US'];

function isEntryLanguage(value: unknown): value is EntryLanguage {
  return typeof value === 'string' && SUPPORTED_LANGUAGES.includes(value as EntryLanguage);
}

export function useEntryBootstrap(options: UseEntryBootstrapOptions = {}) {
  const bootstrapStore = options.bootstrapStore ?? true;
  const shouldDisposeStore = options.shouldDisposeStore ?? true;
  const needsStore = bootstrapStore || shouldDisposeStore;
  const store = needsStore ? useAppStore() : null;
  let contextMenuHandler: ((event: MouseEvent) => void) | null = null;
  let stopLanguageWatch: (() => void) | null = null;

  onMounted(async () => {
    if (typeof document !== 'undefined' && options.documentClassName) {
      document.documentElement.classList.add(options.documentClassName);
    }

    if (options.disableContextMenu && typeof window !== 'undefined') {
      contextMenuHandler = event => event.preventDefault();
      window.addEventListener('contextmenu', contextMenuHandler, true);
    }

    if (bootstrapStore && store) {
      await store.bootstrap();
      await setI18nLanguage(store.settings.language);
      stopLanguageWatch = watch(
        () => store.settings.language,
        language => {
          void setI18nLanguage(language);
        }
      );
      await options.afterBootstrap?.();
      return;
    }

    const language = options.resolveStaticLanguage?.();
    if (isEntryLanguage(language)) {
      await setI18nLanguage(language);
    }
  });

  onUnmounted(() => {
    if (typeof document !== 'undefined' && options.documentClassName) {
      document.documentElement.classList.remove(options.documentClassName);
    }

    if (typeof window !== 'undefined' && contextMenuHandler) {
      window.removeEventListener('contextmenu', contextMenuHandler, true);
      contextMenuHandler = null;
    }

    if (stopLanguageWatch) {
      stopLanguageWatch();
      stopLanguageWatch = null;
    }

    if (shouldDisposeStore && store) {
      store.dispose();
    }
  });
}
