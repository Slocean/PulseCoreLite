import type { LocalAiChatRequest, LocalAiChatResponse, LocalAiStatus } from '../../types';
import { tauriInvoke } from './core';

export const aiApi = {
  getLocalAiStatus: () => tauriInvoke<LocalAiStatus>('get_local_ai_status'),
  startLocalAiRuntime: (modelDir?: string | null, launcherDir?: string | null) =>
    tauriInvoke<LocalAiStatus>('start_local_ai_runtime', {
      modelDir: modelDir ?? null,
      // Empty string means "clear custom launcher and use the bundled/default one".
      launcherDir: launcherDir ?? ''
    }),
  stopLocalAiRuntime: () => tauriInvoke<LocalAiStatus>('stop_local_ai_runtime'),
  sendLocalAiMessage: (request: LocalAiChatRequest) =>
    tauriInvoke<LocalAiChatResponse>('send_local_ai_message', { request })
};
