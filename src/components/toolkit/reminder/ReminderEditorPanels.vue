<template>
  <UiCollapsiblePanel
    class="toolkit-card"
    :title="editingId ? t('toolkit.reminderEdit') : t('toolkit.reminderCreate')"
    v-model="sections.task"
    header-mode="split"
    header-class="toolkit-section-header"
    split-title-preset="toolkit-collapse-title"
    split-toggle-preset="toolkit-collapse-icon"
    title-class="toolkit-section-title"
    indicator-class="toolkit-collapse-indicator"
    @toggle="emit('contentChange')">
    <template #header-actions>
      <UiButton native-type="button" preset="toolkit-link" :aria-label="t('toolkit.reminderSmtpConfig')" @click="emit('openSmtpDialog')">
        {{ t('toolkit.reminderSmtpConfig') }}
      </UiButton>
    </template>
    <div class="toolkit-grid">
      <label class="toolkit-field toolkit-field--inline">
        <span>{{ t('toolkit.reminderTaskTitle') }}</span>
        <input v-model.trim="form.title" type="text" maxlength="80" />
      </label>
      <label class="toolkit-field toolkit-field--inline">
        <span>{{ t('toolkit.reminderChannel') }}</span>
        <UiSelect v-model="form.channel" :options="channelOptions" />
      </label>
      <label v-if="form.channel === 'email'" class="toolkit-field">
        <span>{{ t('toolkit.reminderEmail') }}</span>
        <input v-model.trim="form.email" type="email" placeholder="name@example.com" />
      </label>
      <p v-if="form.channel === 'email'" class="toolkit-profile-hint">{{ t('toolkit.reminderEmailHint') }}</p>
    </div>
  </UiCollapsiblePanel>

  <UiCollapsiblePanel
    class="toolkit-card"
    :title="t('toolkit.reminderSchedule')"
    v-model="sections.schedule"
    single-header-preset="toolkit-collapse"
    title-class="toolkit-section-title"
    indicator-class="toolkit-collapse-indicator"
    @toggle="emit('contentChange')">
    <label class="toolkit-field toolkit-field--inline">
      <span>{{ t('toolkit.reminderFrequency') }}</span>
      <UiSelect v-model="frequencyModel" :options="frequencyOptions" />
    </label>

    <div v-if="frequencyModel === 'daily'" class="toolkit-reminder-block">
      <div class="toolkit-reminder-row">
        <div class="toolkit-reminder-subtitle">{{ t('toolkit.repeatDaily') }}</div>
        <div class="toolkit-reminder-inline">
          <UiTimeInput v-model="dailyInputTimeModel" />
          <UiButton native-type="button" preset="overlay-primary" @click="emit('addDailyTime')">
            {{ t('toolkit.reminderAddTime') }}
          </UiButton>
        </div>
      </div>
      <div class="toolkit-reminder-chip-list">
        <button
          v-for="time in form.dailyTimes"
          :key="`daily-${time}`"
          class="toolkit-reminder-chip"
          type="button"
          @click="emit('removeDailyTime', time)">
          {{ time }} x
        </button>
      </div>
    </div>

    <div v-else-if="frequencyModel === 'weekly'" class="toolkit-reminder-block">
      <div class="toolkit-reminder-row">
        <div class="toolkit-reminder-subtitle">{{ t('toolkit.repeatWeekly') }}</div>
        <div class="toolkit-reminder-inline toolkit-reminder-inline--weekly">
          <UiSelect v-model="weeklyInputDaysModel" :options="weekdayOptions" multiple />
          <UiTimeInput v-model="weeklyInputTimeModel" class="toolkit-reminder-time-input" />
          <UiButton native-type="button" preset="overlay-primary" @click="emit('addWeeklySlot')">
            {{ t('toolkit.reminderAddSlot') }}
          </UiButton>
        </div>
      </div>
      <div class="toolkit-reminder-chip-list">
        <button
          v-for="slot in form.weeklySlots"
          :key="`weekly-${slot.weekday}-${slot.time}`"
          class="toolkit-reminder-chip"
          type="button"
          @click="emit('removeWeeklySlot', slot.weekday, slot.time)">
          {{ formatWeekday(slot.weekday) }} {{ slot.time }} x
        </button>
      </div>
    </div>

    <div v-else class="toolkit-reminder-block">
      <div class="toolkit-reminder-row">
        <div class="toolkit-reminder-subtitle">{{ t('toolkit.repeatMonthly') }}</div>
        <div class="toolkit-reminder-inline toolkit-reminder-inline--monthly">
          <UiSelect v-model="monthlyInputDaysModel" :options="monthlyDayOptions" multiple />
          <UiTimeInput v-model="monthlyInputTimeModel" />
          <UiButton native-type="button" preset="overlay-primary" @click="emit('addMonthlySlot')">
            {{ t('toolkit.reminderAddSlot') }}
          </UiButton>
        </div>
      </div>
      <div class="toolkit-reminder-chip-list">
        <button
          v-for="slot in form.monthlySlots"
          :key="`monthly-${slot.day}-${slot.time}`"
          class="toolkit-reminder-chip"
          type="button"
          @click="emit('removeMonthlySlot', slot.day, slot.time)">
          {{ t('toolkit.reminderDayOfMonth', { day: slot.day }) }} {{ slot.time }} x
        </button>
      </div>
    </div>
  </UiCollapsiblePanel>

  <UiCollapsiblePanel
    class="toolkit-card"
    :title="t('toolkit.reminderContent')"
    v-model="sections.content"
    single-header-preset="toolkit-collapse"
    title-class="toolkit-section-title"
    indicator-class="toolkit-collapse-indicator"
    @toggle="emit('contentChange')">
    <div class="toolkit-grid">
      <label class="toolkit-field toolkit-field--inline">
        <span>{{ t('toolkit.reminderContentType') }}</span>
        <UiSelect v-model="form.contentType" :options="contentTypeOptions" />
      </label>

      <label class="toolkit-field toolkit-field--inline">
        <span>{{ t('toolkit.reminderContentValue') }}</span>
        <textarea v-if="form.contentType === 'text' || form.contentType === 'markdown'" v-model="form.content" rows="4" />
        <input v-else v-model.trim="form.content" type="text" />
      </label>
    </div>

  </UiCollapsiblePanel>
</template>

<script setup lang="ts">
import { computed, ref, watch } from 'vue';
import { useI18n } from 'vue-i18n';

import UiButton from '@/components/ui/Button';
import UiSelect from '@/components/ui/Select';
import type { SelectOption } from '@/components/ui/Select/types';
import UiCollapsiblePanel from '@/components/ui/CollapsiblePanel';
import UiTimeInput from '@/components/ui/TimeInput';
import type { MonthlyReminderSlot, WeeklyReminderSlot } from '@/types';

type ReminderFormModel = {
  enabled: boolean;
  title: string;
  channel: 'email' | 'fullscreen';
  email: string;
  dailyTimes: string[];
  weeklySlots: WeeklyReminderSlot[];
  monthlySlots: MonthlyReminderSlot[];
  contentType: 'text' | 'markdown' | 'web' | 'image';
  content: string;
};

type ReminderSectionsModel = {
  task: boolean;
  schedule: boolean;
  content: boolean;
};

const props = defineProps<{
  editingId: string | null;
  form: ReminderFormModel;
  sections: ReminderSectionsModel;
  dailyInputTime: string;
  weeklyInputDays: number[];
  weeklyInputTime: string;
  monthlyInputDays: number[];
  monthlyInputTime: string;
  channelOptions: SelectOption[];
  weekdayOptions: SelectOption[];
  monthlyDayOptions: SelectOption[];
  contentTypeOptions: SelectOption[];
  formatWeekday: (weekday: number) => string;
}>();

const emit = defineEmits<{
  (event: 'contentChange'): void;
  (event: 'openSmtpDialog'): void;
  (event: 'addDailyTime'): void;
  (event: 'removeDailyTime', time: string): void;
  (event: 'addWeeklySlot'): void;
  (event: 'removeWeeklySlot', weekday: number, time: string): void;
  (event: 'addMonthlySlot'): void;
  (event: 'removeMonthlySlot', day: number, time: string): void;
  (event: 'update:dailyInputTime', value: string): void;
  (event: 'update:weeklyInputDays', value: number[]): void;
  (event: 'update:weeklyInputTime', value: string): void;
  (event: 'update:monthlyInputDays', value: number[]): void;
  (event: 'update:monthlyInputTime', value: string): void;
}>();

const { t } = useI18n();

const form = computed(() => props.form);
const sections = computed(() => props.sections);

const dailyInputTimeModel = computed({
  get: () => props.dailyInputTime,
  set: value => emit('update:dailyInputTime', value)
});

const weeklyInputDaysModel = computed({
  get: () => props.weeklyInputDays,
  set: value => emit('update:weeklyInputDays', value.map(item => Number(item)))
});

const weeklyInputTimeModel = computed({
  get: () => props.weeklyInputTime,
  set: value => emit('update:weeklyInputTime', value)
});

const monthlyInputDaysModel = computed({
  get: () => props.monthlyInputDays,
  set: value => emit('update:monthlyInputDays', value.map(item => Number(item)))
});

const monthlyInputTimeModel = computed({
  get: () => props.monthlyInputTime,
  set: value => emit('update:monthlyInputTime', value)
});

const channelOptions = computed(() => props.channelOptions);
const weekdayOptions = computed(() => props.weekdayOptions);
const monthlyDayOptions = computed(() => props.monthlyDayOptions);
const contentTypeOptions = computed(() => props.contentTypeOptions);
const editingId = computed(() => props.editingId);
const formatWeekday = computed(() => props.formatWeekday);

type FrequencyValue = 'daily' | 'weekly' | 'monthly';

const frequencyOptions = computed<SelectOption[]>(() => [
  { value: 'daily', label: t('toolkit.repeatDaily') },
  { value: 'weekly', label: t('toolkit.repeatWeekly') },
  { value: 'monthly', label: t('toolkit.repeatMonthly') }
]);

const frequency = ref<FrequencyValue>('daily');

const frequencyModel = computed<FrequencyValue>({
  get: () => frequency.value,
  set: value => {
    frequency.value = value;
    if (value === 'daily') {
      form.value.weeklySlots = [];
      form.value.monthlySlots = [];
      return;
    }
    if (value === 'weekly') {
      form.value.dailyTimes = [];
      form.value.monthlySlots = [];
      return;
    }
    form.value.dailyTimes = [];
    form.value.weeklySlots = [];
  }
});

watch(
  () => props.editingId,
  () => {
    if (form.value.dailyTimes.length) {
      frequency.value = 'daily';
    } else if (form.value.weeklySlots.length) {
      frequency.value = 'weekly';
    } else if (form.value.monthlySlots.length) {
      frequency.value = 'monthly';
    } else {
      frequency.value = 'daily';
    }
  },
  { immediate: true }
);

watch(
  () => [form.value.dailyTimes.length, form.value.weeklySlots.length, form.value.monthlySlots.length] as const,
  ([daily, weekly, monthly]) => {
    if (daily > 0) {
      frequency.value = 'daily';
      return;
    }
    if (weekly > 0) {
      frequency.value = 'weekly';
      return;
    }
    if (monthly > 0) {
      frequency.value = 'monthly';
    }
  }
);
</script>
