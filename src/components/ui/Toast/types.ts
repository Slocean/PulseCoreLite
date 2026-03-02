export interface ToastProps {
  open: boolean;
  message: string;
  ariaLive?: "off" | "polite" | "assertive";
}
