export interface DateInputProps {
  /**
   * ISO date string in YYYY-MM-DD format.
   * Empty string means no date selected.
   */
  modelValue: string;
  /**
   * Inclusive lower bound in YYYY-MM-DD format.
   * Invalid values are ignored at runtime.
   */
  min?: string;
  /**
   * Inclusive upper bound in YYYY-MM-DD format.
   * Invalid values are ignored at runtime.
   */
  max?: string;
  disabled?: boolean;
  ariaLabel?: string;
}
