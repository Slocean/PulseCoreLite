<template>
  <UiCollapsiblePanel
    v-model="chatOpen"
    class="toolkit-card"
    :title="t('toolkit.aiChatTitle')"
    header-mode="split"
    header-class="toolkit-section-header"
    split-title-preset="toolkit-collapse-title"
    split-toggle-preset="toolkit-collapse-icon"
    title-class="toolkit-section-title"
    indicator-class="toolkit-collapse-indicator"
    @toggle="handleToggle">
    <template #header-actions>
      <!-- <div class="toolkit-ai-header-stats" @click="toggleChatOpen">
        <span class="toolkit-ai-header-stat">{{ t('toolkit.aiDraftCount', { count: draft.length }) }}</span>
        <span class="toolkit-ai-header-stat">
          {{ t('toolkit.aiContextWindow', { count: contextWindowSize }) }}
        </span>
      </div> -->
    </template>
    <div ref="chatFeedRef" class="toolkit-ai-chat-feed">
      <article
        v-for="message in messages"
        :key="message.id"
        class="toolkit-ai-message"
        :class="[
          `toolkit-ai-message--${message.role}`,
          { 'is-pending': message.pending, 'is-error': message.error }
        ]">
        <div class="toolkit-ai-bubble">
          <header class="toolkit-ai-bubble-head">
            <div class="toolkit-ai-bubble-head-main">
              <div class="toolkit-ai-marker" aria-hidden="true">
                <span class="material-symbols-outlined">{{ roleIcon(message.role) }}</span>
              </div>
              <div class="toolkit-ai-bubble-meta">
                <span>{{ roleLabel(message.role) }}</span>
                <time>{{ formatTimestamp(message.createdAt) }}</time>
                <span v-if="message.usageTokens" class="toolkit-ai-token-meta">
                  {{ t('toolkit.aiTokens', { count: message.usageTokens }) }}
                </span>
              </div>
            </div>
            <UiButton
              v-if="message.role === 'assistant' && !message.pending && message.text"
              native-type="button"
              preset="overlay-chip-soft"
              @click="copyMessage(getMessageText(message))">
              <span class="material-symbols-outlined" aria-hidden="true">content_copy</span>
              <span>{{ t('toolkit.aiCopyMessage') }}</span>
            </UiButton>
          </header>
          <template v-if="message.role === 'assistant'">
            <div
              v-if="getMessageReasoning(message) || (message.pending && message.thinkingEnabled)"
              class="toolkit-ai-thinking-shell">
              <button
                type="button"
                class="toolkit-ai-thinking-toggle"
                :aria-expanded="message.thinkingExpanded"
                @click="toggleThinkingExpanded(message.id)">
                <span class="material-symbols-outlined" aria-hidden="true">
                  {{ message.thinkingExpanded ? 'keyboard_arrow_down' : 'keyboard_arrow_right' }}
                </span>
                <span>
                  {{
                    message.thinkingExpanded
                      ? t('toolkit.aiThinkingCollapse')
                      : getMessageReasoning(message)
                        ? t('toolkit.aiThinkingExpand')
                        : t('toolkit.aiThinkingPending')
                  }}
                </span>
              </button>
              <div v-if="message.thinkingExpanded" class="toolkit-ai-thinking">
                <article
                  v-if="getMessageReasoning(message)"
                  class="toolkit-ai-markdown toolkit-ai-thinking-markdown"
                  v-html="renderMessageMarkdown(getMessageReasoning(message))"></article>
                <p v-else class="toolkit-ai-stream-placeholder">{{ t('toolkit.aiThinkingPending') }}</p>
              </div>
            </div>
            <article
              v-if="message.text"
              class="toolkit-ai-markdown toolkit-ai-bubble-markdown"
              v-html="renderMessageMarkdown(getMessageText(message))"></article>
            <p v-else class="toolkit-ai-stream-placeholder">{{ t('toolkit.aiPendingMessage') }}</p>
          </template>
          <p v-else class="toolkit-ai-bubble-text">{{ getMessageText(message) }}</p>
          <div v-if="message.attachments.length" class="toolkit-ai-bubble-files">
            <span v-for="attachment in message.attachments" :key="attachment.id" class="toolkit-ai-file-chip">
              {{ attachment.name }} · {{ attachmentKindLabel(attachment) }}
            </span>
          </div>
        </div>
      </article>
    </div>

    <section
      class="toolkit-ai-composer-card"
      :class="{ 'is-drop-active': isDropActive }"
      @dragenter.prevent="handleDragEnter"
      @dragover.prevent="handleDragOver"
      @dragleave.prevent="handleDragLeave"
      @drop.prevent="handleDrop">
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
            <img
              v-if="isImageAttachment(attachment) && attachment.dataUrl"
              class="toolkit-ai-attachment-preview"
              :src="attachment.dataUrl"
              :alt="t('toolkit.aiAttachmentPreviewAlt')" />
            <div v-else class="toolkit-ai-attachment-icon">
              <span class="material-symbols-outlined" aria-hidden="true">{{ attachmentIcon(attachment) }}</span>
            </div>
            <div class="toolkit-ai-attachment-copy">
              <strong>{{ attachment.name }}</strong>
              <span>{{ attachmentKindLabel(attachment) }} · {{ formatFileSize(attachment.size) }}</span>
            </div>
            <button
              type="button"
              class="toolkit-ai-attachment-remove"
              :aria-label="t('toolkit.aiAttachmentRemove')"
              @click="removeAttachment(attachment.id)">
              <span class="material-symbols-outlined" aria-hidden="true">close</span>
            </button>
          </article>
        </div>
      </div>

      <!-- <p class="toolkit-ai-hint">{{ isDropActive ? t('toolkit.aiDropHint') : t('toolkit.aiShortcutHint') }}</p> -->

      <textarea
        ref="composerRef"
        v-model="draft"
        class="toolkit-ai-composer"
        :placeholder="t('toolkit.aiInputPlaceholder')"
        :disabled="sending || !isTauriRuntime"
        @keydown="handleComposerKeydown"></textarea>

      <div class="toolkit-ai-toolbar">
        <div class="toolkit-ai-toolbar-actions">
          <UiSwitch
            v-model="thinkingEnabled"
            variant="button"
            :disabled="sending || !isTauriRuntime"
            :aria-label="t('toolkit.aiThinkingToggle')">
            <span class="material-symbols-outlined" aria-hidden="true">neurology</span>
            <span>{{ t('toolkit.aiThinkingToggle') }}</span>
          </UiSwitch>
          <UiButton
            native-type="button"
            preset="overlay-chip-soft"
            size="sm"
            :disabled="sending"
            @click="clearConversation">
            {{ t('toolkit.aiClear') }}
          </UiButton>
          <label class="toolkit-ai-upload-button" :class="{ 'is-disabled': !isTauriRuntime }">
            <input
              class="toolkit-ai-upload-input"
              type="file"
              multiple
              :disabled="!isTauriRuntime"
              accept="image/*,.txt,.md,.markdown,.json,.csv,.log,.yaml,.yml,.toml,.ini,.xml"
              @change="handleFileChange" />
            <span class="material-symbols-outlined" aria-hidden="true">attach_file</span>
            <span>{{ t('toolkit.aiUpload') }}</span>
          </label>
          <UiButton
            class="toolkit-ai-send-button"
            native-type="button"
            preset="overlay-primary"
            size="sm"
            :width="60"
            :disabled="sendDisabled"
            @click="sendMessage">
            {{ sending ? t('toolkit.aiSending') : t('toolkit.aiSend') }}
          </UiButton>
        </div>
      </div>
    </section>
  </UiCollapsiblePanel>
</template>

<script setup lang="ts">
import { computed, nextTick, onBeforeUnmount, onMounted, ref, watch } from 'vue';
import { useI18n } from 'vue-i18n';

import UiButton from '@/components/ui/Button';
import UiCollapsiblePanel from '@/components/ui/CollapsiblePanel';
import UiSwitch from '@/components/ui/Switch';
import { useToastService } from '@/composables/useToastService';
import { storageKeys, storageRepository } from '@/services/storageRepository';
import { api, inTauri, listenEvent } from '@/services/tauri';
import type {
  LocalAiAttachment,
  LocalAiChatMessage,
  LocalAiStatus,
  LocalAiStreamEvent,
  LocalAiTokenUsage
} from '@/types';
import { renderMarkdown } from '@/utils/markdown';

const props = withDefaults(defineProps<{ toastChannel?: string }>(), {
  toastChannel: 'toolkit-ai'
});

type ChatPanelState = {
  localStatus: LocalAiStatus | null;
  selectedModelDir: string | null;
  selectedLauncherDir: string | null;
  launcherNeedsSelection: boolean;
  workspaceStateTone: string;
  workspaceStateLabel: string;
  contextWindowSize: number;
  conversationTurns: number;
  capabilityLabel: string;
  statusBusy: boolean;
  isTauriRuntime: boolean;
};

const emit = defineEmits<{
  (event: 'contentChange'): void;
  (event: 'stateChange', value: ChatPanelState): void;
}>();

type UiAttachment = LocalAiAttachment & { id: string };
type UiMessage = {
  id: string;
  role: 'user' | 'assistant' | 'system';
  text: string;
  reasoningText: string;
  thinkingEnabled: boolean;
  thinkingExpanded: boolean;
  attachments: UiAttachment[];
  pending: boolean;
  error: boolean;
  usageTokens: number | null;
  createdAt: number;
};

const MAX_IMAGE_FILE_SIZE = 8 * 1024 * 1024;
const MAX_COMPOSER_HEIGHT = 150;
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

const { t, locale } = useI18n();
const { showToast } = useToastService(props.toastChannel);
const isTauriRuntime = inTauri();
const statusBusy = ref(false);
const sending = ref(false);
const isDropActive = ref(false);
const localStatus = ref<LocalAiStatus | null>(null);
const selectedModelDir = ref<string | null>(null);
const selectedLauncherDir = ref<string | null>(null);
const draft = ref('');
const thinkingEnabled = ref(false);
const attachments = ref<UiAttachment[]>([]);
const messages = ref<UiMessage[]>([createWelcomeMessage()]);
const chatOpen = ref(true);
const chatFeedRef = ref<HTMLElement | null>(null);
const composerRef = ref<HTMLTextAreaElement | null>(null);
const activeStreamRequestId = ref<string | null>(null);
const thinkingTagState = new Map<string, { insideThink: boolean; pendingTag: string }>();

let unlistenLocalAiStream: (() => void) | null = null;

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

const capabilityLabel = computed(() =>
  localStatus.value?.visionEnabled ? t('toolkit.aiModeVision') : t('toolkit.aiModeText')
);
const conversationTurns = computed(() => messages.value.filter(message => message.role === 'user').length);
const contextWindowSize = computed(
  () =>
    messages.value
      .filter(message => (message.role === 'user' || message.role === 'assistant') && !message.pending)
      .slice(-10).length
);
const sendDisabled = computed(
  () => sending.value || !isTauriRuntime || (!draft.value.trim() && attachments.value.length === 0)
);
const messageRenderSignature = computed(() =>
  messages.value
    .map(message =>
      [
        message.id,
        message.pending ? '1' : '0',
        message.error ? '1' : '0',
        message.text.length,
        message.reasoningText.length,
        message.usageTokens ?? ''
      ].join(':')
    )
    .join('|')
);
const panelState = computed<ChatPanelState>(() => ({
  localStatus: localStatus.value,
  selectedModelDir: selectedModelDir.value ?? localStatus.value?.selectedModelDir ?? null,
  selectedLauncherDir: selectedLauncherDir.value ?? localStatus.value?.selectedLauncherDir ?? null,
  launcherNeedsSelection: localStatus.value?.launcherNeedsSelection ?? false,
  workspaceStateTone: workspaceStateTone.value,
  workspaceStateLabel: workspaceStateLabel.value,
  contextWindowSize: contextWindowSize.value,
  conversationTurns: conversationTurns.value,
  capabilityLabel: capabilityLabel.value,
  statusBusy: statusBusy.value,
  isTauriRuntime
}));

onMounted(() => {
  autoResizeComposer();
  restoreSavedModelDir();
  restoreSavedLauncherDir();
  if (isTauriRuntime) {
    void refreshStatus();
    void setupLocalAiStreamListener();
  }
});

onBeforeUnmount(() => {
  if (unlistenLocalAiStream) {
    unlistenLocalAiStream();
    unlistenLocalAiStream = null;
  }
});

watch(
  panelState,
  value => {
    emit('stateChange', value);
  },
  { immediate: true }
);

watch(
  () => [messageRenderSignature.value, attachments.value.length, statusBusy.value, localStatus.value?.ready],
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
  // target.style.height = `${Math.min(target.scrollHeight, MAX_COMPOSER_HEIGHT)}px`;
}

function focusComposer() {
  composerRef.value?.focus();
}

async function setupLocalAiStreamListener() {
  if (!isTauriRuntime || unlistenLocalAiStream) return;
  unlistenLocalAiStream = await listenEvent<LocalAiStreamEvent>('local-ai://stream', payload => {
    if (!activeStreamRequestId.value || payload.requestId !== activeStreamRequestId.value) return;
    appendPendingMessageStream(payload.requestId, payload.channel, payload.delta);
  });
}

function restoreSavedModelDir() {
  const savedDir = storageRepository.getStringSync(storageKeys.localAiModelDir) ?? null;
  if (savedDir && !selectedModelDir.value) {
    setSelectedModelDir(savedDir);
  }
}

function restoreSavedLauncherDir() {
  const savedDir = storageRepository.getStringSync(storageKeys.localAiLauncherDir) ?? null;
  if (savedDir && !selectedLauncherDir.value) {
    setSelectedLauncherDir(savedDir);
  }
}

function persistSelectedModelDir(value: string | null) {
  if (!value) return;
  storageRepository.setStringSync(storageKeys.localAiModelDir, value);
  void storageRepository.setString(storageKeys.localAiModelDir, value);
}

function persistSelectedLauncherDir(value: string | null) {
  if (!value) return;
  storageRepository.setStringSync(storageKeys.localAiLauncherDir, value);
  void storageRepository.setString(storageKeys.localAiLauncherDir, value);
}

async function refreshStatus() {
  if (!isTauriRuntime || statusBusy.value) return;
  statusBusy.value = true;
  try {
    localStatus.value = await api.getLocalAiStatus();
    selectedModelDir.value = localStatus.value.selectedModelDir ?? selectedModelDir.value;
    selectedLauncherDir.value = localStatus.value.selectedLauncherDir ?? selectedLauncherDir.value;
    persistSelectedModelDir(selectedModelDir.value);
    persistSelectedLauncherDir(selectedLauncherDir.value);
  } catch (error) {
    const message = normalizeErrorMessage(error);
    localStatus.value = {
      ready: false,
      running: false,
      modelName: '0.8B',
      selectedModelDir: selectedModelDir.value,
      selectedLauncherDir: selectedLauncherDir.value,
      modelPath: null,
      serverPath: null,
      serverUrl: '-',
      visionEnabled: false,
      launcherNeedsSelection: false,
      message
    };
    showToast(t('toolkit.aiStartFailed', { message }), { variant: 'error' });
  } finally {
    statusBusy.value = false;
  }
}

async function startLocalAi(modelDir?: string | null, launcherDir?: string | null) {
  if (!isTauriRuntime || statusBusy.value) return;
  const nextDir = modelDir ?? selectedModelDir.value;
  const nextLauncherDir = launcherDir ?? selectedLauncherDir.value;
  if (!nextDir) {
    const message = '请先选择模型文件夹。';
    showToast(message, { variant: 'warning' });
    localStatus.value = {
      ready: false,
      running: false,
      modelName: localStatus.value?.modelName ?? '0.8B',
      selectedModelDir: null,
      selectedLauncherDir: nextLauncherDir ?? null,
      modelPath: null,
      serverPath: localStatus.value?.serverPath ?? null,
      serverUrl: localStatus.value?.serverUrl ?? '-',
      visionEnabled: false,
      launcherNeedsSelection: localStatus.value?.launcherNeedsSelection ?? false,
      message
    };
    return;
  }

  statusBusy.value = true;
  selectedModelDir.value = nextDir;
  selectedLauncherDir.value = nextLauncherDir ?? null;
  try {
    localStatus.value = await api.startLocalAiRuntime(nextDir, nextLauncherDir);
    selectedModelDir.value = localStatus.value.selectedModelDir ?? nextDir;
    selectedLauncherDir.value =
      localStatus.value.selectedLauncherDir ??
      (localStatus.value.launcherNeedsSelection ? nextLauncherDir ?? null : null);
    persistSelectedModelDir(selectedModelDir.value);
    persistSelectedLauncherDir(selectedLauncherDir.value);
  } catch (error) {
    const message = normalizeErrorMessage(error);
    localStatus.value = {
      ready: false,
      running: false,
      modelName: localStatus.value?.modelName ?? '0.8B',
      selectedModelDir: nextDir,
      selectedLauncherDir: nextLauncherDir ?? null,
      modelPath: null,
      serverPath: localStatus.value?.serverPath ?? null,
      serverUrl: localStatus.value?.serverUrl ?? localStatus.value?.serverUrl ?? '-',
      visionEnabled: false,
      launcherNeedsSelection: localStatus.value?.launcherNeedsSelection ?? false,
      message
    };
    showToast(t('toolkit.aiStartFailed', { message }), { variant: 'error' });
  } finally {
    statusBusy.value = false;
  }
}

async function stopLocalAi() {
  if (!isTauriRuntime || statusBusy.value) return;
  statusBusy.value = true;
  try {
    localStatus.value = await api.stopLocalAiRuntime();
    selectedModelDir.value = localStatus.value.selectedModelDir ?? selectedModelDir.value;
    selectedLauncherDir.value = localStatus.value.selectedLauncherDir ?? selectedLauncherDir.value;
  } catch (error) {
    showToast(normalizeErrorMessage(error), { variant: 'error' });
  } finally {
    statusBusy.value = false;
  }
}

function setSelectedModelDir(value: string | null) {
  selectedModelDir.value = value;
  if (localStatus.value) {
    localStatus.value = {
      ...localStatus.value,
      selectedModelDir: value
    };
  }
}

function setSelectedLauncherDir(value: string | null) {
  selectedLauncherDir.value = value;
  if (localStatus.value) {
    localStatus.value = {
      ...localStatus.value,
      selectedLauncherDir: value
    };
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
    .map(message => ({ role: message.role, content: getMessageText(message) }));

  const userMessage: UiMessage = {
    id: makeId(),
    role: 'user',
    text: effectivePrompt,
    reasoningText: '',
    thinkingEnabled: false,
    thinkingExpanded: false,
    attachments: attachments.value.map(copyAttachment),
    pending: false,
    error: false,
    usageTokens: null,
    createdAt: Date.now()
  };

  const pendingMessage: UiMessage = {
    id: makeId(),
    role: 'assistant',
    text: '',
    reasoningText: '',
    thinkingEnabled: thinkingEnabled.value,
    thinkingExpanded: thinkingEnabled.value,
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
  activeStreamRequestId.value = pendingMessage.id;

  try {
    const response = await api.sendLocalAiMessage({
      requestId: pendingMessage.id,
      enableThinking: thinkingEnabled.value,
      prompt: effectivePrompt,
      history: requestHistory,
      attachments: requestAttachments
    });
    localStatus.value = response.status;
    const finalizedReply = finalizeAssistantReply(pendingMessage.id, response.reply, response.reasoning);
    const currentPendingMessage = findMessageById(pendingMessage.id);
    replacePendingMessage(pendingMessage.id, {
      id: pendingMessage.id,
      role: 'assistant',
      text: finalizedReply.reply,
      reasoningText: finalizedReply.reasoning || currentPendingMessage?.reasoningText || '',
      thinkingEnabled:
        currentPendingMessage?.thinkingEnabled ??
        Boolean(finalizedReply.reasoning || currentPendingMessage?.reasoningText),
      thinkingExpanded: false,
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
      reasoningText: findMessageById(pendingMessage.id)?.reasoningText ?? '',
      thinkingEnabled: findMessageById(pendingMessage.id)?.thinkingEnabled ?? thinkingEnabled.value,
      thinkingExpanded: findMessageById(pendingMessage.id)?.thinkingExpanded ?? thinkingEnabled.value,
      attachments: [],
      pending: false,
      error: true,
      usageTokens: null,
      createdAt: Date.now()
    });
    showToast(t('toolkit.aiReplyFailed', { message }), { variant: 'error' });
  } finally {
    thinkingTagState.delete(pendingMessage.id);
    activeStreamRequestId.value = null;
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

function toggleThinkingExpanded(id: string) {
  messages.value = messages.value.map(message =>
    message.id === id ? { ...message, thinkingExpanded: !message.thinkingExpanded } : message
  );
}

function appendPendingMessageStream(id: string, channel: LocalAiStreamEvent['channel'], delta: string) {
  if (!delta) return;
  messages.value = messages.value.map(message => {
    if (message.id !== id) return message;
    const parsed =
      channel === 'reply'
        ? consumeTaggedAssistantDelta(id, delta)
        : { reasoning: message.thinkingEnabled ? delta : '', reply: '' };
    return {
      ...message,
      reasoningText: `${message.reasoningText}${parsed.reasoning}`,
      text: `${message.text}${parsed.reply}`
    };
  });
}

function findMessageById(id: string) {
  return messages.value.find(message => message.id === id) ?? null;
}

function consumeTaggedAssistantDelta(id: string, delta: string) {
  const state = thinkingTagState.get(id) ?? { insideThink: false, pendingTag: '' };
  const text = `${state.pendingTag}${delta}`;
  let cursor = 0;
  let reasoning = '';
  let reply = '';

  while (cursor < text.length) {
    if (state.insideThink) {
      const closeIndex = text.indexOf('</think>', cursor);
      if (closeIndex === -1) {
        const trailingTagIndex = findTrailingThinkTagStart(text, cursor);
        if (trailingTagIndex >= 0) {
          reasoning += text.slice(cursor, trailingTagIndex);
          state.pendingTag = text.slice(trailingTagIndex);
        } else {
          reasoning += text.slice(cursor);
          state.pendingTag = '';
        }
        thinkingTagState.set(id, state);
        return { reasoning, reply };
      }

      reasoning += text.slice(cursor, closeIndex);
      state.insideThink = false;
      cursor = closeIndex + '</think>'.length;
      continue;
    }

    const openIndex = text.indexOf('<think>', cursor);
    if (openIndex === -1) {
      const trailingTagIndex = findTrailingThinkTagStart(text, cursor);
      if (trailingTagIndex >= 0) {
        reply += text.slice(cursor, trailingTagIndex);
        state.pendingTag = text.slice(trailingTagIndex);
      } else {
        reply += text.slice(cursor);
        state.pendingTag = '';
      }
      thinkingTagState.set(id, state);
      return { reasoning, reply };
    }

    reply += text.slice(cursor, openIndex);
    state.insideThink = true;
    cursor = openIndex + '<think>'.length;
  }

  state.pendingTag = '';
  thinkingTagState.set(id, state);
  return { reasoning, reply };
}

function finalizeAssistantReply(id: string, reply: string, reasoning: string | null) {
  const streamedMessage = findMessageById(id);
  const parsedReply = splitAssistantTaggedText(reply);
  const nextReasoning = reasoning ?? parsedReply.reasoning ?? streamedMessage?.reasoningText ?? '';
  const nextReply = parsedReply.reply || streamedMessage?.text || reply;
  thinkingTagState.delete(id);

  return {
    reasoning: sanitizeAiMessageText(nextReasoning),
    reply: sanitizeAiMessageText(nextReply)
  };
}

function splitAssistantTaggedText(text: string) {
  if (!text.includes('<think>')) {
    return { reasoning: '', reply: text };
  }

  let cursor = 0;
  let reasoning = '';
  let reply = '';
  let insideThink = false;

  while (cursor < text.length) {
    if (insideThink) {
      const closeIndex = text.indexOf('</think>', cursor);
      if (closeIndex === -1) {
        reasoning += text.slice(cursor);
        break;
      }
      reasoning += text.slice(cursor, closeIndex);
      insideThink = false;
      cursor = closeIndex + '</think>'.length;
      continue;
    }

    const openIndex = text.indexOf('<think>', cursor);
    if (openIndex === -1) {
      reply += text.slice(cursor);
      break;
    }
    reply += text.slice(cursor, openIndex);
    insideThink = true;
    cursor = openIndex + '<think>'.length;
  }

  return { reasoning, reply };
}

function findTrailingThinkTagStart(text: string, fromIndex: number) {
  const nextStart = text.lastIndexOf('<', text.length - 1);
  if (nextStart < fromIndex) return -1;
  const tail = text.slice(nextStart);
  return '<think>'.startsWith(tail) || '</think>'.startsWith(tail) ? nextStart : -1;
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

function toggleChatOpen() {
  chatOpen.value = !chatOpen.value;
  emit('contentChange');
}

function handleToggle() {
  emit('contentChange');
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
  const seen = new Set(
    existing.map(attachment => `${attachment.name}:${attachment.size}:${attachment.mediaType}`)
  );
  return [
    ...existing,
    ...incoming.filter(attachment => {
      const key = `${attachment.name}:${attachment.size}:${attachment.mediaType}`;
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    })
  ];
}

async function copyMessage(text: string) {
  try {
    if (typeof navigator === 'undefined' || !navigator.clipboard?.writeText) {
      throw new Error('clipboard unavailable');
    }
    await navigator.clipboard.writeText(text);
    showToast(t('toolkit.aiCopySuccess'), { variant: 'success' });
  } catch {
    showToast(t('toolkit.aiCopyFailed'), { variant: 'error' });
  }
}

async function buildAttachment(file: File): Promise<UiAttachment> {
  if (file.type.startsWith('image/')) {
    if (file.size > MAX_IMAGE_FILE_SIZE) throw new Error(t('toolkit.aiFileTooLarge'));
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
  if (file.type.startsWith('text/')) return true;
  return TEXT_FILE_EXTENSIONS.has(file.name.split('.').pop()?.toLowerCase() ?? '');
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
  if (error instanceof Error) return error.message;
  if (typeof error === 'string') return error;
  return t('toolkit.aiUnknownError');
}

function sanitizeAiMessageText(text: string) {
  return text.replace(/<\/?think>/gi, '').trimStart();
}

function getMessageText(message: UiMessage) {
  return message.role === 'assistant' ? sanitizeAiMessageText(message.text) : message.text;
}

function getMessageReasoning(message: UiMessage) {
  return message.role === 'assistant' ? sanitizeAiMessageText(message.reasoningText) : '';
}

function renderMessageMarkdown(text: string) {
  return renderMarkdown(sanitizeAiMessageText(text));
}

function createWelcomeMessage(): UiMessage {
  return {
    id: makeId(),
    role: 'assistant',
    text: sanitizeAiMessageText(t('toolkit.aiWelcome')),
    reasoningText: '',
    thinkingEnabled: false,
    thinkingExpanded: false,
    attachments: [],
    pending: false,
    error: false,
    usageTokens: null,
    createdAt: Date.now()
  };
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

defineExpose({
  refreshStatus,
  startLocalAi,
  stopLocalAi,
  setSelectedModelDir,
  setSelectedLauncherDir
});
</script>

<style scoped>
.toolkit-ai-composer-card,
.toolkit-ai-attachment-stage {
  display: grid;
  /* gap: 8px; */
}

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
  font-size: 9px;
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

.toolkit-ai-header-stat,
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

.toolkit-ai-header-stats {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  flex-wrap: wrap;
  cursor: default;
  user-select: none;
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

.toolkit-ai-bubble-files,
.toolkit-ai-toolbar-actions,
.toolkit-ai-toolbar {
  display: flex;
  gap: 8px;
}

.toolkit-ai-bubble-files {
  flex-wrap: wrap;
}

.toolkit-ai-chat-feed {
  height: 150px;
  /* max-height: 440px; */
  overflow-y: auto;
  display: grid;
  gap: 12px;
  padding-right: 2px;
  padding-bottom: 8px;
}

.toolkit-ai-toolbar {
  align-items: center;
  justify-content: flex-end;
  flex-wrap: nowrap;
}

.toolkit-ai-toolbar-actions {
  display: flex;
  align-items: center;
  justify-content: flex-start;
  gap: 5px;
  flex-wrap: nowrap;
  width: auto;
}

.toolkit-ai-toolbar-actions :deep(.ui-button) {
  flex: 0 0 auto;
  white-space: nowrap;
}

.toolkit-ai-toolbar-actions :deep(.ui-button__content) {
  white-space: nowrap;
}

.toolkit-ai-send-button {
  --btn-width: auto;
  --btn-min-width: 0;
  --btn-padding: 0 6px;
  --btn-letter-spacing: 0;
  min-width: 0;
  width: auto;
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
  padding: 5px;
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
  font-size: 12px;
  line-height: 1.55;
  white-space: pre-wrap;
  word-break: break-word;
}

.toolkit-ai-markdown {
  color: rgba(255, 255, 255, 0.94);
  font-size: 12px;
  line-height: 1.6;
  word-break: break-word;
}

.toolkit-ai-bubble-markdown {
  min-width: 0;
}

.toolkit-ai-markdown :deep(p),
.toolkit-ai-markdown :deep(blockquote),
.toolkit-ai-markdown :deep(ul),
.toolkit-ai-markdown :deep(ol),
.toolkit-ai-markdown :deep(pre),
.toolkit-ai-markdown :deep(h1),
.toolkit-ai-markdown :deep(h2),
.toolkit-ai-markdown :deep(h3),
.toolkit-ai-markdown :deep(h4),
.toolkit-ai-markdown :deep(h5),
.toolkit-ai-markdown :deep(h6) {
  margin: 0;
}

.toolkit-ai-markdown :deep(p + p),
.toolkit-ai-markdown :deep(p + ul),
.toolkit-ai-markdown :deep(p + ol),
.toolkit-ai-markdown :deep(p + blockquote),
.toolkit-ai-markdown :deep(ul + p),
.toolkit-ai-markdown :deep(ol + p),
.toolkit-ai-markdown :deep(blockquote + p),
.toolkit-ai-markdown :deep(pre + p),
.toolkit-ai-markdown :deep(p + pre) {
  margin-top: 8px;
}

.toolkit-ai-markdown :deep(h1),
.toolkit-ai-markdown :deep(h2),
.toolkit-ai-markdown :deep(h3) {
  font-size: 13px;
  line-height: 1.45;
}

.toolkit-ai-markdown :deep(ul),
.toolkit-ai-markdown :deep(ol) {
  padding-left: 18px;
}

.toolkit-ai-markdown :deep(li + li) {
  margin-top: 4px;
}

.toolkit-ai-markdown :deep(a) {
  color: rgba(125, 211, 252, 0.98);
}

.toolkit-ai-markdown :deep(blockquote) {
  padding-left: 10px;
  border-left: 2px solid rgba(125, 211, 252, 0.4);
  color: rgba(220, 238, 255, 0.84);
}

.toolkit-ai-markdown :deep(code) {
  padding: 1px 5px;
  border-radius: 6px;
  background: rgba(255, 255, 255, 0.08);
  font-family: 'JetBrains Mono', monospace;
  font-size: 11px;
}

.toolkit-ai-markdown :deep(.markdown-code-block) {
  display: grid;
  gap: 8px;
  padding: 10px;
  overflow-x: auto;
  border-radius: 10px;
  background: rgba(3, 7, 18, 0.56);
  border: 1px solid rgba(255, 255, 255, 0.08);
}

.toolkit-ai-markdown :deep(.markdown-code-block code) {
  padding: 0;
  background: transparent;
  font-size: 11px;
  line-height: 1.55;
}

.toolkit-ai-markdown :deep(.markdown-code-block__lang) {
  color: rgba(255, 255, 255, 0.56);
  font-size: 10px;
  letter-spacing: 0.08em;
  text-transform: uppercase;
}

.toolkit-ai-thinking {
  display: grid;
  gap: 8px;
  margin: 0;
  padding: 8px 10px;
  border-radius: 10px;
  border: 1px dashed rgba(125, 211, 252, 0.24);
  background: rgba(7, 18, 34, 0.34);
}

.toolkit-ai-thinking-shell {
  display: grid;
  gap: 6px;
}

.toolkit-ai-thinking-toggle {
  display: inline-flex;
  align-items: center;
  gap: 4px;
  width: fit-content;
  padding: 0;
  border: 0;
  background: transparent;
  cursor: pointer;
  color: rgba(125, 211, 252, 0.94);
  font-size: 10px;
  letter-spacing: 0.08em;
  text-transform: uppercase;
}

.toolkit-ai-thinking-toggle .material-symbols-outlined {
  font-size: 14px;
}

.toolkit-ai-thinking-markdown {
  color: rgba(212, 235, 255, 0.88);
}

.toolkit-ai-stream-placeholder {
  margin: 0;
  color: rgba(255, 255, 255, 0.62);
  font-size: 11px;
  line-height: 1.55;
}

.toolkit-ai-composer-card {
  border: 0;
  background: transparent;
  /* padding: 12px; */
  transition:
    border-color var(--motion-duration-fast) var(--motion-ease-standard),
    background var(--motion-duration-fast) var(--motion-ease-standard);
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
  justify-content: center;
  min-height: 24px;
  padding: 0 8px;
  border-radius: 8px;
  border: 1px dashed rgba(255, 255, 255, 0.24);
  background: rgba(255, 255, 255, 0.03);
  cursor: pointer;
  font-size: 11px;
  line-height: 1;
  white-space: nowrap;
  flex: 0 0 auto;
}

.toolkit-ai-upload-button .material-symbols-outlined {
  font-size: 14px;
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
  height: 64px;
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
</style>
