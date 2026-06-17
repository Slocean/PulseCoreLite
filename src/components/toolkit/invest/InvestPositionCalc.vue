<template>
  <div class="invest-position-calc">
    <div class="invest-editor-header">
      <UiButton native-type="button" preset="toolkit-link" @click="emit('back')">
        <span class="material-symbols-outlined">arrow_back</span>
        <span>{{ t('invest.backToHub') }}</span>
      </UiButton>
      <span class="invest-editor-title">{{ t('invest.positionCalcTitle') }}</span>
    </div>

    <div class="invest-position-note">
      <span class="material-symbols-outlined invest-position-note-icon">info</span>
      <span>{{ t('invest.positionCalcNote') }}</span>
    </div>

    <PositionCalcSection
      mode="add"
      :title="t('invest.positionAddTitle')"
      :shares-label="t('invest.positionLabelShares')"
      :pnl-label="t('invest.positionLabelPnlPct')"
      :cost-label="t('invest.positionLabelAvgCost')"
      :current-price-label="t('invest.positionLabelCurrentPrice')"
      :price-label="t('invest.positionLabelAddPrice')"
      :trade-shares-label="t('invest.positionLabelAddShares')"
      :calc-btn="t('invest.positionCalcBtn')"
      :result-title="t('invest.positionResultAfterAdd')"
      :new-cost-label="t('invest.positionResultNewCost')"
      :new-shares-label="t('invest.positionResultNewShares')"
      :new-pnl-label="t('invest.positionResultNewPnl')"
      :error-invalid="t('invest.positionErrorInvalid')"
      :error-reduce-shares="t('invest.positionErrorReduceShares')"
      @content-change="emit('contentChange')" />

    <PositionCalcSection
      mode="reduce"
      :title="t('invest.positionReduceTitle')"
      :shares-label="t('invest.positionLabelShares')"
      :pnl-label="t('invest.positionLabelPnlPct')"
      :cost-label="t('invest.positionLabelAvgCost')"
      :current-price-label="t('invest.positionLabelCurrentPrice')"
      :price-label="t('invest.positionLabelReducePrice')"
      :trade-shares-label="t('invest.positionLabelReduceShares')"
      :calc-btn="t('invest.positionCalcBtn')"
      :result-title="t('invest.positionResultAfterReduce')"
      :new-cost-label="t('invest.positionResultNewCost')"
      :new-shares-label="t('invest.positionResultNewShares')"
      :new-pnl-label="t('invest.positionResultNewPnl')"
      :realized-pnl-label="t('invest.positionResultRealizedPnl')"
      :error-invalid="t('invest.positionErrorInvalid')"
      :error-reduce-shares="t('invest.positionErrorReduceShares')"
      @content-change="emit('contentChange')" />
  </div>
</template>

<script setup lang="ts">
import { useI18n } from 'vue-i18n';

import UiButton from '@/components/ui/Button';

import PositionCalcSection from './PositionCalcSection.vue';

const emit = defineEmits<{
  (event: 'back'): void;
  (event: 'contentChange'): void;
}>();

const { t } = useI18n();
</script>

<style scoped>
.invest-position-calc {
  display: grid;
  gap: 8px;
}

.invest-position-note {
  display: flex;
  align-items: flex-start;
  gap: 6px;
  padding: 8px 10px;
  border-radius: 7px;
  background: rgba(80, 160, 255, 0.06);
  border: 1px solid rgba(80, 160, 255, 0.16);
  color: rgba(120, 180, 255, 0.8);
  font-size: 11px;
  line-height: 1.5;
}

.invest-position-note-icon {
  font-size: 14px;
  flex-shrink: 0;
  margin-top: 1px;
}
</style>
