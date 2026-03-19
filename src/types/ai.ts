export interface LocalAiStatus {
  ready: boolean;
  running: boolean;
  modelName: string;
  launchMode: 'cpu' | 'gpu' | 'unknown';
  selectedModelDir: string | null;
  selectedLauncherDir: string | null;
  modelPath: string | null;
  serverPath: string | null;
  serverUrl: string;
  visionEnabled: boolean;
  launcherNeedsSelection: boolean;
  message: string;
}

export interface LocalAiAttachment {
  name: string;
  mediaType: string;
  size: number;
  textContent: string | null;
  dataUrl: string | null;
}

export interface LocalAiChatMessage {
  role: 'user' | 'assistant' | 'system';
  content: string;
}

export interface LocalAiChatRequest {
  prompt: string;
  requestId?: string | null;
  enableThinking?: boolean | null;
  history: LocalAiChatMessage[];
  attachments: LocalAiAttachment[];
}

export interface LocalAiTokenUsage {
  promptTokens: number | null;
  completionTokens: number | null;
  totalTokens: number | null;
}

export interface LocalAiChatResponse {
  reply: string;
  reasoning: string | null;
  model: string;
  status: LocalAiStatus;
  usage: LocalAiTokenUsage | null;
}

export interface LocalAiStreamEvent {
  requestId: string;
  channel: 'reasoning' | 'reply';
  delta: string;
}
