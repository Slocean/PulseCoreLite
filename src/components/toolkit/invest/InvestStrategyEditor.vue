<template>
  <div class="invest-editor">
    <div class="invest-editor-header">
      <UiButton
        native-type="button"
        preset="toolkit-link"
        @click="emit('back')">
        <span class="material-symbols-outlined">arrow_back</span>
        <span>{{ t('invest.backToList') }}</span>
      </UiButton>
      <span class="invest-editor-title">
        {{ editingId ? t('invest.editTitle') : t('invest.createTitle') }}
      </span>
    </div>

    <UiCollapsiblePanel class="toolkit-card" :title="t('invest.basicInfo')" :collapsible="false" title-class="toolkit-section-title">
      <div class="invest-form-grid">
        <div class="invest-form-row">
          <label class="overlay-config-label" :for="nameId">{{ t('invest.labelName') }}</label>
          <input
            :id="nameId"
            v-model="form.name"
            type="text"
            class="invest-input"
            :placeholder="t('invest.placeholderName')"
            autocomplete="off" />
        </div>

        <div class="invest-form-row">
          <label class="overlay-config-label" :for="fundCodeId">{{ t('invest.labelFundCode') }}</label>
          <div class="invest-fund-search-wrap">
            <input
              :id="fundCodeId"
              :value="form.fundCode"
              type="text"
              class="invest-input"
              :placeholder="t('invest.placeholderFundCode')"
              autocomplete="off"
              @input="emit('fundCodeInput', ($event.target as HTMLInputElement).value)" />
            <div v-if="fundSearchResults.length > 0" class="invest-fund-dropdown">
              <button
                v-for="r in fundSearchResults"
                :key="r.code"
                type="button"
                class="invest-fund-option"
                @click="emit('selectFund', r)">
                <span class="invest-fund-option-code">{{ r.code }}</span>
                <span class="invest-fund-option-name">{{ r.name }}</span>
              </button>
            </div>
          </div>
        </div>

        <div v-if="form.fundName" class="invest-form-row">
          <label class="overlay-config-label">{{ t('invest.labelFundName') }}</label>
          <span class="invest-fund-name-display">{{ form.fundName }}</span>
        </div>

        <div class="invest-form-row">
          <label class="overlay-config-label" :for="amountId">{{ t('invest.labelAmount') }}</label>
          <input
            :id="amountId"
            v-model.number="form.amount"
            type="number"
            min="1"
            step="100"
            class="invest-input invest-input--narrow"
            autocomplete="off" />
        </div>
      </div>
    </UiCollapsiblePanel>

    <UiCollapsiblePanel class="toolkit-card" :title="t('invest.scheduleInfo')" :collapsible="false" title-class="toolkit-section-title">
      <div class="invest-form-grid">
        <div class="invest-form-row">
          <span class="overlay-config-label">{{ t('invest.labelFrequency') }}</span>
          <div class="invest-freq-buttons">
            <UiButton
              v-for="opt in frequencyOptions"
              :key="opt.value"
              native-type="button"
              preset="overlay-chip"
              :active="form.frequency === opt.value"
              @click="form.frequency = opt.value">
              {{ t(opt.labelKey) }}
            </UiButton>
          </div>
        </div>

        <div v-if="form.frequency === 'weekly'" class="invest-form-row">
          <span class="overlay-config-label">{{ t('invest.labelWeekday') }}</span>
          <div class="invest-freq-buttons">
            <UiButton
              v-for="opt in weekdayOptions"
              :key="opt.value"
              native-type="button"
              preset="overlay-chip"
              :active="form.weekday === opt.value"
              @click="form.weekday = opt.value">
              {{ t(opt.labelKey) }}
            </UiButton>
          </div>
        </div>

        <div v-if="form.frequency === 'monthly'" class="invest-form-row">
          <label class="overlay-config-label" :for="monthDayId">{{ t('invest.labelMonthDay') }}</label>
          <select :id="monthDayId" v-model.number="form.monthDay" class="invest-select">
            <option v-for="opt in monthDayOptions" :key="opt.value" :value="opt.value">
              {{ t('invest.dayOf', { day: opt.label }) }}
            </option>
          </select>
        </div>

        <div class="invest-form-row">
          <label class="overlay-config-label" :for="startDateId">{{ t('invest.labelStartDate') }}</label>
          <input
            :id="startDateId"
            v-model="form.startDate"
            type="date"
            class="invest-input invest-input--date"
            autocomplete="off" />
        </div>

        <div class="invest-form-row">
          <label class="overlay-config-label" :for="endDateId">
            {{ t('invest.labelEndDate') }}
            <span class="invest-optional">({{ t('invest.optional') }})</span>
          </label>
          <input
            :id="endDateId"
            v-model="form.endDate"
            type="date"
            class="invest-input invest-input--date"
            autocomplete="off" />
        </div>
      </div>
    </UiCollapsiblePanel>

    <div class="toolkit-profile-actions">
      <UiButton native-type="button" preset="overlay-primary" @click="emit('save')">
        {{ t('invest.saveBtn') }}
      </UiButton>
      <UiButton native-type="button" preset="overlay-danger" @click="emit('back')">
        {{ t('invest.cancelBtn') }}
      </UiButton>
    </div>
  </div>
</template>

<script setup lang="ts">
import { useId } from 'vue';
import { useI18n } from 'vue-i18n';

import UiButton from '@/components/ui/Button';
import UiCollapsiblePanel from '@/components/ui/CollapsiblePanel';
import type { FundSearchResult, InvestFrequency } from '@/types/invest';

defineProps<{
  editingId: string | null;
  form: {
    name: string;
    fundCode: string;
    fundName: string;
    frequency: InvestFrequency;
    amount: number;
    startDate: string;
    endDate: string;
    weekday: number;
    monthDay: number;
  };
  fundSearchResults: FundSearchResult[];
  frequencyOptions: readonly { value: InvestFrequency; labelKey: string }[];
  weekdayOptions: readonly { value: number; labelKey: string }[];
  monthDayOptions: { value: number; label: string }[];
}>();

const emit = defineEmits<{
  (e: 'back'): void;
  (e: 'save'): void;
  (e: 'fundCodeInput', value: string): void;
  (e: 'selectFund', result: FundSearchResult): void;
}>();

const { t } = useI18n();

const nameId = useId();
const fundCodeId = useId();
const amountId = useId();
const monthDayId = useId();
const startDateId = useId();
const endDateId = useId();
</script>
