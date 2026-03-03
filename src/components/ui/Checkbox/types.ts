export type CheckboxValue = string | number;
export type CheckboxModelValue = boolean | CheckboxValue[];

export interface CheckboxAccessibilityProps {
  ariaLabel?: string;
  ariaDescription?: string;
  describedBy?: string;
}

export interface CheckboxBaseProps {
  disabled?: boolean;
  inputId?: string;
  a11y?: CheckboxAccessibilityProps;
  ariaLabel?: string;
  ariaDescription?: string;
  describedBy?: string;
}

export interface CheckboxBooleanModelProps {
  modelValue: boolean;
  value?: never;
}

export interface CheckboxArrayModelProps<T extends CheckboxValue = CheckboxValue> {
  modelValue: T[];
  /**
   * Required when modelValue is an array.
   */
  value: T;
}

export type CheckboxProps<T extends CheckboxValue = CheckboxValue> = CheckboxBaseProps &
  (CheckboxBooleanModelProps | CheckboxArrayModelProps<T>);
