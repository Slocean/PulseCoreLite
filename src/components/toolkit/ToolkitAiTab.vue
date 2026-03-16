<template>
  <UiToast :channel="toastChannel" />

  <ToolkitAiOverviewPanel
    v-model="overviewOpen"
    :local-status="chatState.localStatus"
    :selected-model-dir="chatState.selectedModelDir"
    :workspace-state-tone="chatState.workspaceStateTone"
    :workspace-state-label="chatState.workspaceStateLabel"
    :context-window-size="chatState.contextWindowSize"
    :conversation-turns="chatState.conversationTurns"
    :capability-label="chatState.capabilityLabel"
    :status-busy="chatState.statusBusy"
    :is-tauri-runtime="chatState.isTauriRuntime"
    @choose-model-dir="handleChooseModelDir"
    @start-local-ai="handleStartLocalAi"
    @stop-local-ai="handleStopLocalAi"
    @refresh-status="handleRefreshStatus"
    @content-change="emit('contentChange')" />

  <ToolkitAiChatPanel
    ref="chatPanelRef"
    :toast-channel="toastChannel"
    @content-change="emit('contentChange')"
    @state-change="handleChatStateChange" />
</template>

<script setup lang="ts">
import { reactive, ref } from 'vue';
import { open } from '@tauri-apps/plugin-dialog';

import UiToast from '@/components/ui/Toast';
import type { LocalAiStatus } from '@/types';
import { inTauri } from '@/services/tauri';
import ToolkitAiChatPanel from './ToolkitAiChatPanel.vue';
import ToolkitAiOverviewPanel from './ToolkitAiOverviewPanel.vue';

withDefaults(defineProps<{ toastChannel?: string }>(), {
  toastChannel: 'toolkit-ai'
});

const emit = defineEmits<{ (event: 'contentChange'): void }>();

type ChatOverviewState = {
  localStatus: LocalAiStatus | null;
  selectedModelDir: string | null;
  workspaceStateTone: string;
  workspaceStateLabel: string;
  contextWindowSize: number;
  conversationTurns: number;
  capabilityLabel: string;
  statusBusy: boolean;
  isTauriRuntime: boolean;
};

type ChatPanelExposed = {
  refreshStatus: () => Promise<void>;
  startLocalAi: (modelDir?: string | null) => Promise<void>;
  stopLocalAi: () => Promise<void>;
  setSelectedModelDir: (value: string | null) => void;
};

const overviewOpen = ref(true);
const chatPanelRef = ref<ChatPanelExposed | null>(null);
const chatState = reactive<ChatOverviewState>({
  localStatus: null,
  selectedModelDir: null,
  workspaceStateTone: 'muted',
  workspaceStateLabel: '-',
  contextWindowSize: 0,
  conversationTurns: 0,
  capabilityLabel: '-',
  statusBusy: false,
  isTauriRuntime: false
});

function handleChatStateChange(next: ChatOverviewState) {
  Object.assign(chatState, next);
}

async function handleRefreshStatus() {
  await chatPanelRef.value?.refreshStatus();
}

async function handleChooseModelDir() {
  if (!inTauri()) return;
  const selected = await open({
    directory: true,
    multiple: false
  });
  if (typeof selected === 'string') {
    chatPanelRef.value?.setSelectedModelDir(selected);
    await chatPanelRef.value?.startLocalAi(selected);
  }
}

async function handleStartLocalAi() {
  if (!chatState.selectedModelDir) return;
  await chatPanelRef.value?.startLocalAi(chatState.selectedModelDir);
}

async function handleStopLocalAi() {
  await chatPanelRef.value?.stopLocalAi();
}
</script>
