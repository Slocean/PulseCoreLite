export type OverlayMetricBaseColor = 'cyan' | 'pink';

export function mapUsageClass(value: number, showWarning: boolean, baseColor: OverlayMetricBaseColor) {
  if (!showWarning) {
    return `overlay-glow-${baseColor}`;
  }
  if (value > 85) {
    return 'overlay-glow-red';
  }
  if (value > 75) {
    return 'overlay-glow-orange';
  }
  return `overlay-glow-${baseColor}`;
}

export function mapProgressClass(value: number, showWarning: boolean, baseColor: OverlayMetricBaseColor) {
  if (!showWarning) {
    return `overlay-progress-fill--${baseColor}`;
  }
  if (value > 85) {
    return 'overlay-progress-fill--red';
  }
  if (value > 75) {
    return 'overlay-progress-fill--orange';
  }
  return `overlay-progress-fill--${baseColor}`;
}
