import { inTauri } from '../services/tauri';
import { tauriInvoke } from '../services/tauri/core';

type DebugConsole = {
  log: (...args: unknown[]) => void;
  warn: (...args: unknown[]) => void;
  error: (...args: unknown[]) => void;
};

type LogLevel = 'log' | 'warn' | 'error';

function safeConsole(method: LogLevel, args: unknown[]) {
  if (typeof console === 'undefined') return;
  const fn = console[method];
  if (typeof fn !== 'function') return;
  fn(...args);
}

function serializeArg(arg: unknown, seen: WeakSet<object>): string {
  if (arg instanceof Error) {
    return JSON.stringify({ name: arg.name, message: arg.message, stack: arg.stack });
  }
  if (typeof arg === 'string') return arg;
  if (typeof arg === 'number' || typeof arg === 'boolean' || typeof arg === 'bigint') return String(arg);
  if (arg == null) return String(arg);
  if (typeof arg === 'object') {
    if (seen.has(arg)) {
      return '[Circular]';
    }
    seen.add(arg);
    try {
      return JSON.stringify(arg);
    } catch {
      return '[Unserializable]';
    } finally {
      seen.delete(arg);
    }
  }
  if (typeof arg === 'function') {
    return `[Function${arg.name ? `: ${arg.name}` : ''}]`;
  }
  return String(arg);
}

function serializeArgs(args: unknown[]): string {
  const seen = new WeakSet<object>();
  return args.map(arg => serializeArg(arg, seen)).join(' ');
}

async function sendToBackend(level: LogLevel, message: string) {
  if (!inTauri()) return false;
  try {
    await tauriInvoke<void>('debug_log', { level, message });
    return true;
  } catch {
    return false;
  }
}

function emit(level: LogLevel, args: unknown[]) {
  const message = serializeArgs(args);
  void sendToBackend(level, message).then(sent => {
    if (!sent) {
      safeConsole(level, args);
    }
  });
}

export const debugConsole: DebugConsole = {
  log: (...args: unknown[]) => emit('log', args),
  warn: (...args: unknown[]) => emit('warn', args),
  error: (...args: unknown[]) => emit('error', args)
};
