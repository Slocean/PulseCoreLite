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

export interface DialogActionSlotBindings {
  confirm: () => void;
  cancel: () => void;
}

export interface DialogSlots {
  /**
   * Body content area.
   */
  body?: () => unknown;
  /**
   * Action area.
   * When provided, slot content should call either `confirm` or `cancel`
   * to preserve the same close semantics as the default action buttons.
   * Only rendered when `showActions` is true.
   */
  actions?: (bindings: DialogActionSlotBindings) => unknown;
}
