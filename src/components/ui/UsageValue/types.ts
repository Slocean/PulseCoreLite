export type UsageBaseColor = 'cyan' | 'pink'

export interface UsageValueProps {
  value: number
  label: string
  baseColor?: UsageBaseColor
  showWarning?: boolean
}
