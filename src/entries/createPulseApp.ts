import { createPinia } from 'pinia';
import { createApp, type Component } from 'vue';

import i18n from '../i18n';
import '@fontsource/inter/400.css';
import '@fontsource/inter/600.css';
import '@fontsource/inter/700.css';
import '@fontsource/jetbrains-mono/400.css';
import '@fontsource/material-symbols-outlined';

export function createPulseApp(rootComponent: Component, mountSelector = '#app') {
  return createApp(rootComponent).use(createPinia()).use(i18n).mount(mountSelector);
}
