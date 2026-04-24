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

    <!-- Basic Info: strategy name -->
    <UiCollapsiblePanel
      class="toolkit-card"
      :title="t('invest.basicInfo')"
      :model-value="basicInfoOpen"
      header-mode="split"
      header-class="toolkit-section-header"
      split-title-preset="toolkit-collapse-title"
      split-toggle-preset="toolkit-collapse-icon"
      title-class="toolkit-section-title"
      indicator-class="toolkit-collapse-indicator"
      @toggle="basicInfoOpen = $event">
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
      </div>
    </UiCollapsiblePanel>

    <!-- Schedule Info -->
    <UiCollapsiblePanel
      class="toolkit-card"
      :title="t('invest.scheduleInfo')"
      :model-value="scheduleOpen"
      header-mode="split"
      header-class="toolkit-section-header"
      split-title-preset="toolkit-collapse-title"
      split-toggle-preset="toolkit-collapse-icon"
      title-class="toolkit-section-title"
      indicator-class="toolkit-collapse-indicator"
      @toggle="scheduleOpen = $event">
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

    <!-- Fund Entries -->
    <UiCollapsiblePanel
      class="toolkit-card"
      :title="t('invest.fundsTitle')"
      :model-value="fundsOpen"
      header-mode="split"
      header-class="toolkit-section-header"
      split-title-preset="toolkit-collapse-title"
      split-toggle-preset="toolkit-collapse-icon"
      title-class="toolkit-section-title"
      indicator-class="toolkit-collapse-indicator"
      @toggle="fundsOpen = $event">

      <div class="invest-fund-entries">
        <div
          v-for="(fund, idx) in form.funds"
          :key="fund.id"
          class="invest-fund-entry">

          <!-- Fund entry header -->
          <div class="invest-fund-entry-header">
            <span class="invest-fund-entry-label">
              {{ t('invest.fundEntryTitle', { n: idx + 1 }) }}
              <span v-if="fund.fundCode" class="invest-fund-entry-code"> · {{ fund.fundCode }}</span>
              <span v-if="fund.fundName" class="invest-fund-entry-name"> · {{ fund.fundName }}</span>
            </span>
            <button
              v-if="form.funds.length > 1"
              type="button"
              class="invest-fund-entry-remove"
              :title="t('invest.removeFundBtn')"
              @click="emit('removeFund', idx)">
              <span class="material-symbols-outlined">close</span>
            </button>
          </div>

          <!-- Fund code search -->
          <div class="invest-fund-entry-body">
            <div class="invest-form-row">
              <label class="overlay-config-label" :for="`fund-code-${fund.id}`">{{ t('invest.labelFundCode') }}</label>
              <div class="invest-fund-search-wrap">
                <input
                  :id="`fund-code-${fund.id}`"
                  :value="fund.fundCode"
                  type="text"
                  class="invest-input"
                  :placeholder="t('invest.placeholderFundCode')"
                  autocomplete="off"
                  @input="emit('fundCodeInput', ($event.target as HTMLInputElement).value, idx)"
                  @blur="onFundInputBlur" />
                <div
                  v-if="fundSearchActiveIdx === idx && fundSearchResults.length > 0"
                  class="invest-fund-dropdown">
                  <button
                    v-for="r in fundSearchResults"
                    :key="r.code"
                    type="button"
                    class="invest-fund-option"
                    @click="emit('selectFund', r, idx)">
                    <span class="invest-fund-option-code">{{ r.code }}</span>
                    <span class="invest-fund-option-name">{{ r.name }}</span>
                  </button>
                </div>
              </div>
            </div>

            <div v-if="fund.fundName" class="invest-form-row">
              <label class="overlay-config-label">{{ t('invest.labelFundName') }}</label>
              <span class="invest-fund-name-display">{{ fund.fundName }}</span>
            </div>

            <div class="invest-form-row">
              <label class="overlay-config-label" :for="`fund-amount-${fund.id}`">{{ t('invest.labelAmount') }}</label>
              <input
                :id="`fund-amount-${fund.id}`"
                v-model.number="fund.amount"
                type="number"
                min="1"
                step="100"
                class="invest-input invest-input--narrow"
                autocomplete="off" />
            </div>

            <!-- Per-fund rules -->
            <div class="invest-fund-rules">
              <div class="invest-fund-rules-label">
                <span class="overlay-config-label">{{ t('invest.rulesTitle') }}</span>
              </div>

              <div v-if="!fund.rules || fund.rules.length === 0" class="invest-rules-empty">
                <span class="material-symbols-outlined invest-rules-empty-icon">rule</span>
                <span>{{ t('invest.rulesEmpty') }}</span>
              </div>

              <div
                v-for="(rule, rIdx) in (fund.rules ?? [])"
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
                <UiSelect v-model="rule.condition" :options="conditionOptions" :width="138" />

                <!-- Threshold -->
                <div class="invest-rule-input-wrap">
                  <input
                    v-model.number="rule.threshold"
                    type="number"
                    :step="isNavCondition(rule.condition) ? 0.001 : 1"
                    class="invest-rule-input"
                    :placeholder="getThresholdPlaceholder(rule.condition)" />
                  <span class="invest-rule-unit">
                    {{ getThresholdUnit(rule.condition) }}
                  </span>
                </div>

                <!-- Arrow separator -->
                <span class="invest-rule-arrow material-symbols-outlined">arrow_forward</span>

                <!-- Action -->
                <UiSelect
                  v-model="rule.action"
                  :options="actionOptions"
                  :width="76"
                  :class="rule.action === 'buy' ? 'invest-rule-action--buy' : 'invest-rule-action--sell'" />

                <!-- Amount type -->
                <UiSelect v-model="rule.amountType" :options="amountTypeOptions" :width="96" />

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

                <!-- Delete rule -->
                <button
                  type="button"
                  class="invest-rule-delete"
                  :title="t('invest.cancelBtn')"
                  @click="removeRule(fund, rIdx)">
                  <span class="material-symbols-outlined">close</span>
                </button>
              </div>

              <UiButton native-type="button" preset="overlay-chip" class="invest-rules-add-btn" @click="addRule(fund)">
                <span class="material-symbols-outlined">add</span>
                <span>{{ t('invest.addRuleBtn') }}</span>
              </UiButton>
            </div>
          </div>
        </div>

        <!-- Add fund button -->
        <UiButton native-type="button" preset="overlay-chip" class="invest-add-fund-btn" @click="emit('addFund')">
          <span class="material-symbols-outlined">add</span>
          <span>{{ t('invest.addFundBtn') }}</span>
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
import { computed, ref, useId } from 'vue';
import { useI18n } from 'vue-i18n';

import UiButton from '@/components/ui/Button';
import UiCollapsiblePanel from '@/components/ui/CollapsiblePanel';
import UiDateInput from '@/components/ui/DateInput';
import UiSelect from '@/components/ui/Select';
import type {
  ConditionType,
  FundSearchResult,
  InvestFrequency,
  InvestFundEntry,
  InvestRule
} from '@/types/invest';

const props = defineProps<{
  editingId: string | null;
  form: {
    name: string;
    frequency: InvestFrequency;
    startDate: string;
    endDate: string;
    weekday: number;
    monthDay: number;
    funds: InvestFundEntry[];
  };
  fundSearchResults: FundSearchResult[];
  fundSearchActiveIdx: number;
  frequencyOptions: readonly { value: InvestFrequency; labelKey: string }[];
  weekdayOptions: readonly { value: number; labelKey: string }[];
  monthDayOptions: { value: number; label: string }[];
}>();

const emit = defineEmits<{
  (e: 'back'): void;
  (e: 'save'): void;
  (e: 'fundCodeInput', value: string, fundIdx: number): void;
  (e: 'selectFund', result: FundSearchResult, fundIdx: number): void;
  (e: 'addFund'): void;
  (e: 'removeFund', fundIdx: number): void;
}>();

const { t } = useI18n();

const basicInfoOpen = ref(true);
const scheduleOpen = ref(true);
const fundsOpen = ref(true);

const nameId = useId();

const weekdaySelectOptions = computed(() =>
  props.weekdayOptions.map(opt => ({
    value: opt.value,
    label: t(opt.labelKey)
  }))
);

const conditionOptions = computed(() => [
  { value: 'nav_above',          label: t('invest.condNavAbove') },
  { value: 'nav_below',          label: t('invest.condNavBelow') },
  { value: 'daily_change_above', label: t('invest.condDailyChangeAbove') },
  { value: 'daily_change_below', label: t('invest.condDailyChangeBelow') },
  { value: 'profit_pct_above',   label: t('invest.condProfitPctAbove') },
  { value: 'profit_pct_below',   label: t('invest.condProfitPctBelow') }
]);

const actionOptions = computed(() => [
  { value: 'buy',  label: t('invest.actionBuy') },
  { value: 'sell', label: t('invest.actionSell') }
]);

const amountTypeOptions = computed(() => [
  { value: 'absolute', label: t('invest.amtAbsolute') },
  { value: 'percent',  label: t('invest.amtPercent') }
]);

const monthDaySelectOptions = computed(() =>
  props.monthDayOptions.map(opt => ({
    value: opt.value,
    label: t('invest.dayOf', { day: opt.label })
  }))
);

function isNavCondition(cond: ConditionType): boolean {
  return cond === 'nav_above' || cond === 'nav_below';
}

function getThresholdUnit(cond: ConditionType): string {
  return isNavCondition(cond) ? t('invest.ruleNavUnit') : t('invest.rulePctUnit');
}

function getThresholdPlaceholder(cond: ConditionType): string {
  if (isNavCondition(cond)) return '1.000';
  if (cond === 'profit_pct_above') return '20';
  if (cond === 'profit_pct_below') return '-10';
  return '5';
}

function getRuleAmountHint(rule: InvestRule): string {
  if (rule.amountType === 'absolute') return t('invest.ruleAmtHintAbsolute');
  return rule.action === 'buy' ? t('invest.ruleAmtHintBuyPct') : t('invest.ruleAmtHintSellPct');
}

function addRule(fund: InvestFundEntry) {
  if (!fund.rules) fund.rules = [];
  fund.rules.push({
    id: crypto.randomUUID(),
    condition: 'nav_below',
    threshold: 1.0,
    action: 'buy',
    amountType: 'absolute',
    amount: 1000,
    enabled: true
  });
}

function removeRule(fund: InvestFundEntry, rIdx: number) {
  fund.rules?.splice(rIdx, 1);
}

function onFundInputBlur() {
  // Small delay to allow dropdown click to register before hiding
  setTimeout(() => {
    // dropdown hide is handled by fundSearchActiveIdx in parent
  }, 150);
}
</script>

<style scoped>
/* ── Fund entries container ─────────────────────────── */
.invest-fund-entries {
  display: flex;
  flex-direction: column;
  gap: 12px;
}

/* ── Single fund entry card ─────────────────────────── */
.invest-fund-entry {
  border: 1px solid rgba(255, 255, 255, 0.1);
  border-radius: 10px;
  background: rgba(255, 255, 255, 0.02);
  overflow: visible;
}

.invest-fund-entry-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 8px;
  padding: 8px 12px;
  border-bottom: 1px solid rgba(255, 255, 255, 0.07);
  background: rgba(255, 255, 255, 0.025);
  border-radius: 10px 10px 0 0;
}

.invest-fund-entry-label {
  font-size: 12px;
  font-weight: 600;
  color: rgba(255, 255, 255, 0.75);
}

.invest-fund-entry-code {
  font-size: 11px;
  color: rgba(80, 160, 255, 0.8);
  font-weight: 500;
}

.invest-fund-entry-name {
  font-size: 11px;
  color: rgba(255, 255, 255, 0.45);
  font-weight: 400;
}

.invest-fund-entry-remove {
  flex-shrink: 0;
  display: grid;
  place-items: center;
  background: transparent;
  border: none;
  cursor: pointer;
  padding: 2px;
  color: rgba(255, 80, 80, 0.55);
  border-radius: 4px;
  transition: color 140ms ease, background 140ms ease;
  -webkit-app-region: no-drag;
}

.invest-fund-entry-remove:hover {
  color: rgba(255, 80, 80, 0.9);
  background: rgba(255, 80, 80, 0.1);
}

.invest-fund-entry-remove .material-symbols-outlined {
  font-size: 15px;
}

.invest-fund-entry-body {
  padding: 10px 12px 12px;
  display: flex;
  flex-direction: column;
  gap: 8px;
}

/* ── Add fund button ─────────────────────────────────── */
.invest-add-fund-btn {
  align-self: flex-start;
  margin-top: 2px;
}

/* ── Per-fund rules section ──────────────────────────── */
.invest-fund-rules {
  margin-top: 6px;
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.invest-fund-rules-label {
  padding-bottom: 2px;
  border-bottom: 1px solid rgba(255, 255, 255, 0.06);
}

/* ── Rule list ───────────────────────────────────────── */
.invest-rules-empty {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 8px 4px;
  color: rgba(255, 255, 255, 0.38);
  font-size: 12px;
}

.invest-rules-empty-icon {
  font-size: 16px;
  opacity: 0.6;
}

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

.invest-rule-action--buy :deep(.ui-select-trigger-text) {
  color: rgba(80, 220, 140, 0.92);
}

.invest-rule-action--sell :deep(.ui-select-trigger-text) {
  color: rgba(255, 100, 100, 0.92);
}

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

.invest-rule-arrow {
  font-size: 14px;
  color: rgba(255, 255, 255, 0.3);
  flex-shrink: 0;
}

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

.invest-rules-add-btn {
  align-self: flex-start;
  margin-top: 2px;
}
</style>
