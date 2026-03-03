export type MetricWarningLevel = 'normal' | 'warning' | 'danger';

export interface MetricWarningThresholds {
  warning: number;
  danger: number;
}

export const DEFAULT_METRIC_WARNING_THRESHOLDS: MetricWarningThresholds = {
  warning: 75,
  danger: 85
};

export function resolveMetricWarningLevel(
  value: number,
  thresholds: MetricWarningThresholds = DEFAULT_METRIC_WARNING_THRESHOLDS
): MetricWarningLevel {
  if (value > thresholds.danger) {
    return 'danger';
  }
  if (value > thresholds.warning) {
    return 'warning';
  }
  return 'normal';
}
