<template>
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
    <UiButton native-type="button" preset="overlay-primary" @click="scheduleCountdown">
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
    <UiButton native-type="button" preset="overlay-primary" @click="scheduleByDatetime">
      {{ t('toolkit.scheduleDatetime') }}
    </UiButton>
  </UiCollapsiblePanel>

  <UiCollapsiblePanel class="toolkit-card" :title="t('toolkit.currentPlan')" :collapsible="false" title-class="toolkit-section-title">
    <p class="toolkit-plan" :class="{ 'toolkit-plan--muted': !plan }">
      {{ planText }}
    </p>
    <div class="toolkit-actions">
      <UiButton native-type="button" preset="overlay-danger" @click="cancelPlan">
        {{ t('toolkit.cancelPlan') }}
      </UiButton>
    </div>
  </UiCollapsiblePanel>

  <p v-if="statusMessage" class="toolkit-status">{{ statusMessage }}</p>
  <p v-if="errorMessage" class="toolkit-error">{{ errorMessage }}</p>
</template>

<script setup lang="ts">
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
  onNumberWheel
} = useToolkitShutdownForm({
  t: (key, params) => (params ? t(key, params) : t(key)),
  onContentChange: () => emit('contentChange')
});
</script>

