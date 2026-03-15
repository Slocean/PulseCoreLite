import type { LocalAiChatRequest, LocalAiChatResponse, LocalAiStatus } from '../../types';
import { tauriInvoke } from './core';

export const aiApi = {
  ensureLocalAiReady: () => tauriInvoke<LocalAiStatus>('ensure_local_ai_ready'),
  sendLocalAiMessage: (request: LocalAiChatRequest) =>
    tauriInvoke<LocalAiChatResponse>('send_local_ai_message', { request })
};
