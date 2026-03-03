/**
 * Keep this list aligned with ProgressBar style variants in progress.tokens.css.
 */
export const PROGRESS_BAR_COLORS = ['cyan', 'pink', 'orange', 'red'] as const;

export type ProgressColor = (typeof PROGRESS_BAR_COLORS)[number];

export interface ProgressBarProps {
  value: number;
  color?: ProgressColor;
}
