<template>
  <UiDialog
    v-model:open="factoryResetDialogOpen"
    :title="t('overlay.factoryReset')"
    :message="t('overlay.factoryResetConfirm')"
    :confirm-text="t('overlay.dialogConfirm')"
    :cancel-text="t('overlay.dialogCancel')"
    :close-label="t('overlay.dialogClose')"
    @confirm="resolveFactoryReset(true)"
    @cancel="resolveFactoryReset(false)" />

  <UiDialog
    v-model:open="importConfirmDialogOpen"
    :title="t('overlay.importConfigTitle')"
    :message="t('overlay.importConfigConfirm')"
    :confirm-text="t('overlay.dialogConfirm')"
    :cancel-text="t('overlay.dialogCancel')"
    :close-label="t('overlay.dialogClose')"
    @confirm="confirmImportConfig"
    @cancel="cancelImportConfig" />

  <UiDialog
    v-model:open="importErrorDialogOpen"
    :title="t('overlay.importConfigTitle')"
    :message="importErrorMessage"
    :confirm-text="t('overlay.dialogConfirm')"
    :cancel-text="t('overlay.dialogCancel')"
    :close-label="t('overlay.dialogClose')"
    :show-actions="false"
    @confirm="closeImportErrorDialog"
    @cancel="closeImportErrorDialog" />

  <UiDialog
    v-model:open="exportSuccessDialogOpen"
    :title="t('overlay.exportConfig')"
    :message="t('overlay.exportConfigSuccess')"
    :confirm-text="t('overlay.dialogConfirm')"
    :cancel-text="t('overlay.dialogCancel')"
    :close-label="t('overlay.dialogClose')"
    :show-actions="false"
    @confirm="closeExportSuccessDialog"
    @cancel="closeExportSuccessDialog" />

  <OverlayUpdateDialog
    v-model:open="updateDialogOpen"
    :app-version="appVersion"
    :update-version="updateVersion"
    :update-notes="updateNotes"
    :update-notes-footer-text="updateNotesFooterText"
    :update-error="updateError"
    :installing-update="installingUpdate"
    @cancel="closeUpdateDialog"
    @confirm="handleInstallUpdate" />
</template>

<script setup lang="ts">
import UiDialog from '@/components/ui/Dialog';
import OverlayUpdateDialog from './OverlayUpdateDialog.vue';

defineProps<{
  t: (key: string, params?: Record<string, unknown>) => string;
  appVersion: string;
  updateVersion?: string;
  updateNotes: string;
  updateNotesFooterText: string;
  updateError: string | null;
  installingUpdate: boolean;
  importErrorMessage: string;
  resolveFactoryReset: (confirmed: boolean) => void;
  confirmImportConfig: () => void;
  cancelImportConfig: () => void;
  closeImportErrorDialog: () => void;
  closeExportSuccessDialog: () => void;
  closeUpdateDialog: () => void;
  handleInstallUpdate: () => void;
}>();

const factoryResetDialogOpen = defineModel<boolean>('factoryResetDialogOpen');
const importConfirmDialogOpen = defineModel<boolean>('importConfirmDialogOpen');
const importErrorDialogOpen = defineModel<boolean>('importErrorDialogOpen');
const exportSuccessDialogOpen = defineModel<boolean>('exportSuccessDialogOpen');
const updateDialogOpen = defineModel<boolean>('updateDialogOpen');
</script>
