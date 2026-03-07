export type ToastVariant = 'success' | 'primary' | 'info' | 'warning' | 'error';

export interface ToastProps {
  open?: boolean;
  message?: string;
  channel?: string;
  variant?: ToastVariant;
  closable?: boolean;
  pinnable?: boolean;
  durationMs?: number;
  ariaLive?: 'off' | 'polite' | 'assertive';
}
