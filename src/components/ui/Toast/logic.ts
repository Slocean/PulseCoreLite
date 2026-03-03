import type { ToastProps } from './types';

export interface ToastRenderState {
  open: boolean;
  message: string;
}

export function resolveToastRenderState(
  props: Pick<ToastProps, 'open' | 'message' | 'channel'>,
  serviceState: ToastRenderState
): ToastRenderState {
  if (props.channel) {
    return {
      open: Boolean(serviceState.open && serviceState.message),
      message: serviceState.message
    };
  }

  const message = props.message ?? '';
  return {
    open: Boolean(props.open && message),
    message
  };
}
