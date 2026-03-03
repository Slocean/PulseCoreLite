<template>
  <UiDialog
    v-model:open="openModel"
    :title="t('toolkit.reminderSmtpConfig')"
    :confirm-text="t('overlay.dialogConfirm')"
    :cancel-text="t('overlay.dialogCancel')"
    :close-label="t('overlay.dialogClose')"
    :autofocus-confirm="false"
    @confirm="emit('save')">
    <template #body>
      <div class="toolkit-grid">
        <label class="toolkit-field">
          <span>{{ t('toolkit.reminderSmtpHost') }}</span>
          <input v-model.trim="smtpForm.host" type="text" />
        </label>
        <label class="toolkit-field">
          <span>{{ t('toolkit.reminderSmtpPort') }}</span>
          <input v-model.number="smtpForm.port" type="number" min="1" max="65535" />
        </label>
        <label class="toolkit-field">
          <span>{{ t('toolkit.reminderSmtpSecurity') }}</span>
          <UiSelect v-model="smtpForm.security" :options="smtpSecurityOptions" />
        </label>
        <label class="toolkit-field">
          <span>{{ t('toolkit.reminderSmtpUsername') }}</span>
          <input v-model="smtpForm.username" type="text" />
        </label>
        <label class="toolkit-field">
          <span>{{ t('toolkit.reminderSmtpPassword') }}</span>
          <input v-model="smtpForm.password" type="password" />
        </label>
        <label class="toolkit-field">
          <span>{{ t('toolkit.reminderSmtpFromEmail') }}</span>
          <input v-model.trim="smtpForm.fromEmail" type="email" />
        </label>
        <label class="toolkit-field">
          <span>{{ t('toolkit.reminderSmtpFromName') }}</span>
          <input v-model="smtpForm.fromName" type="text" />
        </label>
        <label class="toolkit-field">
          <span>{{ t('toolkit.reminderSmtpTestTo') }}</span>
          <input v-model.trim="smtpTestToModel" type="email" />
        </label>
        <div class="toolkit-actions">
          <UiButton native-type="button" preset="overlay-primary" @click="emit('test')">
            {{ t('toolkit.reminderSmtpSendTest') }}
          </UiButton>
        </div>
      </div>
    </template>
  </UiDialog>
</template>

<script setup lang="ts">
import { computed } from 'vue';
import { useI18n } from 'vue-i18n';

import UiButton from '@/components/ui/Button';
import UiSelect from '@/components/ui/Select';
import type { SelectOption } from '@/components/ui/Select/types';
import UiDialog from '@/components/ui/Dialog';
import type { SmtpEmailConfig } from '@/types';

const props = defineProps<{
  open: boolean;
  smtpForm: SmtpEmailConfig;
  smtpTestTo: string;
  smtpSecurityOptions: SelectOption[];
}>();

const emit = defineEmits<{
  (event: 'update:open', value: boolean): void;
  (event: 'update:smtpTestTo', value: string): void;
  (event: 'save'): void;
  (event: 'test'): void;
}>();

const { t } = useI18n();

const openModel = computed({
  get: () => props.open,
  set: value => emit('update:open', value)
});

const smtpForm = computed(() => props.smtpForm);
const smtpSecurityOptions = computed(() => props.smtpSecurityOptions);
const smtpTestToModel = computed({
  get: () => props.smtpTestTo,
  set: value => emit('update:smtpTestTo', value)
});
</script>
