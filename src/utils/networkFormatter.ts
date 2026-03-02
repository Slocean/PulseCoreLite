type FormatNetworkLatencyOptions = {
  naLabel: string;
  compact?: boolean;
};

export function formatNetworkSpeedMbps(
  bytesPerSec: number | null | undefined,
  fractionDigits: number = 1
) {
  const value = typeof bytesPerSec === 'number' && Number.isFinite(bytesPerSec) ? bytesPerSec : 0;
  return (value / 1024 / 1024).toFixed(fractionDigits);
}

export function formatNetworkLatencyMs(
  latencyMs: number | null | undefined,
  options: FormatNetworkLatencyOptions
) {
  if (latencyMs == null || !Number.isFinite(latencyMs)) {
    return options.naLabel;
  }
  return options.compact ? `${latencyMs.toFixed(0)}ms` : `${latencyMs.toFixed(0)} ms`;
}
