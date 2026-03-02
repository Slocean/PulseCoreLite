import { createI18n } from 'vue-i18n';

import type { AppLanguage } from '../types';
import zhCN from './locales/zh-CN.json';

interface LocaleMessages {
  [key: string]: string | LocaleMessages;
}

const FALLBACK_LOCALE: AppLanguage = 'en-US';
const DEFAULT_LOCALE: AppLanguage = 'zh-CN';
const localeLoaders: Record<AppLanguage, () => Promise<LocaleMessages>> = {
  'zh-CN': async () => zhCN as LocaleMessages,
  'en-US': async () => (await import('./locales/en-US.json')).default as LocaleMessages
};
const loadedLocales = new Set<AppLanguage>([DEFAULT_LOCALE]);

function missingKeyReporter(locale: string, key: string) {
  if (import.meta.env.DEV) {
    console.warn(`[i18n] Missing key "${key}" for locale "${locale}".`);
  }
  return key;
}

const i18n = createI18n({
  legacy: false,
  locale: DEFAULT_LOCALE,
  fallbackLocale: FALLBACK_LOCALE,
  messages: {
    'zh-CN': zhCN,
    'en-US': {}
  },
  missing: missingKeyReporter
});

export function isSupportedLocale(value: unknown): value is AppLanguage {
  return value === 'zh-CN' || value === 'en-US';
}

export async function ensureLocaleMessages(locale: AppLanguage) {
  if (loadedLocales.has(locale)) {
    return;
  }
  const loader = localeLoaders[locale];
  if (!loader) {
    return;
  }
  const messages = await loader();
  i18n.global.setLocaleMessage(locale, messages);
  loadedLocales.add(locale);
}

export async function setI18nLanguage(locale: AppLanguage) {
  await ensureLocaleMessages(locale);
  i18n.global.locale.value = locale;
}

export default i18n;
