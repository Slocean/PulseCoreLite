export type ProgressColor = 'cyan' | 'pink' | 'orange' | 'red'

export interface ProgressBarProps {
  value: number
  color?: ProgressColor
}
