export type SelectValue = string | number;

export interface SelectOption {
  label: string;
  value: SelectValue;
  disabled?: boolean;
}

export interface SelectProps {
  modelValue: SelectValue | SelectValue[] | null;
  options: SelectOption[];
  width?: number | string;
  placeholder?: string;
  disabled?: boolean;
  multiple?: boolean;
  ariaLabel?: string;
  emptyText?: string;
  maxSummaryItems?: number;
}
