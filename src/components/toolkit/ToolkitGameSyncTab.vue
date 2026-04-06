<template>
  <UiToast channel="toolkit" />

  <UiCollapsiblePanel
    class="toolkit-card"
    :title="t('toolkit.gameSyncTitle')"
    :collapsible="false"
    title-class="toolkit-section-title">
    <p class="toolkit-profile-hint">{{ t('toolkit.gameSyncHint') }}</p>

    <div class="toolkit-game-sync-summary">
      <div class="toolkit-game-sync-stat">
        <span class="overlay-config-label">{{ t('toolkit.gameSyncSteamStatus') }}</span>
        <span class="toolkit-game-sync-value">{{ steamStatusText }}</span>
      </div>
      <div class="toolkit-game-sync-stat">
        <span class="overlay-config-label">{{ t('toolkit.gameSyncGameCount') }}</span>
        <span class="toolkit-game-sync-value">{{ games.length }}</span>
      </div>
      <div class="toolkit-game-sync-stat">
        <span class="overlay-config-label">{{ t('toolkit.gameSyncSelectedCount') }}</span>
        <span class="toolkit-game-sync-value">{{ selectedGameIds.length }}</span>
      </div>
    </div>

    <div class="overlay-config-row">
      <span class="overlay-config-label">{{ t('toolkit.gameSyncSteamAccount') }}</span>
      <UiSelect
        v-model="selectedSteamUserId"
        :width="240"
        :options="accountOptions"
        :placeholder="t('toolkit.gameSyncNoAccount')"
        :empty-text="t('toolkit.gameSyncNoAccount')"
        :disabled="loading || syncing || !runtimeSupported" />
    </div>

    <div class="toolkit-game-sync-actions">
      <UiButton
        native-type="button"
        preset="overlay-action-primary"
        :disabled="loading || syncing || !runtimeSupported"
        @click="scan()">
        {{ t('toolkit.gameSyncRescan') }}
      </UiButton>
      <UiButton native-type="button" preset="overlay-primary" :disabled="!canSync" @click="syncSelected">
        {{ syncButtonText }}
      </UiButton>
      <UiButton
        native-type="button"
        preset="overlay-action-primary"
        :disabled="loading || syncing || !syncableGameIds.length"
        @click="selectAllGames">
        {{ t('toolkit.gameSyncSelectAll') }}
      </UiButton>
      <UiButton
        native-type="button"
        preset="overlay-action-primary"
        :disabled="loading || syncing || !selectedGameIds.length"
        @click="clearSelection">
        {{ t('toolkit.gameSyncClearSelection') }}
      </UiButton>
      <UiButton
        native-type="button"
        preset="overlay-action-info"
        :disabled="!selectedAccount || loading || syncing"
        @click="openSteamFolder">
        {{ t('toolkit.gameSyncOpenSteamFolder') }}
      </UiButton>
    </div>

    <p v-if="!runtimeSupported" class="toolkit-error">{{ t('toolkit.gameSyncRequireDesktop') }}</p>
    <p v-else-if="scanState.steamRunning" class="toolkit-error">{{ t('toolkit.gameSyncWarningSteamRunning') }}</p>

    <div v-if="scanState.warnings.length" class="toolkit-game-sync-warning-list">
      <div class="toolkit-game-sync-warning" v-for="warning in scanState.warnings" :key="warning">
        {{ warning }}
      </div>
    </div>

    <div v-if="!games.length" class="toolkit-game-sync-empty">
      {{ t('toolkit.gameSyncNoGames') }}
    </div>

    <div v-else class="toolkit-game-sync-list">
      <UiCheckbox
        v-for="game in games"
        :key="game.id"
        v-model="selectedGameIds"
        class="toolkit-game-sync-item"
        :value="game.id"
        :disabled="syncing || !canSyncGame(game)">
        <div class="toolkit-game-sync-card">
          <div class="toolkit-game-sync-card-head">
            <span class="toolkit-game-sync-name">{{ game.title }}</span>
            <span class="toolkit-game-sync-badge" :class="statusClass(game.syncStatus.source)">
              {{ statusLabel(game.syncStatus.source) }}
            </span>
          </div>
          <div class="toolkit-game-sync-meta">
            {{ t('toolkit.gameSyncLaunchMode') }}: {{ launchModeLabel(game) }}
          </div>
          <div class="toolkit-game-sync-path">{{ game.installDir }}</div>
          <div v-if="!canSyncGame(game)" class="toolkit-game-sync-disabled">
            {{ t('toolkit.gameSyncUnsupportedLaunch') }}
          </div>
        </div>
      </UiCheckbox>
    </div>
  </UiCollapsiblePanel>
</template>

<script setup lang="ts">
import { computed, nextTick, onMounted, ref, watch } from 'vue';
import { useI18n } from 'vue-i18n';

import UiButton from '@/components/ui/Button';
import UiCheckbox from '@/components/ui/Checkbox';
import UiCollapsiblePanel from '@/components/ui/CollapsiblePanel';
import UiSelect from '@/components/ui/Select';
import UiToast from '@/components/ui/Toast';
import { useToastService } from '@/composables/useToastService';
import { api, inTauri } from '@/services/tauri';
import type { EpicInstalledGame, EpicSteamScanResult } from '@/types';

const emit = defineEmits<{
  (event: 'contentChange'): void;
}>();

const { t } = useI18n();
const { showToast } = useToastService('toolkit');
const runtimeSupported = computed(() => inTauri());
const loading = ref(false);
const syncing = ref(false);
const selectedSteamUserId = ref<string | null>(null);
const selectedGameIds = ref<string[]>([]);
const suppressAccountWatch = ref(false);
const scanState = ref<EpicSteamScanResult>({
  steamPath: null,
  steamRunning: false,
  selectedSteamUserId: null,
  accounts: [],
  epicGames: [],
  warnings: []
});

const games = computed(() => scanState.value.epicGames);
const accountOptions = computed(() =>
  scanState.value.accounts.map(account => ({
    value: account.id,
    label: account.label
  }))
);
const selectedAccount = computed(
  () => scanState.value.accounts.find(account => account.id === selectedSteamUserId.value) ?? null
);
const syncableGameIds = computed(() => games.value.filter(canSyncGame).map(game => game.id));
const steamStatusText = computed(() => {
  if (!scanState.value.steamPath) {
    return t('toolkit.gameSyncSteamMissing');
  }
  return scanState.value.steamRunning ? t('toolkit.gameSyncSteamRunning') : t('toolkit.gameSyncSteamClosed');
});
const syncButtonText = computed(() =>
  syncing.value ? t('toolkit.gameSyncSyncing') : t('toolkit.gameSyncSyncSelected')
);
const canSync = computed(
  () =>
    runtimeSupported.value &&
    !loading.value &&
    !syncing.value &&
    !scanState.value.steamRunning &&
    Boolean(selectedSteamUserId.value) &&
    selectedGameIds.value.some(id => syncableGameIds.value.includes(id))
);

onMounted(() => {
  if (!runtimeSupported.value) {
    return;
  }
  void scan();
});

watch(selectedSteamUserId, async (next, previous) => {
  if (!next || next === previous || suppressAccountWatch.value || loading.value || syncing.value) {
    return;
  }
  await scan(next);
});

watch(
  [loading, syncing, selectedGameIds, () => scanState.value.epicGames, () => scanState.value.warnings],
  () => {
    nextTick(() => emit('contentChange'));
  },
  { deep: true }
);

async function scan(targetUserId?: string | null) {
  if (!runtimeSupported.value) {
    return;
  }

  loading.value = true;
  const previousSelection = new Set(selectedGameIds.value);
  try {
    const result = await api.scanEpicGamesForSync(targetUserId ?? selectedSteamUserId.value ?? undefined);
    scanState.value = result;

    suppressAccountWatch.value = true;
    selectedSteamUserId.value = result.selectedSteamUserId ?? result.accounts[0]?.id ?? null;
    suppressAccountWatch.value = false;

    const availableIds = result.epicGames.filter(canSyncGame).map(game => game.id);
    const restored = availableIds.filter(id => previousSelection.has(id));
    selectedGameIds.value = restored.length ? restored : availableIds;
  } catch (error) {
    showToast(t('toolkit.gameSyncScanFailed', { message: normalizeErrorMessage(error) }), { variant: 'error' });
  } finally {
    suppressAccountWatch.value = false;
    loading.value = false;
  }
}

function canSyncGame(game: EpicInstalledGame) {
  return Boolean(game.epicAppName || game.launchExecutable);
}

function selectAllGames() {
  selectedGameIds.value = [...syncableGameIds.value];
}

function clearSelection() {
  selectedGameIds.value = [];
}

async function syncSelected() {
  if (!selectedSteamUserId.value) {
    showToast(t('toolkit.gameSyncNoAccount'), { variant: 'warning' });
    return;
  }
  const targetGameIds = syncableGameIds.value.filter(id => selectedGameIds.value.includes(id));
  if (!targetGameIds.length) {
    showToast(t('toolkit.gameSyncNoGames'), { variant: 'warning' });
    return;
  }

  syncing.value = true;
  try {
    const result = await api.syncEpicGamesToSteam({
      steamUserId: selectedSteamUserId.value,
      gameIds: targetGameIds,
      removeMissingManaged: true
    });
    showToast(
      t('toolkit.gameSyncSyncSuccess', {
        created: result.createdCount,
        updated: result.updatedCount,
        removed: result.removedCount
      }),
      { variant: 'success' }
    );
    await scan(selectedSteamUserId.value);
  } catch (error) {
    showToast(t('toolkit.gameSyncSyncFailed', { message: normalizeErrorMessage(error) }), {
      variant: 'error'
    });
  } finally {
    syncing.value = false;
  }
}

async function openSteamFolder() {
  const account = selectedAccount.value;
  if (!account) {
    return;
  }
  try {
    await api.openProfileOutputPath(account.gridDir || account.shortcutsPath);
  } catch (error) {
    showToast(normalizeErrorMessage(error), { variant: 'warning' });
  }
}

function statusLabel(source: string) {
  if (source === 'managed') return t('toolkit.gameSyncStatusManaged');
  if (source === 'existing') return t('toolkit.gameSyncStatusExisting');
  return t('toolkit.gameSyncStatusNew');
}

function statusClass(source: string) {
  return `is-${source}`;
}

function launchModeLabel(game: EpicInstalledGame) {
  return game.epicAppName ? t('toolkit.gameSyncLaunchEpic') : t('toolkit.gameSyncLaunchDirect');
}

function normalizeErrorMessage(error: unknown) {
  if (typeof error === 'string') return error;
  if (error && typeof error === 'object' && 'message' in error && typeof error.message === 'string') {
    return error.message;
  }
  return t('toolkit.aiUnknownError');
}
</script>
