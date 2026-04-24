<template>
  <div class="invest-list">
    <div class="invest-list-header">
      <span class="invest-list-title">{{ t('invest.strategiesTitle') }}</span>
      <div class="invest-list-actions">
        <UiButton
          v-if="selectedForCompare.size >= 2"
          native-type="button"
          preset="overlay-chip"
          @click="emit('startCompare')">
          <span class="material-symbols-outlined">compare_arrows</span>
          <span>{{ t('invest.compareBtn') }}({{ selectedForCompare.size }})</span>
        </UiButton>
        <UiButton native-type="button" preset="overlay-primary" @click="emit('create')">
          <span class="material-symbols-outlined">add</span>
          <span>{{ t('invest.createBtn') }}</span>
        </UiButton>
      </div>
    </div>

    <div v-if="strategies.length === 0" class="invest-empty">
      <span class="material-symbols-outlined invest-empty-icon">savings</span>
      <p>{{ t('invest.emptyHint') }}</p>
    </div>

    <div v-else class="invest-strategy-cards">
      <UiCollapsiblePanel
        v-for="s in strategies"
        :key="s.id"
        class="toolkit-card invest-strategy-card"
        :class="{ 'is-selected': selectedForCompare.has(s.id) }"
        :title="s.name"
        :model-value="isCardOpen(s.id)"
        header-mode="split"
        header-class="toolkit-section-header"
        split-title-preset="toolkit-collapse-title"
        split-toggle-preset="toolkit-collapse-icon"
        title-class="invest-card-title"
        indicator-class="toolkit-collapse-indicator"
        @toggle="onCardToggle(s.id, $event)">

        <template #header-actions>
          <div class="invest-card-header-actions">
            <label class="invest-compare-checkbox" @click.stop>
              <input
                type="checkbox"
                :checked="selectedForCompare.has(s.id)"
                @change="emit('toggleCompare', s.id)" />
            </label>
            <span class="invest-tag">{{ formatFrequency(s.frequency) }}</span>
            <span class="invest-tag invest-tag--fund-count">
              {{ t('invest.fundCount', { n: s.funds.length }) }}
            </span>
          </div>
        </template>

        <div class="invest-card-body">
          <div class="invest-card-meta">
            <div class="invest-strategy-funds">
              <span
                v-for="fund in s.funds"
                :key="fund.id"
                class="invest-strategy-fund-tag">
                <span class="invest-strategy-fund-code">{{ fund.fundCode }}</span>
                <span v-if="fund.fundName" class="invest-strategy-fund-name"> {{ fund.fundName }}</span>
                <span class="invest-strategy-fund-amount">¥{{ fund.amount.toLocaleString() }}</span>
              </span>
            </div>
            <span class="invest-strategy-date">{{ s.startDate }} → {{ s.endDate || t('invest.today') }}</span>
          </div>
          <div class="invest-card-actions">
            <UiButton native-type="button" preset="overlay-chip" @click="emit('backtestRecords', s.id)">
              <span class="material-symbols-outlined">history</span>
              <span>{{ t('invest.backtestRecordsBtn') }}</span>
            </UiButton>
            <UiButton native-type="button" preset="overlay-chip" @click="emit('backtest', s.id)">
              <span class="material-symbols-outlined">analytics</span>
              <span>{{ t('invest.backtestBtn') }}</span>
            </UiButton>
            <UiButton native-type="button" preset="overlay-chip" @click="emit('edit', s.id)">
              <span class="material-symbols-outlined">edit</span>
            </UiButton>
            <UiButton native-type="button" preset="overlay-action-danger" @click="emit('delete', s.id)">
              <span class="material-symbols-outlined">delete</span>
            </UiButton>
          </div>
        </div>
      </UiCollapsiblePanel>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref } from 'vue';
import { useI18n } from 'vue-i18n';

import UiButton from '@/components/ui/Button';
import UiCollapsiblePanel from '@/components/ui/CollapsiblePanel';
import type { InvestFrequency, InvestStrategy } from '@/types/invest';

defineProps<{
  strategies: InvestStrategy[];
  selectedForCompare: Set<string>;
}>();

const emit = defineEmits<{
  (e: 'create'): void;
  (e: 'edit', id: string): void;
  (e: 'delete', id: string): void;
  (e: 'backtest', id: string): void;
  (e: 'backtestRecords', id: string): void;
  (e: 'toggleCompare', id: string): void;
  (e: 'startCompare'): void;
}>();

const { t } = useI18n();

/** Set of card IDs that are collapsed; all others are open by default */
const collapsedCards = ref(new Set<string>());

function isCardOpen(id: string): boolean {
  return !collapsedCards.value.has(id);
}

function onCardToggle(id: string, nowOpen: boolean): void {
  if (nowOpen) {
    collapsedCards.value.delete(id);
  } else {
    collapsedCards.value.add(id);
  }
}

function formatFrequency(freq: InvestFrequency): string {
  const map: Record<InvestFrequency, string> = {
    daily: t('invest.freqDaily'),
    weekly: t('invest.freqWeekly'),
    monthly: t('invest.freqMonthly')
  };
  return map[freq];
}
</script>

<style scoped>
.invest-tag--fund-count {
  background: rgba(80, 140, 255, 0.1);
  border: 1px solid rgba(80, 140, 255, 0.25);
  color: rgba(160, 190, 255, 0.85);
}

.invest-strategy-funds {
  display: flex;
  flex-wrap: wrap;
  gap: 4px;
}

.invest-strategy-fund-tag {
  display: inline-flex;
  align-items: center;
  gap: 4px;
  padding: 2px 8px;
  border-radius: 5px;
  background: rgba(255, 255, 255, 0.04);
  border: 1px solid rgba(255, 255, 255, 0.09);
  font-size: 11px;
}

.invest-strategy-fund-code {
  color: rgba(80, 160, 255, 0.85);
  font-weight: 500;
}

.invest-strategy-fund-name {
  color: rgba(255, 255, 255, 0.5);
  max-width: 100px;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.invest-strategy-fund-amount {
  color: rgba(80, 220, 140, 0.8);
  font-size: 10px;
  font-variant-numeric: tabular-nums;
}
</style>
