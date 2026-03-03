<template>
  <UiDialog
    v-model:open="open"
    :title="t('overlay.updateTitle')"
    :close-label="t('overlay.dialogClose')"
    @cancel="emit('cancel')"
    @confirm="emit('confirm')">
    <template #body>
      <div class="overlay-dialog-message overlay-dialog-message--muted">
        {{ t('overlay.updateVersionLabel', { version: updateVersion }) }}
      </div>
      <div class="overlay-update-notes-scroll">
        <div class="overlay-dialog-message overlay-dialog-message--pre" :class="{ 'overlay-dialog-message--muted': !updateNotes }">
          {{ updateNotes || t('overlay.updateNotesEmpty') }}
        </div>
      </div>
      <div class="overlay-update-notes-footer overlay-dialog-message overlay-dialog-message--muted">
        {{ updateNotesFooterText }}
      </div>
      <div v-if="updateError" class="overlay-dialog-message overlay-dialog-message--error">
        {{ updateError }}
      </div>
    </template>
    <template #actions>
      <UiButton native-type="button" preset="overlay-chip" :disabled="installingUpdate" @click="emit('cancel')">
        {{ t('overlay.dialogCancel') }}
      </UiButton>
      <UiButton native-type="button" preset="overlay-primary" :disabled="installingUpdate" @click="emit('confirm')">
        {{ installingUpdate ? t('overlay.updateInstalling') : t('overlay.updateNow') }}
      </UiButton>
    </template>
  </UiDialog>
</template>

<script setup lang="ts">
import { computed } from 'vue';
import { useI18n } from 'vue-i18n';

import UiButton from '@/components/ui/Button';
import UiDialog from '@/components/ui/Dialog';

const props = defineProps<{
  appVersion: string;
  updateVersion?: string | null;
  updateNotes: string;
  updateNotesFooterText: string;
  updateError: string | null;
  installingUpdate: boolean;
}>();

const open = defineModel<boolean>('open', { required: true });

const emit = defineEmits<{
  (e: 'confirm'): void;
  (e: 'cancel'): void;
}>();

const { t } = useI18n();
const updateVersion = computed(() => props.updateVersion ?? props.appVersion);
</script>
