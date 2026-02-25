import { defineConfig } from 'vite';
import vue from '@vitejs/plugin-vue';

const DEFAULT_PORT = 9000;

function resolvePort(rawPort: string | undefined) {
  const parsed = Number(rawPort);
  if (Number.isInteger(parsed) && parsed > 0 && parsed < 65536) {
    return parsed;
  }
  return DEFAULT_PORT;
}

export default defineConfig({
  plugins: [vue()],
  server: {
    port: resolvePort(process.env.VITE_PORT),
    strictPort: process.env.VITE_STRICT_PORT === 'true'
  }
});
