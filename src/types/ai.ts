export interface LocalAiStatus {
  ready: boolean;
  running: boolean;
  modelName: string;
  selectedModelDir: string | null;
  modelPath: string | null;
  serverPath: string | null;
  serverUrl: string;
  visionEnabled: boolean;
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
  model: string;
  status: LocalAiStatus;
  usage: LocalAiTokenUsage | null;
}
