export interface ToastProps {
  open?: boolean;
  message?: string;
  channel?: string;
  ariaLive?: "off" | "polite" | "assertive";
}
