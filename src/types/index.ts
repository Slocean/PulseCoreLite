import type { AppSettings } from './settings';
import type { HardwareInfo, TelemetrySnapshot } from './telemetry';

export * from './settings';
export * from './telemetry';
export * from './system';
export * from './reminder';
export * from './ai';
export * from './gameSync';

export interface AppBootstrap {
  settings: AppSettings;
  hardware_info: HardwareInfo;
  latest_snapshot: TelemetrySnapshot;
}
