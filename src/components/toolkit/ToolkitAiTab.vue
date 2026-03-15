<template>
  <UiToast channel="toolkit-ai" />

  <UiCollapsiblePanel class="toolkit-card" :title="t('toolkit.aiStatusTitle')" :collapsible="false" title-class="toolkit-section-title">
    <div class="toolkit-ai-status-grid">
      <div class="toolkit-ai-status-item">
        <span class="toolkit-ai-status-label">{{ t('toolkit.aiStatusModel') }}</span>
        <strong class="toolkit-ai-status-value">{{ localStatus?.modelName || '0.8B' }}</strong>
      </div>
      <div class="toolkit-ai-status-item">
        <span class="toolkit-ai-status-label">{{ t('toolkit.aiStatusEndpoint') }}</span>
        <strong class="toolkit-ai-status-value">{{ localStatus?.serverUrl || '-' }}</strong>
      </div>
      <div class="toolkit-ai-status-item">
        <span class="toolkit-ai-status-label">{{ t('toolkit.aiStatusVision') }}</span>
        <strong class="toolkit-ai-status-value">
          {{ localStatus?.visionEnabled ? t('toolkit.aiVisionEnabled') : t('toolkit.aiVisionDisabled') }}
        </strong>
      </div>
    </div>

    <p class="toolkit-ai-status-copy">
      {{ statusText }}
    </p>

    <div class="toolkit-ai-status-actions">
      <UiButton
        native-type="button"
        preset="overlay-primary"
        :disabled="statusBusy || !isTauriRuntime"
        @click="refreshStatus">
        {{ statusBusy ? t('toolkit.aiEnsurePending') : t('toolkit.aiEnsure') }}
      </UiButton>
      <span v-if="localStatus?.ready" class="toolkit-ai-ready-pill">{{ t('toolkit.aiReady') }}</span>
    </div>
  </UiCollapsiblePanel>

  <UiCollapsiblePanel class="toolkit-card" :title="t('toolkit.aiChatTitle')" :collapsible="false" title-class="toolkit-section-title">
    <div ref="chatFeedRef" class="toolkit-ai-chat-feed">
      <article
        v-for="message in messages"
        :key="message.id"
        class="toolkit-ai-bubble"
        :class="[`toolkit-ai-bubble--${message.role}`, { 'is-pending': message.pending, 'is-error': message.error }]">
        <header class="toolkit-ai-bubble-head">
          <span>{{ roleLabel(message.role) }}</span>
          <span v-if="message.usageTokens" class="toolkit-ai-token-meta">
            {{ t('toolkit.aiTokens', { count: message.usageTokens }) }}
          </span>
        </header>
        <p class="toolkit-ai-bubble-text">{{ message.text }}</p>
        <div v-if="message.attachments.length" class="toolkit-ai-bubble-files">
          <span
            v-for="attachment in message.attachments"
            :key="attachment.id"
            class="toolkit-ai-file-chip">
            {{ attachment.name }}
          </span>
        </div>
      </article>
    </div>

    <div v-if="attachments.length" class="toolkit-ai-attachment-list">
      <button
        v-for="attachment in attachments"
        :key="attachment.id"
        type="button"
        class="toolkit-ai-attachment-chip"
        :aria-label="t('toolkit.aiAttachmentRemove')"
        @click="removeAttachment(attachment.id)">
        <span class="toolkit-ai-attachment-name">{{ attachment.name }}</span>
        <span class="toolkit-ai-attachment-meta">{{ attachmentKindLabel(attachment) }}</span>
        <span class="toolkit-ai-attachment-close">x</span>
      </button>
    </div>

    <div class="toolkit-ai-upload-row">
      <label class="toolkit-ai-upload-button">
        <input
          class="toolkit-ai-upload-input"
          type="file"
          multiple
          accept="image/*,.txt,.md,.markdown,.json,.csv,.log,.yaml,.yml,.toml,.ini,.xml"
          @change="handleFileChange" />
        <span>{{ t('toolkit.aiUpload') }}</span>
      </label>
      <p class="toolkit-ai-upload-hint">{{ t('toolkit.aiUploadHint') }}</p>
    </div>

    <textarea
      v-model="draft"
      class="toolkit-ai-composer"
      :placeholder="t('toolkit.aiInputPlaceholder')"
      :disabled="sending || !isTauriRuntime"
      @keydown="handleComposerKeydown"></textarea>

    <div class="toolkit-ai-toolbar">
      <span class="toolkit-ai-shortcut-hint">{{ t('toolkit.aiShortcutHint') }}</span>
      <div class="toolkit-ai-toolbar-actions">
        <UiButton
          native-type="button"
          preset="overlay-action-primary"
          :disabled="sending"
          @click="clearConversation">
          {{ t('toolkit.aiClear') }}
        </UiButton>
        <UiButton
          native-type="button"
          preset="overlay-primary"
          :disabled="sending || (!draft.trim() && attachments.length === 0) || !isTauriRuntime"
          @click="sendMessage">
          {{ sending ? t('toolkit.aiSending') : t('toolkit.aiSend') }}
        </UiButton>
      </div>
    </div>
  </UiCollapsiblePanel>
</template>

<script setup lang="ts">
import { computed, nextTick, onMounted, ref, watch } from 'vue';
import { useI18n } from 'vue-i18n';

import UiButton from '@/components/ui/Button';
import UiCollapsiblePanel from '@/components/ui/CollapsiblePanel';
import UiToast from '@/components/ui/Toast';
import { useToastService } from '@/composables/useToastService';
import { api, inTauri } from '@/services/tauri';
import type { LocalAiAttachment, LocalAiChatMessage, LocalAiStatus, LocalAiTokenUsage } from '@/types';

const emit = defineEmits<{
  (event: 'contentChange'): void;
}>();

type UiAttachment = LocalAiAttachment & {
  id: string;
};

type UiMessage = {
  id: string;
  role: 'user' | 'assistant' | 'system';
  text: string;
  attachments: UiAttachment[];
  pending: boolean;
  error: boolean;
  usageTokens: number | null;
};

const MAX_IMAGE_FILE_SIZE = 8 * 1024 * 1024;
const TEXT_FILE_EXTENSIONS = new Set([
  'txt',
  'md',
  'markdown',
  'json',
  'csv',
  'log',
  'yaml',
  'yml',
  'toml',
  'ini',
  'xml'
]);

const { t } = useI18n();
const { showToast } = useToastService('toolkit-ai');
const isTauriRuntime = inTauri();
const statusBusy = ref(false);
const sending = ref(false);
const localStatus = ref<LocalAiStatus | null>(null);
const draft = ref('');
const attachments = ref<UiAttachment[]>([]);
const chatFeedRef = ref<HTMLElement | null>(null);
const messages = ref<UiMessage[]>([
  {
    id: makeId(),
    role: 'assistant',
    text: t('toolkit.aiWelcome'),
    attachments: [],
    pending: false,
    error: false,
    usageTokens: null
  }
]);

const statusText = computed(() => {
  if (!isTauriRuntime) {
    return t('toolkit.aiRuntimeUnavailable');
  }
  if (statusBusy.value) {
    return t('toolkit.aiEnsurePending');
  }
  if (localStatus.value?.ready) {
    return localStatus.value.message || t('toolkit.aiReady');
  }
  return localStatus.value?.message || t('toolkit.aiStatusHint');
});

onMounted(() => {
  if (!isTauriRuntime) {
    return;
  }
  void refreshStatus();
});

watch(
  () => [messages.value.length, attachments.value.length, statusBusy.value, localStatus.value?.ready],
  async () => {
    await nextTick();
    chatFeedRef.value?.scrollTo({
      top: chatFeedRef.value.scrollHeight,
      behavior: 'smooth'
    });
    emit('contentChange');
  },
  { immediate: true }
);

function roleLabel(role: UiMessage['role']) {
  if (role === 'user') return t('toolkit.aiRoleUser');
  if (role === 'system') return t('toolkit.aiRoleSystem');
  return t('toolkit.aiRoleAssistant');
}

function attachmentKindLabel(attachment: UiAttachment) {
  if (attachment.mediaType.startsWith('image/')) {
    return t('toolkit.aiAttachmentImage');
  }
  if (attachment.textContent) {
    return t('toolkit.aiAttachmentText');
  }
  return t('toolkit.aiAttachmentBinary');
}

async function refreshStatus() {
  if (!isTauriRuntime || statusBusy.value) {
    return;
  }
  statusBusy.value = true;
  try {
    localStatus.value = await api.ensureLocalAiReady();
  } catch (error) {
    const message = normalizeErrorMessage(error);
    localStatus.value = {
      ready: false,
      running: false,
      modelName: '0.8B',
      modelPath: null,
      serverPath: null,
      serverUrl: '-',
      visionEnabled: false,
      message
    };
    showToast(t('toolkit.aiStartFailed', { message }), { variant: 'error' });
  } finally {
    statusBusy.value = false;
  }
}

async function sendMessage() {
  if (sending.value) {
    return;
  }

  const prompt = draft.value.trim();
  if (!prompt && attachments.value.length === 0) {
    showToast(t('toolkit.aiEmptyPrompt'), { variant: 'warning' });
    return;
  }

  const effectivePrompt = prompt || t('toolkit.aiDefaultPrompt');
  const requestAttachments = attachments.value.map(toRequestAttachment);
  const requestHistory: LocalAiChatMessage[] = messages.value
    .filter(message => (message.role === 'user' || message.role === 'assistant') && !message.pending)
    .slice(-10)
    .map(message => ({
      role: message.role,
      content: message.text
    }));

  const userMessage: UiMessage = {
    id: makeId(),
    role: 'user',
    text: effectivePrompt,
    attachments: attachments.value.map(copyAttachment),
    pending: false,
    error: false,
    usageTokens: null
  };
  const pendingMessage: UiMessage = {
    id: makeId(),
    role: 'assistant',
    text: t('toolkit.aiPendingMessage'),
    attachments: [],
    pending: true,
    error: false,
    usageTokens: null
  };

  messages.value = [...messages.value, userMessage, pendingMessage];
  draft.value = '';
  attachments.value = [];
  sending.value = true;

  try {
    const response = await api.sendLocalAiMessage({
      prompt: effectivePrompt,
      history: requestHistory,
      attachments: requestAttachments
    });
    localStatus.value = response.status;
    replacePendingMessage(pendingMessage.id, {
      id: pendingMessage.id,
      role: 'assistant',
      text: response.reply,
      attachments: [],
      pending: false,
      error: false,
      usageTokens: resolveUsageTokens(response.usage)
    });
  } catch (error) {
    const message = normalizeErrorMessage(error);
    replacePendingMessage(pendingMessage.id, {
      id: pendingMessage.id,
      role: 'assistant',
      text: message,
      attachments: [],
      pending: false,
      error: true,
      usageTokens: null
    });
    showToast(t('toolkit.aiReplyFailed', { message }), { variant: 'error' });
  } finally {
    sending.value = false;
  }
}

function clearConversation() {
  messages.value = [
    {
      id: makeId(),
      role: 'assistant',
      text: t('toolkit.aiWelcome'),
      attachments: [],
      pending: false,
      error: false,
      usageTokens: null
    }
  ];
  attachments.value = [];
  draft.value = '';
}

function replacePendingMessage(id: string, nextMessage: UiMessage) {
  messages.value = messages.value.map(message => (message.id === id ? nextMessage : message));
}

function removeAttachment(id: string) {
  attachments.value = attachments.value.filter(attachment => attachment.id !== id);
}

async function handleFileChange(event: Event) {
  const input = event.target as HTMLInputElement | null;
  const fileList = input?.files;
  if (!fileList?.length) {
    return;
  }

  const uploaded = Array.from(fileList);
  const nextAttachments: UiAttachment[] = [];
  for (const file of uploaded) {
    try {
      const attachment = await buildAttachment(file);
      nextAttachments.push(attachment);
    } catch (error) {
      showToast(
        t('toolkit.aiFileReadFailed', { message: normalizeErrorMessage(error) }),
        { variant: 'error' }
      );
    }
  }

  attachments.value = [...attachments.value, ...nextAttachments];
  if (input) {
    input.value = '';
  }
}

function handleComposerKeydown(event: KeyboardEvent) {
  if (event.key !== 'Enter') {
    return;
  }
  if (!(event.ctrlKey || event.metaKey)) {
    return;
  }
  event.preventDefault();
  void sendMessage();
}

async function buildAttachment(file: File): Promise<UiAttachment> {
  if (file.type.startsWith('image/')) {
    if (file.size > MAX_IMAGE_FILE_SIZE) {
      throw new Error(t('toolkit.aiFileTooLarge'));
    }
    return {
      id: makeId(),
      name: file.name,
      mediaType: file.type || 'image/*',
      size: file.size,
      textContent: null,
      dataUrl: await readFileAsDataUrl(file)
    };
  }

  if (isTextLikeFile(file)) {
    return {
      id: makeId(),
      name: file.name,
      mediaType: file.type || 'text/plain',
      size: file.size,
      textContent: await readFileAsText(file),
      dataUrl: null
    };
  }

  return {
    id: makeId(),
    name: file.name,
    mediaType: file.type || 'application/octet-stream',
    size: file.size,
    textContent: null,
    dataUrl: null
  };
}

function isTextLikeFile(file: File) {
  if (file.type.startsWith('text/')) {
    return true;
  }
  const ext = file.name.split('.').pop()?.toLowerCase() ?? '';
  return TEXT_FILE_EXTENSIONS.has(ext);
}

function toRequestAttachment(attachment: UiAttachment): LocalAiAttachment {
  return {
    name: attachment.name,
    mediaType: attachment.mediaType,
    size: attachment.size,
    textContent: attachment.textContent,
    dataUrl: attachment.dataUrl
  };
}

function copyAttachment(attachment: UiAttachment): UiAttachment {
  return {
    id: attachment.id,
    name: attachment.name,
    mediaType: attachment.mediaType,
    size: attachment.size,
    textContent: attachment.textContent,
    dataUrl: attachment.dataUrl
  };
}

function resolveUsageTokens(usage: LocalAiTokenUsage | null | undefined) {
  return usage?.totalTokens ?? null;
}

function normalizeErrorMessage(error: unknown) {
  if (error instanceof Error) {
    return error.message;
  }
  if (typeof error === 'string') {
    return error;
  }
  return t('toolkit.aiUnknownError');
}

function makeId() {
  if (typeof crypto !== 'undefined' && 'randomUUID' in crypto) {
    return crypto.randomUUID();
  }
  return `local-ai-${Date.now()}-${Math.random().toString(16).slice(2)}`;
}

function readFileAsText(file: File) {
  return new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onerror = () => reject(new Error(t('toolkit.aiFileReadFailed', { message: file.name })));
    reader.onload = () => resolve(String(reader.result ?? '').slice(0, 12000));
    reader.readAsText(file);
  });
}

function readFileAsDataUrl(file: File) {
  return new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onerror = () => reject(new Error(t('toolkit.aiFileReadFailed', { message: file.name })));
    reader.onload = () => resolve(String(reader.result ?? ''));
    reader.readAsDataURL(file);
  });
}
</script>

<style scoped>
.toolkit-ai-status-grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(132px, 1fr));
  gap: 8px;
}

.toolkit-ai-status-item {
  display: grid;
  gap: 4px;
  padding: 10px;
  border-radius: 12px;
  background: rgba(255, 255, 255, 0.04);
  border: 1px solid rgba(255, 255, 255, 0.08);
}

.toolkit-ai-status-label {
  font-size: 11px;
  letter-spacing: 0.06em;
  color: rgba(255, 255, 255, 0.64);
  text-transform: uppercase;
}

.toolkit-ai-status-value {
  font-size: 13px;
  color: rgba(255, 255, 255, 0.95);
  word-break: break-word;
}

.toolkit-ai-status-copy {
  margin: 2px 0 0;
  color: rgba(255, 255, 255, 0.78);
  line-height: 1.5;
}

.toolkit-ai-status-actions {
  display: flex;
  align-items: center;
  gap: 10px;
}

.toolkit-ai-ready-pill {
  display: inline-flex;
  align-items: center;
  min-height: 30px;
  padding: 0 10px;
  border-radius: 999px;
  background: rgba(28, 107, 70, 0.44);
  color: rgba(195, 255, 219, 0.96);
  font-size: 12px;
}

.toolkit-ai-chat-feed {
  max-height: 360px;
  min-height: 220px;
  overflow-y: auto;
  display: grid;
  gap: 10px;
  padding: 4px;
}

.toolkit-ai-bubble {
  display: grid;
  gap: 8px;
  padding: 12px;
  border-radius: 14px;
  border: 1px solid rgba(255, 255, 255, 0.08);
  background: rgba(255, 255, 255, 0.04);
}

.toolkit-ai-bubble--user {
  background: rgba(13, 72, 92, 0.34);
  border-color: rgba(103, 232, 249, 0.16);
}

.toolkit-ai-bubble--assistant {
  background: rgba(255, 255, 255, 0.05);
}

.toolkit-ai-bubble--system {
  background: rgba(134, 25, 143, 0.2);
}

.toolkit-ai-bubble.is-pending {
  opacity: 0.72;
}

.toolkit-ai-bubble.is-error {
  border-color: rgba(248, 113, 113, 0.32);
  background: rgba(127, 29, 29, 0.24);
}

.toolkit-ai-bubble-head {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 8px;
  font-size: 11px;
  letter-spacing: 0.08em;
  color: rgba(255, 255, 255, 0.62);
  text-transform: uppercase;
}

.toolkit-ai-token-meta {
  color: rgba(125, 211, 252, 0.92);
}

.toolkit-ai-bubble-text {
  margin: 0;
  color: rgba(255, 255, 255, 0.92);
  line-height: 1.6;
  white-space: pre-wrap;
  word-break: break-word;
}

.toolkit-ai-bubble-files,
.toolkit-ai-attachment-list {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
}

.toolkit-ai-file-chip,
.toolkit-ai-attachment-chip {
  display: inline-flex;
  align-items: center;
  gap: 8px;
  min-height: 30px;
  padding: 0 10px;
  border-radius: 999px;
  border: 1px solid rgba(255, 255, 255, 0.1);
  background: rgba(255, 255, 255, 0.04);
  color: rgba(255, 255, 255, 0.84);
  font-size: 12px;
}

.toolkit-ai-attachment-chip {
  cursor: pointer;
}

.toolkit-ai-attachment-chip:hover {
  border-color: rgba(255, 255, 255, 0.24);
  background: rgba(255, 255, 255, 0.08);
}

.toolkit-ai-attachment-name {
  font-weight: 600;
}

.toolkit-ai-attachment-meta {
  color: rgba(255, 255, 255, 0.58);
}

.toolkit-ai-attachment-close {
  font-size: 16px;
  line-height: 1;
}

.toolkit-ai-upload-row {
  display: grid;
  gap: 8px;
}

.toolkit-ai-upload-button {
  position: relative;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  min-height: 38px;
  width: fit-content;
  padding: 0 14px;
  border-radius: 10px;
  border: 1px dashed rgba(255, 255, 255, 0.24);
  color: rgba(255, 255, 255, 0.92);
  cursor: pointer;
}

.toolkit-ai-upload-button:hover {
  background: rgba(255, 255, 255, 0.05);
}

.toolkit-ai-upload-input {
  position: absolute;
  inset: 0;
  opacity: 0;
  cursor: pointer;
}

.toolkit-ai-upload-hint,
.toolkit-ai-shortcut-hint {
  margin: 0;
  color: rgba(255, 255, 255, 0.62);
  font-size: 12px;
  line-height: 1.5;
}

.toolkit-ai-composer {
  width: 100%;
  min-height: 108px;
  resize: vertical;
  border-radius: 14px;
  border: 1px solid rgba(255, 255, 255, 0.12);
  background: rgba(0, 0, 0, 0.18);
  color: rgba(255, 255, 255, 0.95);
  padding: 12px 14px;
  font: inherit;
  line-height: 1.6;
}

.toolkit-ai-composer:focus {
  outline: none;
  border-color: rgba(103, 232, 249, 0.42);
  box-shadow: 0 0 0 1px rgba(103, 232, 249, 0.24);
}

.toolkit-ai-toolbar {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  flex-wrap: wrap;
}

.toolkit-ai-toolbar-actions {
  display: inline-flex;
  gap: 8px;
}
</style>
