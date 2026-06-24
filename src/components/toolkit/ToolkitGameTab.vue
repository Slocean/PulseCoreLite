<template>
  <div v-if="subView === 'sync'" class="game-tool-view">
    <div class="invest-editor-header">
      <UiButton native-type="button" preset="toolkit-link" @click="subView = 'hub'">
        <span class="material-symbols-outlined">arrow_back</span>
        <span>{{ t('gameTools.backToHub') }}</span>
      </UiButton>
      <span class="invest-editor-title">{{ t('toolkit.gameSyncTitle') }}</span>
    </div>

    <ToolkitGameSyncTab @contentChange="emit('contentChange')" />
  </div>

  <div v-else class="game-hub">
    <div class="game-hub-header">
      <span class="game-hub-title">{{ t('gameTools.hubTitle') }}</span>
    </div>
    <div class="game-hub-grid">
      <button type="button" class="game-hub-card" @click="subView = 'sync'">
        <span class="material-symbols-outlined game-hub-card-icon">sync</span>
        <span class="game-hub-card-title">{{ t('gameTools.hubSyncTitle') }}</span>
        <span class="game-hub-card-desc">{{ t('gameTools.hubSyncDesc') }}</span>
        <span class="material-symbols-outlined game-hub-card-arrow">chevron_right</span>
      </button>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref } from 'vue';
import { useI18n } from 'vue-i18n';

import UiButton from '@/components/ui/Button';
import ToolkitGameSyncTab from './ToolkitGameSyncTab.vue';

type GameToolSubView = 'hub' | 'sync';

const emit = defineEmits<{
  (event: 'contentChange'): void;
}>();

const { t } = useI18n();
const subView = ref<GameToolSubView>('hub');
</script>

<style scoped>
.game-tool-view,
.game-hub {
  display: grid;
  gap: 10px;
}

.game-hub-header {
  padding: 2px 4px;
}

.game-hub-title {
  font-size: 12px;
  font-weight: 600;
  letter-spacing: 0.06em;
  color: rgba(255, 255, 255, 0.7);
  text-transform: uppercase;
}

.game-hub-grid {
  display: grid;
  gap: 8px;
}

.game-hub-card {
  display: grid;
  grid-template-columns: auto 1fr auto;
  grid-template-rows: auto auto;
  column-gap: 12px;
  row-gap: 3px;
  align-items: center;
  width: 100%;
  padding: 14px 14px 14px 16px;
  border-radius: 10px;
  border: 1px solid rgba(255, 255, 255, 0.08);
  background: rgba(255, 255, 255, 0.03);
  text-align: left;
  cursor: pointer;
  transition:
    background 0.14s,
    border-color 0.14s;
}

.game-hub-card:hover {
  background: rgba(255, 255, 255, 0.07);
  border-color: rgba(255, 255, 255, 0.14);
}

.game-hub-card-icon {
  grid-row: 1 / 3;
  font-size: 28px;
  color: rgba(80, 160, 255, 0.75);
  align-self: center;
}

.game-hub-card-title {
  font-size: 13px;
  font-weight: 600;
  color: rgba(255, 255, 255, 0.88);
  grid-column: 2;
  grid-row: 1;
}

.game-hub-card-desc {
  font-size: 11px;
  color: rgba(255, 255, 255, 0.42);
  grid-column: 2;
  grid-row: 2;
  line-height: 1.4;
}

.game-hub-card-arrow {
  grid-row: 1 / 3;
  font-size: 20px;
  color: rgba(255, 255, 255, 0.25);
  align-self: center;
}
</style>
