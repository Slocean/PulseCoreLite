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
    @update:monthly-input-time="updateMonthlyInputTime" />

  <UiCollapsiblePanel
    v-if="form.channel === 'fullscreen'"
    class="toolkit-card"
    :title="t('toolkit.reminderAdvancedTitle')"
    v-model="sections.advanced"
    single-header-preset="toolkit-collapse"
    title-class="toolkit-section-title"
    indicator-class="toolkit-collapse-indicator"
    @toggle="emit('contentChange')">
    <div class="toolkit-grid">
      <label class="toolkit-field toolkit-field--inline toolkit-field--inline-select">
        <UiSelect v-model="advancedBackgroundTypeModel" :options="advancedBackgroundOptions" />
        <div v-if="advancedBackgroundTypeModel === 'image'" class="toolkit-reminder-advanced-input">
          <input v-model.trim="advancedSettings.backgroundImage" type="text" />
          <input
            ref="advancedImageInput"
            class="toolkit-hidden-file"
            type="file"
            accept="image/*"
            @change="handleAdvancedImageChange" />
          <UiButton
            native-type="button"
            preset="overlay-primary"
            class="toolkit-reminder-advanced-upload"
            @click="triggerAdvancedImageSelect">
            {{ t('toolkit.reminderAdvancedUpload') }}
          </UiButton>
        </div>
        <input v-else v-model.trim="advancedSettings.backgroundColor" type="color" />
      </label>
      <!-- <p v-if="advancedBackgroundTypeModel === 'image'" class="toolkit-reminder-advanced-hint">
        {{ t('toolkit.reminderAdvancedUploadHint') }}
      </p> -->
      <div class="toolkit-reminder-advanced-duo">
        <div class="overlay-config-row">
          <span class="overlay-config-label">{{ t('toolkit.reminderAdvancedAllowClose') }}</span>
          <UiSwitch v-model="advancedSettings.allowClose" :aria-label="t('toolkit.reminderAdvancedAllowClose')" />
        </div>
        <!-- <span v-if="!advancedSettings.allowClose" class="toolkit-reminder-advanced-hint">
          {{ t('toolkit.reminderAdvancedRequirePasswordHint') }}
        </span> -->
        <div class="overlay-config-row">
          <span class="overlay-config-label">{{ t('toolkit.reminderAdvancedBlockButtons') }}</span>
          <UiSwitch
            v-model="advancedSettings.blockAllKeys"
            :aria-label="t('toolkit.reminderAdvancedBlockButtons')" />
        </div>
      </div>
      <div class="overlay-config-row toolkit-reminder-advanced-password">
        <span class="overlay-config-label">{{ t('toolkit.reminderAdvancedRequirePassword') }}</span>
        <div class="toolkit-reminder-advanced-password-controls">
          <UiSwitch
            v-model="advancedSettings.requireClosePassword"
            :aria-label="t('toolkit.reminderAdvancedRequirePassword')"
            :disabled="!advancedSettings.allowClose" />
          <input
            v-model.trim="advancedSettings.closePassword"
            class="toolkit-reminder-advanced-password-input"
            type="password"
            :aria-label="t('toolkit.reminderAdvancedClosePassword')"
            :disabled="!advancedSettings.allowClose || !advancedSettings.requireClosePassword"
            :class="{
              'toolkit-reminder-advanced-password-input--hidden': !advancedSettings.requireClosePassword
            }" />
        </div>
      </div>
    </div>
  </UiCollapsiblePanel>

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
import UiCollapsiblePanel from '@/components/ui/CollapsiblePanel';
import UiButton from '@/components/ui/Button';
import UiDialog from '@/components/ui/Dialog';
import UiSelect from '@/components/ui/Select';
import UiSwitch from '@/components/ui/Switch';
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
  advancedImageInput,
  updateDailyInputTime,
  updateWeeklyInputDays,
  updateWeeklyInputTime,
  updateMonthlyInputDays,
  updateMonthlyInputTime,
  updateSmtpTestTo,
  closeAllowCloseWarning,
  dismissAllowCloseWarning,
  triggerAdvancedImageSelect,
  handleAdvancedImageChange,
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
