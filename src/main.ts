import { MAIN_WINDOW_WIDTH } from './config';
import App from './App.vue';
import { createPulseApp } from './entries/createPulseApp';
import './main.css';

if (typeof document !== 'undefined') {
  document.documentElement.style.setProperty('--pulse-main-window-width', `${MAIN_WINDOW_WIDTH}px`);
}

createPulseApp(App);
