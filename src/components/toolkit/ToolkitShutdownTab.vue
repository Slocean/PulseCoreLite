<template>
  <template v-if="viewMode === 'list'">
    <UiCollapsiblePanel class="toolkit-card" :title="t('toolkit.currentPlan')" :collapsible="false" title-class="toolkit-section-title">
      <p class="toolkit-plan" :class="{ 'toolkit-plan--muted': !plan }">
        {{ planText }}
      </p>
      <div v-if="plan" class="toolkit-actions toolkit-actions--compact">
        <UiButton native-type="button" preset="toolkit-link" @click="editPlan">
          {{ t('toolkit.shutdownEditPlan') }}
        </UiButton>
        <UiButton native-type="button" preset="overlay-danger" @click="cancelPlan">
          {{ t('toolkit.cancelPlan') }}
        </UiButton>
      </div>
      <UiButton native-type="button" preset="overlay-primary" class="toolkit-add-plan" @click="startCreatePlan">
        <span class="material-symbols-outlined">add</span>
        <span>{{ t('toolkit.shutdownAddPlan') }}</span>
      </UiButton>
    </UiCollapsiblePanel>
  </template>

  <template v-else>
    <div class="toolkit-reminder-form-header">
      <UiButton
        native-type="button"
        preset="toolkit-link"
        class="toolkit-reminder-back"
        :aria-label="t('toolkit.shutdownBack')"
        @click="returnToList">
        <span class="material-symbols-outlined">arrow_back</span>
        <span>{{ t('toolkit.shutdownBack') }}</span>
      </UiButton>
    </div>

    <UiCollapsiblePanel class="toolkit-card" :title="t('toolkit.countdownTitle')" :collapsible="false" title-class="toolkit-section-title">
      <div class="toolkit-grid toolkit-grid--3">
        <label class="toolkit-field">
          <span>{{ t('toolkit.hours') }}</span>
          <input
            v-model.number="countdownHours"
            type="number"
            min="0"
            max="999"
            @wheel="onNumberWheel($event, 'hours', 0, 999)" />
        </label>
        <label class="toolkit-field">
          <span>{{ t('toolkit.minutes') }}</span>
          <input
            v-model.number="countdownMinutes"
            type="number"
            min="0"
            max="59"
            @wheel="onNumberWheel($event, 'minutes', 0, 59)" />
        </label>
        <label class="toolkit-field">
          <span>{{ t('toolkit.seconds') }}</span>
          <input
            v-model.number="countdownSeconds"
            type="number"
            min="0"
            max="59"
            @wheel="onNumberWheel($event, 'seconds', 0, 59)" />
        </label>
      </div>
      <UiButton native-type="button" preset="overlay-primary" @click="handleScheduleCountdown">
        {{ t('toolkit.scheduleCountdown') }}
      </UiButton>
    </UiCollapsiblePanel>

    <UiCollapsiblePanel class="toolkit-card" :title="t('toolkit.datetimeTitle')" :collapsible="false" title-class="toolkit-section-title">
      <div class="toolkit-grid">
        <div class="toolkit-field">
          <span class="toolkit-field-label">{{ t('toolkit.datetime') }}</span>
          <div class="toolkit-datetime-row">
            <UiDateInput v-model="appointmentDate" :min="minAppointmentDate" />
            <UiTimeInput v-model="appointmentTime" />
          </div>
        </div>
        <label class="toolkit-field">
          <span>{{ t('toolkit.repeat') }}</span>
          <UiSelect v-model="repeatMode" :options="repeatOptions" />
        </label>
        <label v-if="repeatMode === 'weekly'" class="toolkit-field">
          <span>{{ t('toolkit.weekday') }}</span>
          <UiSelect v-model="weeklyDay" :options="weekdayOptions" />
        </label>
        <label v-if="repeatMode === 'monthly'" class="toolkit-field">
          <span>{{ t('toolkit.dayOfMonth') }}</span>
          <input v-model.number="monthlyDay" type="number" min="1" max="31" />
        </label>
      </div>
      <UiButton native-type="button" preset="overlay-primary" @click="handleScheduleByDatetime">
        {{ t('toolkit.scheduleDatetime') }}
      </UiButton>
    </UiCollapsiblePanel>
  </template>

  <p v-if="statusMessage" class="toolkit-status">{{ statusMessage }}</p>
  <p v-if="errorMessage" class="toolkit-error">{{ errorMessage }}</p>
</template>

<script setup lang="ts">
import { ref } from 'vue';
import { useI18n } from 'vue-i18n';

import UiButton from '@/components/ui/Button';
import UiDateInput from '@/components/ui/DateInput';
import UiSelect from '@/components/ui/Select';
import UiCollapsiblePanel from '@/components/ui/CollapsiblePanel';
import UiTimeInput from '@/components/ui/TimeInput';
import { useToolkitShutdownForm } from '../../composables/useToolkitShutdownForm';

const emit = defineEmits<{
  (event: 'contentChange'): void;
}>();

const { t } = useI18n();
const {
  countdownHours,
  countdownMinutes,
  countdownSeconds,
  appointmentDate,
  appointmentTime,
  minAppointmentDate,
  repeatMode,
  weeklyDay,
  monthlyDay,
  plan,
  statusMessage,
  errorMessage,
  weekdayOptions,
  repeatOptions,
  planText,
  scheduleCountdown,
  scheduleByDatetime,
  cancelPlan,
  resetForm,
  applyPlanToForm,
  onNumberWheel
} = useToolkitShutdownForm({
  t: (key, params) => (params ? t(key, params) : t(key)),
  onContentChange: () => emit('contentChange')
});

const viewMode = ref<'list' | 'form'>('list');

function startCreatePlan() {
  resetForm();
  viewMode.value = 'form';
  emit('contentChange');
}

function editPlan() {
  if (!plan.value) return;
  applyPlanToForm(plan.value);
  viewMode.value = 'form';
  emit('contentChange');
}

function returnToList() {
  resetForm();
  viewMode.value = 'list';
  emit('contentChange');
}

async function handleScheduleCountdown() {
  const ok = await scheduleCountdown();
  if (ok) {
    returnToList();
  }
}

async function handleScheduleByDatetime() {
  const ok = await scheduleByDatetime();
  if (ok) {
    returnToList();
  }
}
</script>

