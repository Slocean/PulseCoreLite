<template>
  <!-- Sub-pages -->
  <InvestDcaPage
    v-if="subView === 'dca'"
    @back="subView = 'hub'"
    @content-change="emit('contentChange')" />

  <InvestTradingDayCalc
    v-else-if="subView === 'tradingDay'"
    @back="subView = 'hub'"
    @content-change="emit('contentChange')" />

  <!-- Hub menu -->
  <div v-else class="invest-hub">
    <div class="invest-hub-header">
      <span class="invest-hub-title">{{ t('invest.hubTitle') }}</span>
    </div>
    <div class="invest-hub-grid">
      <button type="button" class="invest-hub-card" @click="subView = 'dca'">
        <span class="material-symbols-outlined invest-hub-card-icon">savings</span>
        <span class="invest-hub-card-title">{{ t('invest.hubDcaTitle') }}</span>
        <span class="invest-hub-card-desc">{{ t('invest.hubDcaDesc') }}</span>
        <span class="material-symbols-outlined invest-hub-card-arrow">chevron_right</span>
      </button>
      <button type="button" class="invest-hub-card" @click="subView = 'tradingDay'">
        <span class="material-symbols-outlined invest-hub-card-icon">calendar_month</span>
        <span class="invest-hub-card-title">{{ t('invest.hubTradingDayTitle') }}</span>
        <span class="invest-hub-card-desc">{{ t('invest.hubTradingDayDesc') }}</span>
        <span class="material-symbols-outlined invest-hub-card-arrow">chevron_right</span>
      </button>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref } from 'vue';
import { useI18n } from 'vue-i18n';

import InvestDcaPage from './invest/InvestDcaPage.vue';
import InvestTradingDayCalc from './invest/InvestTradingDayCalc.vue';

type InvestSubView = 'hub' | 'dca' | 'tradingDay';

const emit = defineEmits<{
  (event: 'contentChange'): void;
}>();

const { t } = useI18n();
const subView = ref<InvestSubView>('hub');
</script>

<style scoped>
.invest-hub {
  display: grid;
  gap: 10px;
}

.invest-hub-header {
  padding: 2px 4px;
}

.invest-hub-title {
  font-size: 12px;
  font-weight: 600;
  letter-spacing: 0.06em;
  color: rgba(255, 255, 255, 0.7);
  text-transform: uppercase;
}

.invest-hub-grid {
  display: grid;
  gap: 8px;
}

.invest-hub-card {
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

.invest-hub-card:hover {
  background: rgba(255, 255, 255, 0.07);
  border-color: rgba(255, 255, 255, 0.14);
}

.invest-hub-card-icon {
  grid-row: 1 / 3;
  font-size: 28px;
  color: rgba(80, 160, 255, 0.75);
  align-self: center;
}

.invest-hub-card-title {
  font-size: 13px;
  font-weight: 600;
  color: rgba(255, 255, 255, 0.88);
  grid-column: 2;
  grid-row: 1;
}

.invest-hub-card-desc {
  font-size: 11px;
  color: rgba(255, 255, 255, 0.42);
  grid-column: 2;
  grid-row: 2;
  line-height: 1.4;
}

.invest-hub-card-arrow {
  grid-row: 1 / 3;
  font-size: 20px;
  color: rgba(255, 255, 255, 0.25);
  align-self: center;
}
</style>
