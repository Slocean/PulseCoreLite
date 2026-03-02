import { tauriInvoke } from './core';

type ProfileResponse = {
  active: boolean;
  path: string | null;
  startedAt: string | null;
  samples: number;
};

export const profileApi = {
  startProfileCapture: (options: { path: string; intervalMs: number; durationMs?: number | null }) =>
    tauriInvoke<ProfileResponse>('start_profile_capture', options),
  stopProfileCapture: () => tauriInvoke<ProfileResponse>('stop_profile_capture'),
  getProfileStatus: () => tauriInvoke<ProfileResponse>('get_profile_status'),
  getProfileOutputDir: () => tauriInvoke<string>('get_profile_output_dir'),
  openProfileOutputPath: (path: string) => tauriInvoke<void>('open_profile_output_path', { path })
};
