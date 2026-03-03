export interface RangeProps {
  modelValue: number;
  /**
   * Inclusive lower bound. Defaults to 0.
   */
  min?: number;
  /**
   * Inclusive upper bound. Defaults to 100.
   */
  max?: number;
  /**
   * Increment step. Defaults to 1.
   */
  step?: number;
  disabled?: boolean;
  label?: string;
  unit?: string;
  ariaLabel?: string;
}
