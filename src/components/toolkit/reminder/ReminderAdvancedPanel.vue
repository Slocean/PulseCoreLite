<template>
  <UiCollapsiblePanel
    class="toolkit-card"
    :title="t('toolkit.reminderAdvancedTitle')"
    v-model="openModel"
    single-header-preset="toolkit-collapse"
    title-class="toolkit-section-title"
    indicator-class="toolkit-collapse-indicator"
    @toggle="emit('contentChange')">
    <div class="toolkit-grid">
      <label class="toolkit-field toolkit-field--inline toolkit-field--inline-select">
        <UiSelect v-model="backgroundTypeModel" :options="advancedBackgroundOptions" />
        <div v-if="backgroundTypeModel === 'image'" class="toolkit-reminder-advanced-input">
          <input v-model.trim="advancedSettings.backgroundImage" type="text" />
          <input
            :ref="advancedImageInput"
            class="toolkit-hidden-file"
            type="file"
            accept="image/*"
            @change="emit('advancedImageChange', $event)" />
          <UiButton
            native-type="button"
            preset="overlay-primary"
            class="toolkit-reminder-advanced-upload"
            @click="emit('triggerAdvancedImageSelect')">
            {{ t('toolkit.reminderAdvancedUpload') }}
          </UiButton>
        </div>
        <input v-else v-model.trim="advancedSettings.backgroundColor" type="color" />
      </label>
      <!-- <p v-if="backgroundTypeModel === 'image'" class="toolkit-reminder-advanced-hint">
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
</template>

<script setup lang="ts">
import { computed } from 'vue';
import { useI18n } from 'vue-i18n';

import type { SelectOption } from '@/components/ui/Select/types';
import type { ReminderAdvancedSettings } from '@/types';
import UiButton from '@/components/ui/Button';
import UiCollapsiblePanel from '@/components/ui/CollapsiblePanel';
import UiSelect from '@/components/ui/Select';
import UiSwitch from '@/components/ui/Switch';

import type { Ref } from 'vue';

const props = defineProps<{
  modelValue: boolean;
  advancedBackgroundType: 'image' | 'color';
  advancedBackgroundOptions: SelectOption[];
  advancedSettings: ReminderAdvancedSettings;
  advancedImageInput: Ref<HTMLInputElement | null>;
}>();

const emit = defineEmits<{
  (event: 'update:modelValue', value: boolean): void;
  (event: 'update:advancedBackgroundType', value: 'image' | 'color'): void;
  (event: 'contentChange'): void;
  (event: 'triggerAdvancedImageSelect'): void;
  (event: 'advancedImageChange', value: Event): void;
}>();

const { t } = useI18n();

const openModel = computed({
  get: () => props.modelValue,
  set: value => emit('update:modelValue', value)
});

const backgroundTypeModel = computed({
  get: () => props.advancedBackgroundType,
  set: value => emit('update:advancedBackgroundType', value)
});
</script>
