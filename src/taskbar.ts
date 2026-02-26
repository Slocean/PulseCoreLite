import { createApp } from 'vue';
import { createPinia } from 'pinia';

import TaskbarApp from './entries/TaskbarApp.vue';
import i18n from './i18n';
import '@fontsource/inter/400.css';
import '@fontsource/inter/500.css';
import '@fontsource/inter/600.css';
import '@fontsource/inter/700.css';
import '@fontsource/jetbrains-mono/400.css';
import '@fontsource/jetbrains-mono/500.css';
import '@fontsource/material-symbols-outlined';
import './taskbar.css';

createApp(TaskbarApp).use(createPinia()).use(i18n).mount('#app');
