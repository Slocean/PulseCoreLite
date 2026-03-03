export type UsageBaseColor = 'cyan' | 'pink'

export interface UsageWarningThresholds {
  warning: number
  danger: number
}

export interface UsageValueProps {
  value: number
  label: string
  baseColor?: UsageBaseColor
  showWarning?: boolean
  warningThresholds?: UsageWarningThresholds
}
