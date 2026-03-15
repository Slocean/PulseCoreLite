<template>
  <UiToast :channel="toastChannel" />

  <ToolkitAiOverviewPanel
    v-model="overviewOpen"
    :local-status="localStatus"
    :workspace-state-tone="workspaceStateTone"
    :workspace-state-label="workspaceStateLabel"
    :context-window-size="contextWindowSize"
    :conversation-turns="conversationTurns"
    :capability-label="capabilityLabel"
    :status-busy="statusBusy"
    :is-tauri-runtime="isTauriRuntime"
    @refresh-status="refreshStatus"
    @content-change="emit('contentChange')" />

  <UiCollapsiblePanel class="toolkit-card" :title="t('toolkit.aiChatTitle')" :collapsible="false" title-class="toolkit-section-title">
    <div ref="chatFeedRef" class="toolkit-ai-chat-feed">
      <article v-for="message in messages" :key="message.id" class="toolkit-ai-message" :class="[`toolkit-ai-message--${message.role}`, { 'is-pending': message.pending, 'is-error': message.error }]">
        <div class="toolkit-ai-bubble">
          <header class="toolkit-ai-bubble-head">
            <div class="toolkit-ai-bubble-head-main">
              <div class="toolkit-ai-marker" aria-hidden="true">
                <span class="material-symbols-outlined">{{ roleIcon(message.role) }}</span>
              </div>
              <div class="toolkit-ai-bubble-meta">
                <span>{{ roleLabel(message.role) }}</span>
                <time>{{ formatTimestamp(message.createdAt) }}</time>
                <span v-if="message.usageTokens" class="toolkit-ai-token-meta">{{ t('toolkit.aiTokens', { count: message.usageTokens }) }}</span>
              </div>
            </div>
            <UiButton v-if="message.role === 'assistant' && !message.pending && message.text" native-type="button" preset="overlay-chip-soft" @click="copyMessage(message.text)">
              <span class="material-symbols-outlined" aria-hidden="true">content_copy</span>
              <span>{{ t('toolkit.aiCopyMessage') }}</span>
            </UiButton>
          </header>
          <p class="toolkit-ai-bubble-text">{{ message.text }}</p>
          <div v-if="message.attachments.length" class="toolkit-ai-bubble-files">
            <span v-for="attachment in message.attachments" :key="attachment.id" class="toolkit-ai-file-chip">
              {{ attachment.name }} · {{ attachmentKindLabel(attachment) }}
            </span>
          </div>
        </div>
      </article>
    </div>

    <section class="toolkit-ai-composer-card" :class="{ 'is-drop-active': isDropActive }" @dragenter.prevent="handleDragEnter" @dragover.prevent="handleDragOver" @dragleave.prevent="handleDragLeave" @drop.prevent="handleDrop">
      <div v-if="attachments.length" class="toolkit-ai-attachment-stage">
        <header class="toolkit-ai-attachment-head">
          <div>
            <strong>{{ t('toolkit.aiAttachmentQueueTitle') }}</strong>
            <p class="toolkit-ai-hint">{{ isDropActive ? t('toolkit.aiDropHint') : t('toolkit.aiUploadHint') }}</p>
          </div>
          <UiButton native-type="button" preset="overlay-chip-soft" @click="clearAttachments">
            {{ t('toolkit.aiAttachmentRemoveAll') }}
          </UiButton>
        </header>

        <div class="toolkit-ai-attachment-grid">
          <article v-for="attachment in attachments" :key="attachment.id" class="toolkit-ai-attachment-card">
            <img v-if="isImageAttachment(attachment) && attachment.dataUrl" class="toolkit-ai-attachment-preview" :src="attachment.dataUrl" :alt="t('toolkit.aiAttachmentPreviewAlt')" />
            <div v-else class="toolkit-ai-attachment-icon">
              <span class="material-symbols-outlined" aria-hidden="true">{{ attachmentIcon(attachment) }}</span>
            </div>
            <div class="toolkit-ai-attachment-copy">
              <strong>{{ attachment.name }}</strong>
              <span>{{ attachmentKindLabel(attachment) }} · {{ formatFileSize(attachment.size) }}</span>
            </div>
            <button type="button" class="toolkit-ai-attachment-remove" :aria-label="t('toolkit.aiAttachmentRemove')" @click="removeAttachment(attachment.id)">
              <span class="material-symbols-outlined" aria-hidden="true">close</span>
            </button>
          </article>
        </div>
      </div>

      <div class="toolkit-ai-upload-row">
        <label class="toolkit-ai-upload-button" :class="{ 'is-disabled': !isTauriRuntime }">
          <input class="toolkit-ai-upload-input" type="file" multiple :disabled="!isTauriRuntime" accept="image/*,.txt,.md,.markdown,.json,.csv,.log,.yaml,.yml,.toml,.ini,.xml" @change="handleFileChange" />
          <span class="material-symbols-outlined" aria-hidden="true">attach_file</span>
          <span>{{ t('toolkit.aiUpload') }}</span>
        </label>
        <div class="toolkit-ai-meta-pills">
          <span class="toolkit-ai-meta-pill">{{ t('toolkit.aiDraftCount', { count: draft.length }) }}</span>
          <span class="toolkit-ai-meta-pill">{{ t('toolkit.aiContextWindow', { count: contextWindowSize }) }}</span>
        </div>
      </div>

      <p class="toolkit-ai-hint">{{ isDropActive ? t('toolkit.aiDropHint') : t('toolkit.aiShortcutHint') }}</p>

      <textarea ref="composerRef" v-model="draft" class="toolkit-ai-composer" :placeholder="t('toolkit.aiInputPlaceholder')" :disabled="sending || !isTauriRuntime" @keydown="handleComposerKeydown"></textarea>

      <div class="toolkit-ai-toolbar">
        <div class="toolkit-ai-toolbar-actions">
          <UiButton native-type="button" preset="overlay-chip-soft" size="sm" :disabled="sending" @click="clearConversation">
            {{ t('toolkit.aiClear') }}
          </UiButton>
          <UiButton native-type="button" preset="overlay-primary" size="sm" :disabled="sendDisabled" @click="sendMessage">
            {{ sending ? t('toolkit.aiSending') : t('toolkit.aiSend') }}
          </UiButton>
        </div>
      </div>
    </section>
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
import ToolkitAiOverviewPanel from './ToolkitAiOverviewPanel.vue';

const props = withDefaults(defineProps<{ toastChannel?: string }>(), {
  toastChannel: 'toolkit-ai'
});

const emit = defineEmits<{ (event: 'contentChange'): void }>();

type UiAttachment = LocalAiAttachment & { id: string };
type UiMessage = {
  id: string;
  role: 'user' | 'assistant' | 'system';
  text: string;
  attachments: UiAttachment[];
  pending: boolean;
  error: boolean;
  usageTokens: number | null;
  createdAt: number;
};

const MAX_IMAGE_FILE_SIZE = 8 * 1024 * 1024;
const MAX_COMPOSER_HEIGHT = 260;
const TEXT_FILE_EXTENSIONS = new Set(['txt', 'md', 'markdown', 'json', 'csv', 'log', 'yaml', 'yml', 'toml', 'ini', 'xml']);

const { t, locale } = useI18n();
const { showToast } = useToastService(props.toastChannel);
const isTauriRuntime = inTauri();
const statusBusy = ref(false);
const sending = ref(false);
const isDropActive = ref(false);
const localStatus = ref<LocalAiStatus | null>(null);
const draft = ref('');
const attachments = ref<UiAttachment[]>([]);
const messages = ref<UiMessage[]>([createWelcomeMessage()]);
const overviewOpen = ref(true);
const chatFeedRef = ref<HTMLElement | null>(null);
const composerRef = ref<HTMLTextAreaElement | null>(null);

const workspaceStateLabel = computed(() => {
  if (!isTauriRuntime) return t('toolkit.aiStatusUnavailable');
  if (statusBusy.value || localStatus.value?.running) return t('toolkit.aiStatusStarting');
  if (localStatus.value?.ready) return t('toolkit.aiStatusReady');
  return t('toolkit.aiStatusStopped');
});

const workspaceStateTone = computed(() => {
  if (!isTauriRuntime) return 'muted';
  if (statusBusy.value || localStatus.value?.running) return 'busy';
  if (localStatus.value?.ready) return 'ready';
  return 'offline';
});

const capabilityLabel = computed(() => (localStatus.value?.visionEnabled ? t('toolkit.aiModeVision') : t('toolkit.aiModeText')));
const conversationTurns = computed(() => messages.value.filter(message => message.role === 'user').length);
const contextWindowSize = computed(() => messages.value.filter(message => (message.role === 'user' || message.role === 'assistant') && !message.pending).slice(-10).length);
const hasConversation = computed(() => conversationTurns.value > 0);
const sendDisabled = computed(() => sending.value || !isTauriRuntime || (!draft.value.trim() && attachments.value.length === 0));

onMounted(() => {
  autoResizeComposer();
  if (isTauriRuntime) {
    void refreshStatus();
  }
});

watch(
  () => [messages.value.length, attachments.value.length, statusBusy.value, localStatus.value?.ready],
  async () => {
    await nextTick();
    chatFeedRef.value?.scrollTo({ top: chatFeedRef.value.scrollHeight, behavior: 'smooth' });
    emit('contentChange');
  },
  { immediate: true }
);

watch(
  draft,
  async () => {
    await nextTick();
    autoResizeComposer();
    emit('contentChange');
  },
  { immediate: true }
);

function roleLabel(role: UiMessage['role']) {
  if (role === 'user') return t('toolkit.aiRoleUser');
  if (role === 'system') return t('toolkit.aiRoleSystem');
  return t('toolkit.aiRoleAssistant');
}

function roleIcon(role: UiMessage['role']) {
  if (role === 'user') return 'person';
  if (role === 'system') return 'tune';
  return 'smart_toy';
}

function attachmentIcon(attachment: UiAttachment) {
  if (attachment.mediaType.startsWith('image/')) return 'image';
  if (attachment.textContent) return 'description';
  return 'draft';
}

function attachmentKindLabel(attachment: UiAttachment) {
  if (attachment.mediaType.startsWith('image/')) return t('toolkit.aiAttachmentImage');
  if (attachment.textContent) return t('toolkit.aiAttachmentText');
  return t('toolkit.aiAttachmentBinary');
}

function isImageAttachment(attachment: UiAttachment) {
  return attachment.mediaType.startsWith('image/');
}

function formatTimestamp(timestamp: number) {
  return new Intl.DateTimeFormat(locale.value, { hour: '2-digit', minute: '2-digit' }).format(timestamp);
}

function formatFileSize(size: number) {
  if (size >= 1024 * 1024) return `${(size / (1024 * 1024)).toFixed(size >= 10 * 1024 * 1024 ? 0 : 1)} MB`;
  if (size >= 1024) return `${Math.round(size / 1024)} KB`;
  return `${size} B`;
}

function autoResizeComposer() {
  const target = composerRef.value;
  if (!target) return;
  target.style.height = 'auto';
  target.style.height = `${Math.min(target.scrollHeight, MAX_COMPOSER_HEIGHT)}px`;
}

function focusComposer() {
  composerRef.value?.focus();
}

async function refreshStatus() {
  if (!isTauriRuntime || statusBusy.value) return;
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
  if (sending.value) return;
  if (!isTauriRuntime) {
    showToast(t('toolkit.aiRuntimeUnavailable'), { variant: 'warning' });
    return;
  }

  const prompt = draft.value.trim();
  if (!prompt && attachments.value.length === 0) {
    showToast(t('toolkit.aiEmptyPrompt'), { variant: 'warning' });
    return;
  }

  if (!localStatus.value?.ready) {
    await refreshStatus();
    if (!localStatus.value?.ready) {
      showToast(t('toolkit.aiNotReadyYet'), { variant: 'warning' });
      return;
    }
  }

  const effectivePrompt = prompt || t('toolkit.aiDefaultPrompt');
  const requestAttachments = attachments.value.map(toRequestAttachment);
  const requestHistory: LocalAiChatMessage[] = messages.value
    .filter(message => (message.role === 'user' || message.role === 'assistant') && !message.pending)
    .slice(-10)
    .map(message => ({ role: message.role, content: message.text }));

  const userMessage: UiMessage = {
    id: makeId(),
    role: 'user',
    text: effectivePrompt,
    attachments: attachments.value.map(copyAttachment),
    pending: false,
    error: false,
    usageTokens: null,
    createdAt: Date.now()
  };

  const pendingMessage: UiMessage = {
    id: makeId(),
    role: 'assistant',
    text: t('toolkit.aiPendingMessage'),
    attachments: [],
    pending: true,
    error: false,
    usageTokens: null,
    createdAt: Date.now()
  };

  messages.value = [...messages.value, userMessage, pendingMessage];
  draft.value = '';
  attachments.value = [];
  sending.value = true;

  try {
    const response = await api.sendLocalAiMessage({ prompt: effectivePrompt, history: requestHistory, attachments: requestAttachments });
    localStatus.value = response.status;
    replacePendingMessage(pendingMessage.id, {
      id: pendingMessage.id,
      role: 'assistant',
      text: response.reply,
      attachments: [],
      pending: false,
      error: false,
      usageTokens: resolveUsageTokens(response.usage),
      createdAt: Date.now()
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
      usageTokens: null,
      createdAt: Date.now()
    });
    showToast(t('toolkit.aiReplyFailed', { message }), { variant: 'error' });
  } finally {
    sending.value = false;
    focusComposer();
  }
}

function clearConversation() {
  messages.value = [createWelcomeMessage()];
  attachments.value = [];
  draft.value = '';
  focusComposer();
}

function clearAttachments() {
  attachments.value = [];
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
  if (!fileList?.length) return;
  await appendAttachments(Array.from(fileList));
  if (input) input.value = '';
}

function handleComposerKeydown(event: KeyboardEvent) {
  if (event.key === 'Enter' && (event.ctrlKey || event.metaKey)) {
    event.preventDefault();
    void sendMessage();
  }
}

function handleDragEnter() {
  if (isTauriRuntime) isDropActive.value = true;
}

function handleDragOver() {
  if (isTauriRuntime) isDropActive.value = true;
}

function handleDragLeave() {
  isDropActive.value = false;
}

async function handleDrop(event: DragEvent) {
  isDropActive.value = false;
  const fileList = event.dataTransfer?.files;
  if (!fileList?.length) return;
  await appendAttachments(Array.from(fileList));
}

async function appendAttachments(files: File[]) {
  const nextAttachments: UiAttachment[] = [];
  for (const file of files) {
    try {
      nextAttachments.push(await buildAttachment(file));
    } catch (error) {
      showToast(t('toolkit.aiFileReadFailed', { message: normalizeErrorMessage(error) }), { variant: 'error' });
    }
  }
  attachments.value = mergeUniqueAttachments(attachments.value, nextAttachments);
}

function mergeUniqueAttachments(existing: UiAttachment[], incoming: UiAttachment[]) {
  const seen = new Set(existing.map(attachment => `${attachment.name}:${attachment.size}:${attachment.mediaType}`));
  return [...existing, ...incoming.filter(attachment => {
    const key = `${attachment.name}:${attachment.size}:${attachment.mediaType}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  })];
}

async function copyMessage(text: string) {
  try {
    if (typeof navigator === 'undefined' || !navigator.clipboard?.writeText) throw new Error('clipboard unavailable');
    await navigator.clipboard.writeText(text);
    showToast(t('toolkit.aiCopySuccess'), { variant: 'success' });
  } catch {
    showToast(t('toolkit.aiCopyFailed'), { variant: 'error' });
  }
}

async function buildAttachment(file: File): Promise<UiAttachment> {
  if (file.type.startsWith('image/')) {
    if (file.size > MAX_IMAGE_FILE_SIZE) throw new Error(t('toolkit.aiFileTooLarge'));
    return { id: makeId(), name: file.name, mediaType: file.type || 'image/*', size: file.size, textContent: null, dataUrl: await readFileAsDataUrl(file) };
  }

  if (isTextLikeFile(file)) {
    return { id: makeId(), name: file.name, mediaType: file.type || 'text/plain', size: file.size, textContent: await readFileAsText(file), dataUrl: null };
  }

  return { id: makeId(), name: file.name, mediaType: file.type || 'application/octet-stream', size: file.size, textContent: null, dataUrl: null };
}

function isTextLikeFile(file: File) {
  if (file.type.startsWith('text/')) return true;
  return TEXT_FILE_EXTENSIONS.has(file.name.split('.').pop()?.toLowerCase() ?? '');
}

function toRequestAttachment(attachment: UiAttachment): LocalAiAttachment {
  return { name: attachment.name, mediaType: attachment.mediaType, size: attachment.size, textContent: attachment.textContent, dataUrl: attachment.dataUrl };
}

function copyAttachment(attachment: UiAttachment): UiAttachment {
  return { id: attachment.id, name: attachment.name, mediaType: attachment.mediaType, size: attachment.size, textContent: attachment.textContent, dataUrl: attachment.dataUrl };
}

function resolveUsageTokens(usage: LocalAiTokenUsage | null | undefined) {
  return usage?.totalTokens ?? null;
}

function normalizeErrorMessage(error: unknown) {
  if (error instanceof Error) return error.message;
  if (typeof error === 'string') return error;
  return t('toolkit.aiUnknownError');
}

function createWelcomeMessage(): UiMessage {
  return { id: makeId(), role: 'assistant', text: t('toolkit.aiWelcome'), attachments: [], pending: false, error: false, usageTokens: null, createdAt: Date.now() };
}

function makeId() {
  if (typeof crypto !== 'undefined' && 'randomUUID' in crypto) return crypto.randomUUID();
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
.toolkit-ai-composer-card,
.toolkit-ai-attachment-stage {
  display: grid;
  gap: 8px;
}

.toolkit-ai-upload-row,
.toolkit-ai-toolbar,
.toolkit-ai-attachment-head {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 10px;
  flex-wrap: wrap;
}

.toolkit-ai-attachment-copy {
  display: grid;
  gap: 4px;
  min-width: 0;
}

.toolkit-ai-bubble-meta {
  font-size: 10px;
  letter-spacing: 0.08em;
  text-transform: uppercase;
}

.toolkit-ai-hint,
.toolkit-ai-bubble-text,
.toolkit-ai-attachment-copy span {
  margin: 0;
  line-height: 1.6;
}

.toolkit-ai-hint,
.toolkit-ai-attachment-copy span {
  color: rgba(255, 255, 255, 0.62);
  font-size: 11px;
}

.toolkit-ai-meta-pill,
.toolkit-ai-file-chip {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  min-height: 24px;
  padding: 0 8px;
  border-radius: 999px;
  border: 1px solid rgba(255, 255, 255, 0.1);
  background: rgba(255, 255, 255, 0.04);
  font-size: 11px;
}

.toolkit-ai-attachment-grid {
  display: grid;
  grid-template-columns: minmax(120px, 0.9fr) minmax(160px, 1.25fr) minmax(140px, 1fr);
  gap: 8px;
}

.toolkit-ai-bubble,
.toolkit-ai-composer-card,
.toolkit-ai-attachment-card {
  border-radius: 14px;
  border: 1px solid rgba(255, 255, 255, 0.08);
  background: rgba(255, 255, 255, 0.04);
}

.toolkit-ai-meta-pills,
.toolkit-ai-bubble-files,
.toolkit-ai-toolbar-actions,
.toolkit-ai-toolbar {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
}

.toolkit-ai-chat-feed {
  min-height: 280px;
  max-height: 440px;
  overflow-y: auto;
  display: grid;
  gap: 12px;
  padding-right: 2px;
}

.toolkit-ai-toolbar {
  justify-content: flex-end;
}

.toolkit-ai-toolbar-actions {
  margin-left: auto;
  justify-content: flex-end;
}

.toolkit-ai-toolbar-actions :deep(.ui-button) {
  flex: 0 0 auto;
  white-space: nowrap;
}

.toolkit-ai-toolbar-actions :deep(.ui-button__content) {
  white-space: nowrap;
}

.toolkit-ai-marker .material-symbols-outlined {
  display: block;
  font-size: 16px;
}

.toolkit-ai-message {
  display: block;
}

.toolkit-ai-marker {
  width: 28px;
  height: 28px;
  display: grid;
  place-items: center;
  flex: 0 0 auto;
  border-radius: 10px;
  border: 1px solid rgba(255, 255, 255, 0.08);
  background: rgba(255, 255, 255, 0.04);
}

.toolkit-ai-message--user .toolkit-ai-marker {
  background: rgba(8, 145, 178, 0.16);
}

.toolkit-ai-message--assistant .toolkit-ai-marker {
  background: rgba(59, 130, 246, 0.14);
}

.toolkit-ai-bubble {
  display: grid;
  gap: 8px;
  padding: 14px;
}

.toolkit-ai-message--user .toolkit-ai-bubble {
  background: rgba(13, 72, 92, 0.32);
  border-color: rgba(103, 232, 249, 0.16);
}

.toolkit-ai-message.is-error .toolkit-ai-bubble {
  background: rgba(127, 29, 29, 0.24);
  border-color: rgba(248, 113, 113, 0.34);
}

.toolkit-ai-message.is-pending .toolkit-ai-bubble {
  opacity: 0.78;
}

.toolkit-ai-bubble-head,
.toolkit-ai-bubble-meta {
  display: flex;
  align-items: center;
  gap: 8px;
  flex-wrap: wrap;
}

.toolkit-ai-bubble-head-main {
  display: flex;
  align-items: center;
  gap: 8px;
  min-width: 0;
  flex-wrap: wrap;
}

.toolkit-ai-bubble-head {
  justify-content: space-between;
}

.toolkit-ai-token-meta {
  color: rgba(125, 211, 252, 0.95);
}

.toolkit-ai-bubble-text {
  color: rgba(255, 255, 255, 0.94);
  font-size: 13px;
  line-height: 1.55;
  white-space: pre-wrap;
  word-break: break-word;
}

.toolkit-ai-composer-card {
  padding: 12px;
  transition: border-color var(--motion-duration-fast) var(--motion-ease-standard), background var(--motion-duration-fast) var(--motion-ease-standard);
}

.toolkit-ai-composer-card.is-drop-active {
  border-color: rgba(103, 232, 249, 0.44);
  background: rgba(8, 32, 40, 0.46);
}

.toolkit-ai-attachment-card {
  display: grid;
  grid-template-columns: auto 1fr auto;
  gap: 10px;
  align-items: center;
  min-width: 0;
  padding: 10px;
}

.toolkit-ai-attachment-preview,
.toolkit-ai-attachment-icon {
  width: 52px;
  height: 52px;
  border-radius: 12px;
  background: rgba(255, 255, 255, 0.05);
}

.toolkit-ai-attachment-preview {
  object-fit: cover;
}

.toolkit-ai-attachment-icon {
  display: grid;
  place-items: center;
}

.toolkit-ai-attachment-copy strong {
  color: rgba(255, 255, 255, 0.92);
  word-break: break-word;
}

.toolkit-ai-attachment-remove {
  appearance: none;
  width: 28px;
  height: 28px;
  border: 0;
  border-radius: 10px;
  background: transparent;
  color: rgba(255, 255, 255, 0.56);
  cursor: pointer;
}

.toolkit-ai-upload-button {
  position: relative;
  display: inline-flex;
  align-items: center;
  gap: 6px;
  min-height: 30px;
  padding: 0 10px;
  border-radius: 10px;
  border: 1px dashed rgba(255, 255, 255, 0.24);
  background: rgba(255, 255, 255, 0.03);
  cursor: pointer;
  font-size: 12px;
  line-height: 1;
  white-space: nowrap;
}

.toolkit-ai-upload-button .material-symbols-outlined {
  font-size: 15px;
}

.toolkit-ai-upload-button.is-disabled {
  opacity: 0.5;
  cursor: not-allowed;
}

.toolkit-ai-upload-input {
  position: absolute;
  inset: 0;
  opacity: 0;
}

.toolkit-ai-composer {
  width: 100%;
  min-height: 104px;
  max-height: 260px;
  resize: none;
  padding: 12px 14px;
  border-radius: 14px;
  border: 1px solid rgba(255, 255, 255, 0.12);
  background: rgba(0, 0, 0, 0.2);
  color: rgba(255, 255, 255, 0.95);
  font-size: 12px;
  font-weight: 400;
  line-height: 1.5;
}

.toolkit-ai-composer::placeholder {
  color: rgba(255, 255, 255, 0.72);
}

.toolkit-ai-composer:focus {
  outline: none;
  border-color: rgba(103, 232, 249, 0.42);
  box-shadow: 0 0 0 1px rgba(103, 232, 249, 0.2);
}

@media (max-width: 760px) {
  .toolkit-ai-bubble {
    padding: 12px;
  }

  .toolkit-ai-composer-card {
    padding: 10px;
  }

  .toolkit-ai-upload-row {
    align-items: flex-start;
  }

  .toolkit-ai-toolbar-actions {
    width: 100%;
  }

  .toolkit-ai-attachment-grid {
    grid-template-columns: 1fr;
  }
}
</style>
