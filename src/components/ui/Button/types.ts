import type { ButtonPresetName } from './presets';

export type ButtonType = 'default' | 'primary' | 'danger' | 'ghost';
export type ButtonSize = 'sm' | 'md' | 'lg';
export type ButtonVariant = 'solid' | 'dashed' | 'text' | 'icon';

export type ButtonPreset = ButtonPresetName;

export interface ButtonProps {
  type?: ButtonType;
  size?: ButtonSize;
  variant?: ButtonVariant;
  preset?: ButtonPreset;
  width?: number | string;
  nativeType?: 'button' | 'submit' | 'reset';
  disabled?: boolean;
  loading?: boolean;
  active?: boolean;
}

