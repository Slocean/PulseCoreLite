<template>
  <UiToast :channel="toastChannel" />

  <ToolkitAiOverviewPanel
    v-model="overviewOpen"
    :local-status="chatState.localStatus"
    :workspace-state-tone="chatState.workspaceStateTone"
    :workspace-state-label="chatState.workspaceStateLabel"
    :context-window-size="chatState.contextWindowSize"
    :conversation-turns="chatState.conversationTurns"
    :capability-label="chatState.capabilityLabel"
    :status-busy="chatState.statusBusy"
    :is-tauri-runtime="chatState.isTauriRuntime"
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

import UiToast from '@/components/ui/Toast';
import type { LocalAiStatus } from '@/types';
import ToolkitAiChatPanel from './ToolkitAiChatPanel.vue';
import ToolkitAiOverviewPanel from './ToolkitAiOverviewPanel.vue';

const props = withDefaults(defineProps<{ toastChannel?: string }>(), {
  toastChannel: 'toolkit-ai'
});

const emit = defineEmits<{ (event: 'contentChange'): void }>();

type ChatOverviewState = {
  localStatus: LocalAiStatus | null;
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
};

const overviewOpen = ref(true);
const chatPanelRef = ref<ChatPanelExposed | null>(null);
const chatState = reactive<ChatOverviewState>({
  localStatus: null,
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
</script>
