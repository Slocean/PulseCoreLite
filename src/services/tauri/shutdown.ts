import type { ScheduleShutdownRequest, ShutdownPlan } from '../../types';
import { tauriInvoke } from './core';

export const shutdownApi = {
  getShutdownPlan: () => tauriInvoke<ShutdownPlan | null>('get_shutdown_plan'),
  scheduleShutdown: (request: ScheduleShutdownRequest) => tauriInvoke<ShutdownPlan>('schedule_shutdown', { request }),
  cancelShutdownSchedule: () => tauriInvoke<void>('cancel_shutdown_schedule')
};
