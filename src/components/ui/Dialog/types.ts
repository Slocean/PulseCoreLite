export interface DialogProps {
  title: string;
  message?: string;
  confirmText?: string;
  cancelText?: string;
  closeLabel?: string;
  closeOnEsc?: boolean;
  closeOnConfirm?: boolean;
  autofocusConfirm?: boolean;
  showActions?: boolean;
}

export interface DialogActionSlotBindings {
  confirm: () => void;
  cancel: () => void;
}

export interface DialogSlots {
  body?: () => unknown;
  actions?: (bindings: DialogActionSlotBindings) => unknown;
}
