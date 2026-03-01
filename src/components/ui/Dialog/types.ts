export interface DialogProps {
  title: string;
  message?: string;
  confirmText?: string;
  cancelText?: string;
  closeLabel?: string;
  closeOnEsc?: boolean;
  autofocusConfirm?: boolean;
  showActions?: boolean;
}
