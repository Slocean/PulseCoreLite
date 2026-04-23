/**
 * 将 `src/config/index.ts` 中的 MAIN_WINDOW_WIDTH / MAIN_WINDOW_HEIGHT 同步到 tauri 主窗初始尺寸。
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.join(__dirname, '..');
const configPath = path.join(root, 'src', 'config', 'index.ts');
const tauriPath = path.join(root, 'src-tauri', 'tauri.conf.json');

const text = fs.readFileSync(configPath, 'utf8');
const w = Number(text.match(/export const MAIN_WINDOW_WIDTH = (\d+)/)?.[1]);
const h = Number(text.match(/export const MAIN_WINDOW_HEIGHT = (\d+)/)?.[1]);

if (!Number.isFinite(w) || w <= 0) {
  throw new Error('Could not parse MAIN_WINDOW_WIDTH from src/config/index.ts');
}
if (!Number.isFinite(h) || h <= 0) {
  throw new Error('Could not parse MAIN_WINDOW_HEIGHT from src/config/index.ts');
}

const conf = JSON.parse(fs.readFileSync(tauriPath, 'utf8'));
if (!conf.app?.windows?.[0]) {
  throw new Error('tauri.conf.json: app.windows[0] is missing');
}

if (conf.app.windows[0].width !== w || conf.app.windows[0].height !== h) {
  conf.app.windows[0].width = w;
  conf.app.windows[0].height = h;
  fs.writeFileSync(tauriPath, JSON.stringify(conf, null, 2) + '\n');
  console.log(`[sync:window-size] tauri main window: ${w}×${h}`);
}
