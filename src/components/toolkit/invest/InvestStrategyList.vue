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
      <div
        v-for="s in strategies"
        :key="s.id"
        class="invest-strategy-card"
        :class="{ 'is-selected': selectedForCompare.has(s.id) }">
        <div class="invest-strategy-card-header">
          <label class="invest-compare-checkbox">
            <input
              type="checkbox"
              :checked="selectedForCompare.has(s.id)"
              @change="emit('toggleCompare', s.id)" />
          </label>
          <div class="invest-strategy-info">
            <span class="invest-strategy-name">{{ s.name }}</span>
            <span class="invest-strategy-meta">
              {{ s.fundCode }}
              <template v-if="s.fundName"> · {{ s.fundName }}</template>
            </span>
          </div>
          <div class="invest-strategy-tags">
            <span class="invest-tag">{{ formatFrequency(s.frequency) }}</span>
            <span class="invest-tag invest-tag--amount">¥{{ s.amount.toLocaleString() }}</span>
          </div>
        </div>
        <div class="invest-strategy-card-footer">
          <span class="invest-strategy-date">{{ s.startDate }} → {{ s.endDate || t('invest.today') }}</span>
          <div class="invest-card-btns">
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
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { useI18n } from 'vue-i18n';

import UiButton from '@/components/ui/Button';
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
  (e: 'toggleCompare', id: string): void;
  (e: 'startCompare'): void;
}>();

const { t } = useI18n();

function formatFrequency(freq: InvestFrequency): string {
  const map: Record<InvestFrequency, string> = {
    daily: t('invest.freqDaily'),
    weekly: t('invest.freqWeekly'),
    monthly: t('invest.freqMonthly')
  };
  return map[freq];
}
</script>
