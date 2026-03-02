import { ref, type Ref } from 'vue';

interface ConfirmDialogState {
  open: Ref<boolean>;
  resolver: ((value: boolean) => void) | null;
}

const confirmDialogStates = new Map<string, ConfirmDialogState>();

function getConfirmDialogState(key: string): ConfirmDialogState {
  const existing = confirmDialogStates.get(key);
  if (existing) {
    return existing;
  }
  const created: ConfirmDialogState = {
    open: ref(false),
    resolver: null
  };
  confirmDialogStates.set(key, created);
  return created;
}

export function requestConfirmDialog(key: string): Promise<boolean> {
  const state = getConfirmDialogState(key);
  if (state.resolver) {
    state.resolver(false);
    state.resolver = null;
  }
  state.open.value = true;
  return new Promise<boolean>(resolve => {
    state.resolver = resolve;
  });
}

export function resolveConfirmDialog(key: string, value: boolean) {
  const state = getConfirmDialogState(key);
  state.open.value = false;
  const resolve = state.resolver;
  state.resolver = null;
  resolve?.(value);
}

export function useConfirmDialog(key: string) {
  const state = getConfirmDialogState(key);
  return {
    open: state.open,
    request: () => requestConfirmDialog(key),
    resolve: (value: boolean) => resolveConfirmDialog(key, value)
  };
}
