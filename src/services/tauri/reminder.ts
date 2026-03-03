import type { SendReminderEmailRequest, TaskReminder, TaskReminderStore } from '../../types';
import { tauriInvoke } from './core';

export const reminderApi = {
  sendReminderEmail: (request: SendReminderEmailRequest) => tauriInvoke<void>('send_reminder_email', { request }),
  forceCloseReminderScreens: (token: string) => tauriInvoke<number>('force_close_reminder_screens', { token }),
  getTaskReminderStore: () => tauriInvoke<TaskReminderStore>('get_task_reminder_store'),
  saveTaskReminderStore: (store: TaskReminderStore) => tauriInvoke<TaskReminderStore>('save_task_reminder_store', { store }),
  triggerTaskReminderNow: (reminder: TaskReminder) => tauriInvoke<void>('trigger_task_reminder_now', { reminder })
};
