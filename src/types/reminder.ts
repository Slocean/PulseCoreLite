export type ReminderChannel = 'email' | 'fullscreen';
export type ReminderContentType = 'text' | 'markdown' | 'web' | 'image';

export interface WeeklyReminderSlot {
  weekday: number;
  time: string;
}

export interface MonthlyReminderSlot {
  day: number;
  time: string;
}

export interface ReminderAdvancedSettings {
  backgroundType?: 'image' | 'color';
  backgroundImage: string;
  backgroundColor: string;
  allowClose: boolean;
  blockAllKeys: boolean;
  requireClosePassword: boolean;
  closePassword: string;
}

export interface TaskReminder {
  id: string;
  enabled: boolean;
  title: string;
  channel: ReminderChannel;
  email: string;
  dailyTimes: string[];
  weeklySlots: WeeklyReminderSlot[];
  monthlySlots: MonthlyReminderSlot[];
  contentType: ReminderContentType;
  content: string;
  advancedSettings?: ReminderAdvancedSettings;
  createdAt: string;
  updatedAt: string;
}

export interface SmtpEmailConfig {
  host: string;
  port: number;
  username: string;
  password: string;
  fromEmail: string;
  fromName: string;
  security: 'none' | 'starttls' | 'tls';
}

export interface SendReminderEmailRequest {
  smtp: SmtpEmailConfig;
  to: string;
  subject: string;
  body: string;
}

export interface TaskReminderStore {
  reminders: TaskReminder[];
  smtpConfig: SmtpEmailConfig | null;
}

export interface ReminderScreenEventPayload {
  title: string;
  content: string;
  contentType: ReminderContentType;
  advancedSettings?: ReminderAdvancedSettings;
}
