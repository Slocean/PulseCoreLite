export type CheckboxValue = string | number;
export type CheckboxModelValue = boolean | CheckboxValue[];

export interface CheckboxProps {
  modelValue: CheckboxModelValue;
  value?: CheckboxValue;
  disabled?: boolean;
}
