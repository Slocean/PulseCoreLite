import { inTauri, listenEvent } from './tauri';

const DEFAULT_WINDOW_LABELS = ['main', 'taskbar', 'toolkit'];

interface EmitSyncOptions {
  labels?: string[];
  includeCurrent?: boolean;
}

export async function emitSyncEvent<TPayload = null>(
  eventName: string,
  payload: TPayload,
  options: EmitSyncOptions = {}
) {
  if (!inTauri()) {
    return;
  }
  try {
    const [{ getCurrentWindow }, { WebviewWindow }] = await Promise.all([
      import('@tauri-apps/api/window'),
      import('@tauri-apps/api/webviewWindow')
    ]);
    const currentWindow = getCurrentWindow();
    const labels = options.labels ?? DEFAULT_WINDOW_LABELS;
    const filteredLabels = options.includeCurrent
      ? labels
      : labels.filter(label => label !== currentWindow.label);
    const existingLabels = await Promise.all(
      filteredLabels.map(async label => {
        try {
          return (await WebviewWindow.getByLabel(label)) ? label : null;
        } catch {
          return null;
        }
      })
    );
    await Promise.allSettled(
      existingLabels
        .filter((label): label is string => label != null)
        .map(label => currentWindow.emitTo(label, eventName, payload))
    );
  } catch {
    // ignore sync bus failures
  }
}

export async function listenSyncEvent<TPayload = null>(
  eventName: string,
  handler: (payload: TPayload) => void | Promise<void>
) {
  if (!inTauri()) {
    return () => undefined;
  }
  return await listenEvent<TPayload>(eventName, handler);
}
