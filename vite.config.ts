import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { defineConfig, type PluginOption } from 'vite';
import vue from '@vitejs/plugin-vue';

const DEFAULT_PORT = 9000;
const ROOT_DIR = dirname(fileURLToPath(import.meta.url));
const ANALYZE_FLAG_VALUES = new Set(['1', 'true', 'yes', 'on']);

function resolvePort(rawPort: string | undefined) {
  const parsed = Number(rawPort);
  if (Number.isInteger(parsed) && parsed > 0 && parsed < 65536) {
    return parsed;
  }
  return DEFAULT_PORT;
}

function shouldAnalyze(mode: string) {
  if (mode === 'analyze') {
    return true;
  }
  const rawFlag = process.env.VITE_BUILD_ANALYZE?.trim().toLowerCase();
  return rawFlag ? ANALYZE_FLAG_VALUES.has(rawFlag) : false;
}

function resolveVendorChunk(id: string) {
  if (!id.includes('node_modules')) {
    return undefined;
  }
  if (id.includes('node_modules/vue')) {
    return 'vendor-vue';
  }
  if (id.includes('node_modules/pinia')) {
    return 'vendor-state';
  }
  if (id.includes('node_modules/vue-i18n')) {
    return 'vendor-i18n';
  }
  if (id.includes('node_modules/@tauri-apps')) {
    return 'vendor-tauri';
  }
  return 'vendor-misc';
}

function createBuildAnalyzePlugin(enabled: boolean): PluginOption {
  return {
    name: 'pulsecorelite-build-analyze',
    apply: 'build',
    generateBundle(_, bundle) {
      if (!enabled) {
        return;
      }
      const sizeRows = Object.entries(bundle)
        .filter(([, chunk]) => chunk.type === 'chunk')
        .map(([fileName, chunk]) => ({
          fileName,
          sizeKb: Math.round((chunk.code.length / 1024) * 100) / 100
        }))
        .sort((a, b) => b.sizeKb - a.sizeKb);

      if (sizeRows.length === 0) {
        return;
      }
      console.info('\n[pulsecorelite] Build analyze (chunk size KB)');
      for (const row of sizeRows) {
        console.info(`${row.fileName.padEnd(40, ' ')} ${row.sizeKb.toFixed(2)}`);
      }
    }
  };
}

export default defineConfig(({ mode }) => {
  const analyzeEnabled = shouldAnalyze(mode);

  return {
    plugins: [vue(), createBuildAnalyzePlugin(analyzeEnabled)],
    resolve: {
      alias: {
        '@': resolve(ROOT_DIR, 'src')
      }
    },
    build: {
      sourcemap: analyzeEnabled,
      rollupOptions: {
        input: {
          main: resolve(ROOT_DIR, 'index.html'),
          taskbar: resolve(ROOT_DIR, 'taskbar.html'),
          toolkit: resolve(ROOT_DIR, 'toolkit.html')
        },
        output: {
          manualChunks: resolveVendorChunk
        }
      }
    },
    server: {
      port: resolvePort(process.env.VITE_PORT),
      strictPort: process.env.VITE_STRICT_PORT === 'true'
    }
  };
});
