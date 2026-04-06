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
    :launch-mode-label="chatState.launchModeLabel"
    :status-busy="chatState.statusBusy"
    :is-tauri-runtime="chatState.isTauriRuntime"
    @start-local-ai="handleStartLocalAi"
    @stop-local-ai="handleStopLocalAi"
    @content-change="emit('contentChange')" />

  <ToolkitAiChatPanel
    ref="chatPanelRef"
    :toast-channel="toastChannel"
    @content-change="emit('contentChange')"
    @state-change="handleChatStateChange" />
</template>

<script setup lang="ts">
import { reactive, ref } from 'vue';

import UiToast from '@/components/ui/Toast';
import type { LocalAiStatus } from '@/types';
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
  launchModeLabel: string;
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
  launchModeLabel: '-',
  statusBusy: false,
  isTauriRuntime: false
});

function handleChatStateChange(next: ChatOverviewState) {
  Object.assign(chatState, next);
}

async function handleStartLocalAi() {
  if (!chatState.selectedModelDir) return;
  await chatPanelRef.value?.startLocalAi(chatState.selectedModelDir, chatState.selectedLauncherDir);
}

async function handleStopLocalAi() {
  await chatPanelRef.value?.stopLocalAi();
}
</script>
