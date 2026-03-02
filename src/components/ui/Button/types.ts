export type ButtonType = 'default' | 'primary' | 'danger' | 'ghost';
export type ButtonSize = 'sm' | 'md' | 'lg';
export type ButtonVariant = 'solid' | 'dashed' | 'text' | 'icon';
export type ButtonPreset =
  | 'default'
  | 'overlay-chip'
  | 'overlay-chip-soft'
  | 'overlay-chip-tab'
  | 'overlay-chip-action'
  | 'overlay-primary'
  | 'overlay-danger'
  | 'overlay-action-info'
  | 'overlay-action-primary'
  | 'overlay-action-danger'
  | 'overlay-version'
  | 'overlay-dialog-close'
  | 'overlay-corner-danger'
  | 'overlay-corner-primary'
  | 'toolkit-tab'
  | 'toolkit-collapse'
  | 'toolkit-collapse-title'
  | 'toolkit-collapse-icon'
  | 'toolkit-view-toggle'
  | 'toolkit-link'
  | 'ui-dialog-close'
  | 'ui-dialog-cancel'
  | 'ui-dialog-confirm';

export interface ButtonProps {
  type?: ButtonType;
  size?: ButtonSize;
  variant?: ButtonVariant;
  preset?: ButtonPreset;
  nativeType?: 'button' | 'submit' | 'reset';
  disabled?: boolean;
  loading?: boolean;
  active?: boolean;
}
