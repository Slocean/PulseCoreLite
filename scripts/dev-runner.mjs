import net from 'node:net';
import { spawn } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const DEFAULT_PORT = 9000;
const MAX_SCAN_STEPS = 50;

function parsePort(rawPort) {
  const parsed = Number(rawPort);
  if (Number.isInteger(parsed) && parsed > 0 && parsed < 65536) {
    return parsed;
  }
  return DEFAULT_PORT;
}

function checkPortAvailable(port) {
  return new Promise((resolve) => {
    const server = net.createServer();
    server.once('error', () => resolve(false));
    server.once('listening', () => {
      server.close(() => resolve(true));
    });
    server.listen(port, '127.0.0.1');
  });
}

async function findOpenPort(startPort) {
  for (let offset = 0; offset <= MAX_SCAN_STEPS; offset += 1) {
    const candidate = startPort + offset;
    if (candidate >= 65536) {
      break;
    }
    // eslint-disable-next-line no-await-in-loop
    if (await checkPortAvailable(candidate)) {
      return candidate;
    }
  }
  throw new Error(`No available port found in range ${startPort}-${Math.min(startPort + MAX_SCAN_STEPS, 65535)}.`);
}

async function run() {
  const preferredPort = parsePort(process.env.VITE_PORT);
  const selectedPort = await findOpenPort(preferredPort);
  const devUrl = `http://localhost:${selectedPort}`;
  const extraArgs = process.argv.slice(2);

  if (selectedPort !== preferredPort) {
    console.log(`[dev-runner] Port ${preferredPort} is in use, switched to ${selectedPort}.`);
  } else {
    console.log(`[dev-runner] Using port ${selectedPort}.`);
  }

  const tauriConfig = JSON.stringify({
    build: {
      devUrl
    }
  });

  const tauriCliPath = fileURLToPath(new URL('../node_modules/@tauri-apps/cli/tauri.js', import.meta.url));
  const command = process.execPath;
  const args = [tauriCliPath, 'dev', '--config', tauriConfig, ...extraArgs];
  const childEnv = Object.fromEntries(
    Object.entries(process.env).filter(([key]) => !key.startsWith('='))
  );

  const child = spawn(command, args, {
    stdio: 'inherit',
    env: {
      ...childEnv,
      VITE_PORT: String(selectedPort),
      VITE_STRICT_PORT: 'true'
    }
  });

  child.on('exit', (code, signal) => {
    if (signal) {
      process.kill(process.pid, signal);
      return;
    }
    process.exit(code ?? 1);
  });

  child.on('error', (error) => {
    console.error('[dev-runner] Failed to start tauri dev:', error);
    process.exit(1);
  });
}

run().catch((error) => {
  console.error('[dev-runner] Failed to resolve development port:', error);
  process.exit(1);
});
