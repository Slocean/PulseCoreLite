import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { defineConfig } from 'vite';
import vue from '@vitejs/plugin-vue';

const DEFAULT_PORT = 9000;
const ROOT_DIR = dirname(fileURLToPath(import.meta.url));

function resolvePort(rawPort: string | undefined) {
  const parsed = Number(rawPort);
  if (Number.isInteger(parsed) && parsed > 0 && parsed < 65536) {
    return parsed;
  }
  return DEFAULT_PORT;
}

export default defineConfig({
  plugins: [vue()],
  build: {
    rollupOptions: {
      input: {
        main: resolve(ROOT_DIR, 'index.html'),
        taskbar: resolve(ROOT_DIR, 'taskbar.html'),
        toolkit: resolve(ROOT_DIR, 'toolkit.html')
      }
    }
  },
  server: {
    port: resolvePort(process.env.VITE_PORT),
    strictPort: process.env.VITE_STRICT_PORT === 'true'
  }
});
