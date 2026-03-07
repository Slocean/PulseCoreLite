import type { ToastProps, ToastVariant } from './types';

export interface ToastRenderState {
  open: boolean;
  message: string;
  variant: ToastVariant;
  closable: boolean;
  pinnable: boolean;
  durationMs?: number;
  pinned?: boolean;
}

export function resolveToastRenderState(
  props: Pick<ToastProps, 'open' | 'message' | 'channel' | 'variant' | 'closable' | 'durationMs' | 'pinnable'>,
  serviceState: ToastRenderState
): ToastRenderState {
  if (props.channel) {
    return {
      open: Boolean(serviceState.open && serviceState.message),
      message: serviceState.message,
      variant: serviceState.variant,
      closable: serviceState.closable,
      pinnable: serviceState.pinnable,
      durationMs: serviceState.durationMs,
      pinned: serviceState.pinned
    };
  }

  const message = props.message ?? '';
  return {
    open: Boolean(props.open && message),
    message,
    variant: props.variant ?? 'info',
    closable: props.closable ?? true,
    pinnable: props.pinnable ?? false,
    durationMs: props.durationMs,
    pinned: false
  };
}
