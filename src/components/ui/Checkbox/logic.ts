import type { CheckboxModelValue, CheckboxValue } from './types';

export function isCheckboxChecked(modelValue: CheckboxModelValue, value?: CheckboxValue): boolean {
  if (Array.isArray(modelValue)) {
    return value !== undefined && modelValue.includes(value);
  }
  return modelValue === true;
}

export function createNextCheckboxModelValue(
  modelValue: CheckboxModelValue,
  value: CheckboxValue | undefined,
  checked: boolean
): CheckboxModelValue {
  if (!Array.isArray(modelValue)) {
    return checked;
  }

  const next = [...modelValue];
  if (value === undefined) return next;

  const idx = next.indexOf(value);
  if (checked && idx === -1) {
    next.push(value);
  } else if (!checked && idx !== -1) {
    next.splice(idx, 1);
  }
  return next;
}

export function shouldToggleCheckboxOnKeydown(key: string): boolean {
  return key === 'Enter';
}
