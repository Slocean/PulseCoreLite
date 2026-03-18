<template>
  <UiToast :channel="toastChannel" />

  <ToolkitAiOverviewPanel
    style="margin-bottom: 8px"
    v-model="overviewOpen"
    :local-status="chatState.localStatus"
    :selected-model-dir="chatState.selectedModelDir"
    :selected-launcher-dir="chatState.selectedLauncherDir"
    :launcher-needs-selection="chatState.launcherNeedsSelection"
    :busy-state="chatState.busyState"
    :workspace-state-tone="chatState.workspaceStateTone"
    :workspace-state-label="chatState.workspaceStateLabel"
    :context-window-size="chatState.contextWindowSize"
    :conversation-turns="chatState.conversationTurns"
    :capability-label="chatState.capabilityLabel"
    :status-busy="chatState.statusBusy"
    :is-tauri-runtime="chatState.isTauriRuntime"
    @choose-model-dir="handleChooseModelDir"
    @choose-launcher-dir="handleChooseLauncherDir"
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
  selectedLauncherDir: string | null;
  launcherNeedsSelection: boolean;
  busyState: 'idle' | 'loading' | 'start' | 'stop';
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
  startLocalAi: (modelDir?: string | null, launcherDir?: string | null) => Promise<void>;
  stopLocalAi: () => Promise<void>;
  setSelectedModelDir: (value: string | null) => void;
  setSelectedLauncherDir: (value: string | null) => void;
};

const overviewOpen = ref(true);
const chatPanelRef = ref<ChatPanelExposed | null>(null);
const chatState = reactive<ChatOverviewState>({
  localStatus: null,
  selectedModelDir: null,
  selectedLauncherDir: null,
  launcherNeedsSelection: false,
  busyState: 'idle',
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
    await chatPanelRef.value?.startLocalAi(selected, chatState.selectedLauncherDir);
  }
}

async function handleChooseLauncherDir() {
  if (!inTauri()) return;
  const selected = await open({
    directory: true,
    multiple: false
  });
  if (typeof selected === 'string') {
    chatPanelRef.value?.setSelectedLauncherDir(selected);
  }
}

async function handleStartLocalAi() {
  if (!chatState.selectedModelDir) return;
  await chatPanelRef.value?.startLocalAi(chatState.selectedModelDir, chatState.selectedLauncherDir);
}

async function handleStopLocalAi() {
  await chatPanelRef.value?.stopLocalAi();
}
</script>
