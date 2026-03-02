export interface TaskbarInfo {
  edge: number;
  left: number;
  top: number;
  right: number;
  bottom: number;
}

export type ShutdownMode = 'countdown' | 'once' | 'daily' | 'weekly' | 'monthly';

export interface ShutdownPlan {
  mode: ShutdownMode;
  createdAt: string;
  executeAt: string | null;
  countdownSeconds: number | null;
  time: string | null;
  weekday: number | null;
  dayOfMonth: number | null;
}

export interface ScheduleShutdownRequest {
  mode: ShutdownMode;
  delaySeconds?: number;
  executeAt?: string;
  time?: string;
  weekday?: number;
  dayOfMonth?: number;
}

export interface ProfileStatus {
  active: boolean;
  path: string | null;
  startedAt: string | null;
  samples: number;
}
