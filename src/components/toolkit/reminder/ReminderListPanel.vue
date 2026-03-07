<template>
  <UiCollapsiblePanel
    class="toolkit-card"
    :title="panelTitle"
    v-model="open"
    header-mode="split"
    header-class="toolkit-section-header"
    split-title-preset="toolkit-collapse-title"
    split-toggle-preset="toolkit-collapse-icon"
    title-class="toolkit-section-title"
    indicator-class="toolkit-collapse-indicator"
    @toggle="emit('contentChange')">
    <div v-if="!reminders.length" class="toolkit-plan toolkit-plan--muted">
      {{ t('toolkit.reminderListEmpty') }}
    </div>
    <div v-else class="toolkit-reminder-list">
      <div
        v-for="item in reminders"
        :key="item.id"
        class="toolkit-reminder-item"
        :class="{ 'toolkit-reminder-item--editing': isEditing(item.id) }">
        <div class="toolkit-reminder-item-header">
          <div class="toolkit-reminder-item-title">
            <span>{{ item.title }}</span>
            <span v-if="isEditing(item.id)" class="toolkit-reminder-item-editing">
              {{ t('toolkit.reminderEditing') }}
            </span>
          </div>
          <UiSwitch
            :model-value="item.enabled"
            :aria-label="t('toolkit.reminderEnabled')"
            @update:model-value="(value: boolean) => emit('toggleEnabled', item.id, value)" />
        </div>
        <div class="toolkit-reminder-item-footer">
          <div class="toolkit-reminder-item-meta">
            <span>
              {{
                item.channel === 'email'
                  ? t('toolkit.reminderChannelEmail')
                  : t('toolkit.reminderChannelFullscreen')
              }}
            </span>
            <span v-if="item.channel === 'email'">{{ item.email }}</span>
          </div>
          <div class="toolkit-reminder-item-actions">
            <UiButton native-type="button" preset="toolkit-link" @click="emit('editReminder', item)">
              {{ t('toolkit.reminderEditAction') }}
            </UiButton>
            <UiButton native-type="button" preset="toolkit-link" @click="emit('triggerNow', item)">
              {{ t('toolkit.reminderTriggerNow') }}
            </UiButton>
            <UiButton native-type="button" preset="toolkit-link" @click="emit('deleteReminder', item.id)">
              {{ t('toolkit.reminderDelete') }}
            </UiButton>
          </div>
        </div>
      </div>
    </div>
    <div class="toolkit-reminder-list-actions">
      <UiButton
        native-type="button"
        preset="overlay-primary"
        class="toolkit-reminder-create"
        :aria-label="t('toolkit.reminderCreate')"
        @click="emit('createReminder')">
        <span class="material-symbols-outlined">add</span>
        <span>{{ t('toolkit.reminderCreate') }}</span>
      </UiButton>
    </div>
  </UiCollapsiblePanel>
</template>

<script setup lang="ts">
import { computed } from 'vue';
import { useI18n } from 'vue-i18n';

import UiButton from '@/components/ui/Button';
import UiSwitch from '@/components/ui/Switch';
import UiCollapsiblePanel from '@/components/ui/CollapsiblePanel';
import type { TaskReminder } from '@/types';

const props = defineProps<{
  reminders: TaskReminder[];
  modelValue: boolean;
  title?: string;
  editingId?: string | null;
}>();
const emit = defineEmits<{
  (event: 'update:modelValue', value: boolean): void;
  (event: 'contentChange'): void;
  (event: 'createReminder'): void;
  (event: 'editReminder', item: TaskReminder): void;
  (event: 'triggerNow', item: TaskReminder): void;
  (event: 'deleteReminder', id: string): void;
  (event: 'toggleEnabled', id: string, value: boolean): void;
}>();

const { t } = useI18n();

const reminders = computed(() => props.reminders);
const panelTitle = computed(() => props.title ?? t('toolkit.reminderList'));
const open = computed({
  get: () => props.modelValue,
  set: value => emit('update:modelValue', value)
});
const isEditing = (id: string) => props.editingId === id;
</script>
