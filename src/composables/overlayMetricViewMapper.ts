import { resolveMetricWarningLevel } from './metricWarningPolicy';
export type OverlayMetricBaseColor = 'cyan' | 'pink';

export function mapUsageClass(value: number, showWarning: boolean, baseColor: OverlayMetricBaseColor) {
  if (!showWarning) {
    return `overlay-glow-${baseColor}`;
  }
  const level = resolveMetricWarningLevel(value);
  if (level === 'danger') {
    return 'overlay-glow-red';
  }
  if (level === 'warning') {
    return 'overlay-glow-orange';
  }
  return `overlay-glow-${baseColor}`;
}

export function mapProgressClass(value: number, showWarning: boolean, baseColor: OverlayMetricBaseColor) {
  if (!showWarning) {
    return `overlay-progress-fill--${baseColor}`;
  }
  const level = resolveMetricWarningLevel(value);
  if (level === 'danger') {
    return 'overlay-progress-fill--red';
  }
  if (level === 'warning') {
    return 'overlay-progress-fill--orange';
  }
  return `overlay-progress-fill--${baseColor}`;
}
