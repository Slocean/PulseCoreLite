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
          <label class="overlay-config-label">{{ t('invest.labelWeekday') }}</label>
          <UiSelect
            v-model="form.weekday"
            :options="weekdaySelectOptions"
            :aria-label="t('invest.labelWeekday')" />
        </div>

        <div v-if="form.frequency === 'monthly'" class="invest-form-row">
          <label class="overlay-config-label">{{ t('invest.labelMonthDay') }}</label>
          <UiSelect
            v-model="form.monthDay"
            :options="monthDaySelectOptions"
            :aria-label="t('invest.labelMonthDay')" />
        </div>

        <div class="invest-form-row">
          <label class="overlay-config-label">{{ t('invest.labelStartDate') }}</label>
          <UiDateInput v-model="form.startDate" :aria-label="t('invest.labelStartDate')" />
        </div>

        <div class="invest-form-row">
          <label class="overlay-config-label">
            {{ t('invest.labelEndDate') }}
            <span class="invest-optional">({{ t('invest.optional') }})</span>
          </label>
          <UiDateInput v-model="form.endDate" :aria-label="t('invest.labelEndDate')" />
        </div>
      </div>
    </UiCollapsiblePanel>

    <!-- Advanced conditional rules -->
    <UiCollapsiblePanel class="toolkit-card" :title="t('invest.rulesTitle')" title-class="toolkit-section-title">
      <div class="invest-rules-list">
        <div v-if="form.rules.length === 0" class="invest-rules-empty">
          <span class="material-symbols-outlined invest-rules-empty-icon">rule</span>
          <span>{{ t('invest.rulesEmpty') }}</span>
        </div>

        <div
          v-for="(rule, idx) in form.rules"
          :key="rule.id"
          class="invest-rule-row"
          :class="{ 'invest-rule-row--disabled': !rule.enabled }">

          <!-- Enable toggle -->
          <button
            type="button"
            class="invest-rule-toggle"
            :class="{ 'invest-rule-toggle--on': rule.enabled }"
            :title="t('invest.ruleEnabled')"
            @click="rule.enabled = !rule.enabled">
            <span class="material-symbols-outlined">
              {{ rule.enabled ? 'toggle_on' : 'toggle_off' }}
            </span>
          </button>

          <!-- Condition -->
          <select v-model="rule.condition" class="invest-rule-select invest-rule-select--condition">
            <option value="nav_above">{{ t('invest.condNavAbove') }}</option>
            <option value="nav_below">{{ t('invest.condNavBelow') }}</option>
            <option value="daily_change_above">{{ t('invest.condDailyChangeAbove') }}</option>
            <option value="daily_change_below">{{ t('invest.condDailyChangeBelow') }}</option>
          </select>

          <!-- Threshold -->
          <div class="invest-rule-input-wrap">
            <input
              v-model.number="rule.threshold"
              type="number"
              step="0.001"
              class="invest-rule-input"
              :placeholder="isNavCondition(rule.condition) ? '1.000' : '5'" />
            <span class="invest-rule-unit">
              {{ isNavCondition(rule.condition) ? t('invest.ruleNavUnit') : t('invest.rulePctUnit') }}
            </span>
          </div>

          <!-- Arrow separator -->
          <span class="invest-rule-arrow material-symbols-outlined">arrow_forward</span>

          <!-- Action -->
          <select v-model="rule.action" class="invest-rule-select invest-rule-select--action"
            :class="rule.action === 'buy' ? 'invest-rule-select--buy' : 'invest-rule-select--sell'">
            <option value="buy">{{ t('invest.actionBuy') }}</option>
            <option value="sell">{{ t('invest.actionSell') }}</option>
          </select>

          <!-- Amount type -->
          <select v-model="rule.amountType" class="invest-rule-select invest-rule-select--amt-type">
            <option value="absolute">{{ t('invest.amtAbsolute') }}</option>
            <option value="percent">{{ t('invest.amtPercent') }}</option>
          </select>

          <!-- Amount value -->
          <div class="invest-rule-input-wrap">
            <input
              v-model.number="rule.amount"
              type="number"
              min="0"
              :step="rule.amountType === 'absolute' ? 100 : 1"
              class="invest-rule-input"
              :placeholder="rule.amountType === 'absolute' ? '1000' : '10'" />
            <span class="invest-rule-unit">
              {{ rule.amountType === 'absolute' ? '¥' : '%' }}
            </span>
          </div>

          <!-- Hint -->
          <span class="invest-rule-hint" :title="getRuleAmountHint(rule)">
            <span class="material-symbols-outlined">info</span>
          </span>

          <!-- Delete -->
          <button
            type="button"
            class="invest-rule-delete"
            :title="t('invest.cancelBtn')"
            @click="form.rules.splice(idx, 1)">
            <span class="material-symbols-outlined">close</span>
          </button>
        </div>

        <UiButton native-type="button" preset="overlay-chip" class="invest-rules-add-btn" @click="addRule">
          <span class="material-symbols-outlined">add</span>
          <span>{{ t('invest.addRuleBtn') }}</span>
        </UiButton>
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
import { computed, useId } from 'vue';
import { useI18n } from 'vue-i18n';

import UiButton from '@/components/ui/Button';
import UiCollapsiblePanel from '@/components/ui/CollapsiblePanel';
import UiDateInput from '@/components/ui/DateInput';
import UiSelect from '@/components/ui/Select';
import type { ConditionType, FundSearchResult, InvestFrequency, InvestRule } from '@/types/invest';

const props = defineProps<{
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
    rules: InvestRule[];
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

const weekdaySelectOptions = computed(() =>
  props.weekdayOptions.map(opt => ({
    value: opt.value,
    label: t(opt.labelKey)
  }))
);

const monthDaySelectOptions = computed(() =>
  props.monthDayOptions.map(opt => ({
    value: opt.value,
    label: t('invest.dayOf', { day: opt.label })
  }))
);

function isNavCondition(cond: ConditionType): boolean {
  return cond === 'nav_above' || cond === 'nav_below';
}

function getRuleAmountHint(rule: InvestRule): string {
  if (rule.amountType === 'absolute') return t('invest.ruleAmtHintAbsolute');
  return rule.action === 'buy' ? t('invest.ruleAmtHintBuyPct') : t('invest.ruleAmtHintSellPct');
}

function addRule() {
  props.form.rules.push({
    id: crypto.randomUUID(),
    condition: 'nav_below',
    threshold: 1.0,
    action: 'buy',
    amountType: 'absolute',
    amount: 1000,
    enabled: true
  });
}
</script>

<style scoped>
/* ── Rule list container ───────────────────────────── */
.invest-rules-list {
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.invest-rules-empty {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 10px 4px;
  color: rgba(255, 255, 255, 0.42);
  font-size: 12px;
}

.invest-rules-empty-icon {
  font-size: 18px;
  opacity: 0.6;
}

/* ── Single rule row ──────────────────────────────── */
.invest-rule-row {
  display: flex;
  align-items: center;
  gap: 6px;
  padding: 7px 8px;
  border-radius: 8px;
  border: 1px solid rgba(255, 255, 255, 0.1);
  background: rgba(255, 255, 255, 0.03);
  flex-wrap: wrap;
  transition: opacity 160ms ease;
}

.invest-rule-row--disabled {
  opacity: 0.45;
}

/* ── Enable toggle ────────────────────────────────── */
.invest-rule-toggle {
  flex-shrink: 0;
  background: transparent;
  border: none;
  cursor: pointer;
  padding: 0;
  color: rgba(255, 255, 255, 0.38);
  display: grid;
  place-items: center;
  transition: color 160ms ease;
  -webkit-app-region: no-drag;
}

.invest-rule-toggle--on {
  color: rgba(0, 242, 255, 0.88);
}

.invest-rule-toggle .material-symbols-outlined {
  font-size: 22px;
}

/* ── Selects ──────────────────────────────────────── */
.invest-rule-select {
  height: 28px;
  border-radius: 6px;
  border: 1px solid rgba(255, 255, 255, 0.18);
  background: rgba(255, 255, 255, 0.06);
  color: rgba(255, 255, 255, 0.88);
  font-size: 11px;
  padding: 0 6px;
  cursor: pointer;
  -webkit-app-region: no-drag;
  transition: border-color 140ms ease;
}

.invest-rule-select:focus {
  outline: none;
  border-color: rgba(0, 242, 255, 0.5);
}

.invest-rule-select--condition {
  min-width: 118px;
}

.invest-rule-select--action {
  min-width: 58px;
}

.invest-rule-select--buy {
  color: rgba(80, 220, 140, 0.92);
}

.invest-rule-select--sell {
  color: rgba(255, 100, 100, 0.92);
}

.invest-rule-select--amt-type {
  min-width: 82px;
}

/* ── Number inputs with unit suffix ──────────────── */
.invest-rule-input-wrap {
  display: flex;
  align-items: center;
  border-radius: 6px;
  border: 1px solid rgba(255, 255, 255, 0.18);
  background: rgba(255, 255, 255, 0.06);
  overflow: hidden;
  height: 28px;
}

.invest-rule-input {
  width: 68px;
  height: 100%;
  border: none;
  background: transparent;
  color: rgba(255, 255, 255, 0.9);
  font-size: 11px;
  padding: 0 6px;
  -webkit-app-region: no-drag;
}

.invest-rule-input:focus {
  outline: none;
}

/* Remove number input spinner */
.invest-rule-input::-webkit-inner-spin-button,
.invest-rule-input::-webkit-outer-spin-button {
  -webkit-appearance: none;
  margin: 0;
}

.invest-rule-unit {
  font-size: 10px;
  color: rgba(255, 255, 255, 0.4);
  padding: 0 6px 0 2px;
  white-space: nowrap;
}

/* ── Arrow separator ──────────────────────────────── */
.invest-rule-arrow {
  font-size: 14px;
  color: rgba(255, 255, 255, 0.3);
  flex-shrink: 0;
}

/* ── Info hint icon ───────────────────────────────── */
.invest-rule-hint {
  display: grid;
  place-items: center;
  flex-shrink: 0;
  cursor: help;
}

.invest-rule-hint .material-symbols-outlined {
  font-size: 14px;
  color: rgba(255, 255, 255, 0.3);
}

/* ── Delete button ────────────────────────────────── */
.invest-rule-delete {
  margin-left: auto;
  flex-shrink: 0;
  background: transparent;
  border: none;
  cursor: pointer;
  padding: 2px;
  color: rgba(255, 80, 80, 0.6);
  display: grid;
  place-items: center;
  border-radius: 4px;
  transition: color 140ms ease, background 140ms ease;
  -webkit-app-region: no-drag;
}

.invest-rule-delete:hover {
  color: rgba(255, 80, 80, 0.9);
  background: rgba(255, 80, 80, 0.1);
}

.invest-rule-delete .material-symbols-outlined {
  font-size: 15px;
}

/* ── Add button ───────────────────────────────────── */
.invest-rules-add-btn {
  align-self: flex-start;
  margin-top: 4px;
}
</style>
