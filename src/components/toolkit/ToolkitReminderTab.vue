<template>
  <ReminderListPanel
    v-model="sections.list"
    :reminders="reminders"
    :title="reminderListTitle"
    :editing-id="editingId"
    @content-change="emit('contentChange')"
    @edit-reminder="editReminder"
    @trigger-now="triggerNow"
    @delete-reminder="deleteReminder"
    @toggle-enabled="toggleReminderEnabled" />

  <ReminderEditorPanels
    :editing-id="editingId"
    :form="form"
    :sections="sections"
    :daily-input-time="dailyInputTime"
    :weekly-input-days="weeklyInputDays"
    :weekly-input-time="weeklyInputTime"
    :monthly-input-days="monthlyInputDays"
    :monthly-input-time="monthlyInputTime"
    :channel-options="channelOptions"
    :weekday-options="weekdayOptions"
    :monthly-day-options="monthlyDayOptions"
    :content-type-options="contentTypeOptions"
    :format-weekday="formatWeekday"
    @content-change="emit('contentChange')"
    @open-smtp-dialog="openSmtpDialog"
    @add-daily-time="addDailyTime"
    @remove-daily-time="removeDailyTime"
    @add-weekly-slot="addWeeklySlot"
    @remove-weekly-slot="removeWeeklySlot"
    @add-monthly-slot="addMonthlySlot"
    @remove-monthly-slot="removeMonthlySlot"
    @update:daily-input-time="updateDailyInputTime"
    @update:weekly-input-days="updateWeeklyInputDays"
    @update:weekly-input-time="updateWeeklyInputTime"
    @update:monthly-input-days="updateMonthlyInputDays"
    @update:monthly-input-time="updateMonthlyInputTime"
    @content-image-change="handleContentImageChange" />

  <ReminderAdvancedPanel
    v-if="form.channel === 'fullscreen'"
    v-model="sections.advanced"
    v-model:advanced-background-type="advancedBackgroundTypeModel"
    :advanced-background-options="advancedBackgroundOptions"
    :advanced-settings="advancedSettings"
    @content-change="emit('contentChange')"
    @advanced-image-change="handleAdvancedImageChange" />

  <p v-if="statusMessage" class="toolkit-status">{{ statusMessage }}</p>
  <p v-if="errorMessage" class="toolkit-error">{{ errorMessage }}</p>

  <UiDialog
    v-model:open="allowCloseWarningOpen"
    :title="t('toolkit.reminderAllowCloseWarningTitle')"
    :message="t('toolkit.reminderAllowCloseWarningMessage')"
    :close-label="t('toolkit.reminderAllowCloseWarningClose')"
    @confirm="closeAllowCloseWarning"
    @cancel="closeAllowCloseWarning">
    <template #actions>
      <UiButton native-type="button" preset="overlay-chip" @click="closeAllowCloseWarning">
        {{ t('toolkit.reminderAllowCloseWarningClose') }}
      </UiButton>
      <UiButton native-type="button" preset="overlay-primary" @click="dismissAllowCloseWarning">
        {{ t('toolkit.reminderAllowCloseWarningDontShow') }}
      </UiButton>
    </template>
  </UiDialog>

  <div class="toolkit-profile-actions">
    <UiButton native-type="button" preset="overlay-primary" @click="saveReminder">
      {{ t('toolkit.reminderSave') }}
    </UiButton>
    <UiButton native-type="button" preset="overlay-danger" @click="resetForm">
      {{ t('toolkit.reminderReset') }}
    </UiButton>
  </div>

  <ReminderSmtpDialog
    v-model:open="smtpDialogOpen"
    :smtp-form="smtpForm"
    :smtp-test-to="smtpTestTo"
    :smtp-security-options="smtpSecurityOptions"
    @update:smtp-test-to="updateSmtpTestTo"
    @save="saveSmtpSettings"
    @test="sendSmtpTestEmail" />
</template>

<script setup lang="ts">
import UiButton from '@/components/ui/Button';
import UiDialog from '@/components/ui/Dialog';
import ReminderAdvancedPanel from './reminder/ReminderAdvancedPanel.vue';
import ReminderEditorPanels from './reminder/ReminderEditorPanels.vue';
import ReminderListPanel from './reminder/ReminderListPanel.vue';
import ReminderSmtpDialog from './reminder/ReminderSmtpDialog.vue';
import { useReminderTabState } from './reminder/useReminderTabState';

const emit = defineEmits<{
  (event: 'contentChange'): void;
}>();

const {
  t,
  reminders,
  reminderListTitle,
  editingId,
  sections,
  form,
  dailyInputTime,
  weeklyInputDays,
  weeklyInputTime,
  monthlyInputDays,
  monthlyInputTime,
  channelOptions,
  weekdayOptions,
  monthlyDayOptions,
  contentTypeOptions,
  advancedBackgroundTypeModel,
  advancedBackgroundOptions,
  advancedSettings,
  statusMessage,
  errorMessage,
  allowCloseWarningOpen,
  smtpDialogOpen,
  smtpForm,
  smtpTestTo,
  smtpSecurityOptions,
  formatWeekday,
  toggleReminderEnabled,
  updateDailyInputTime,
  updateWeeklyInputDays,
  updateWeeklyInputTime,
  updateMonthlyInputDays,
  updateMonthlyInputTime,
  updateSmtpTestTo,
  closeAllowCloseWarning,
  dismissAllowCloseWarning,
  handleAdvancedImageChange,
  handleContentImageChange,
  addDailyTime,
  removeDailyTime,
  addWeeklySlot,
  removeWeeklySlot,
  addMonthlySlot,
  removeMonthlySlot,
  openSmtpDialog,
  saveSmtpSettings,
  sendSmtpTestEmail,
  saveReminder,
  resetForm,
  editReminder,
  deleteReminder,
  triggerNow
} = useReminderTabState(event => emit(event));
</script>
