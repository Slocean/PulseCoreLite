import { computed, onMounted, ref } from 'vue';
import type { ComposerTranslation } from 'vue-i18n';

import { api, inTauri } from '@/services/tauri';
import { useToastService } from '@/composables/useToastService';
import type { ContextMenuStyle, SystemToolsStatus } from '@/types/systemTools';

type Translate = ComposerTranslation;

export function useToolkitSystemTweaks(t: Translate) {
  const { showToast } = useToastService('toolkit');
  const status = ref<SystemToolsStatus>({
    contextMenuStyle: 'win11',
    windowsUpdateDisabled: false
  });
  const loading = ref(false);
  const pendingAction = ref<'update' | 'contextMenu' | 'activateWindows' | 'activateOffice' | null>(null);
  const selectedContextMenuStyle = ref<ContextMenuStyle>('win11');
  const errorMessage = ref('');

  const runtimeSupported = computed(() => inTauri());
  const contextMenuDirty = computed(
    () => selectedContextMenuStyle.value !== status.value.contextMenuStyle
  );

  async function refreshStatus() {
    if (!runtimeSupported.value) {
      return;
    }
    loading.value = true;
    errorMessage.value = '';
    try {
      status.value = await api.getSystemToolsStatus();
      selectedContextMenuStyle.value = status.value.contextMenuStyle;
    } catch (error) {
      errorMessage.value = error instanceof Error ? error.message : String(error);
      showToast(t('toolkit.systemToolsStatusFailed'), { variant: 'error' });
    } finally {
      loading.value = false;
    }
  }

  async function confirmAction(title: string, message: string) {
    return api.confirmFactoryReset(title, message);
  }

  async function disableWindowsUpdate() {
    if (!runtimeSupported.value || pendingAction.value) {
      return;
    }
    const confirmed = await confirmAction(
      t('toolkit.systemUpdateDisableConfirmTitle'),
      t('toolkit.systemUpdateDisableConfirmMessage')
    );
    if (!confirmed) {
      return;
    }
    pendingAction.value = 'update';
    errorMessage.value = '';
    try {
      await api.disableWindowsUpdatePermanently();
      showToast(t('toolkit.systemUpdateDisableLaunched'), { variant: 'info' });
      window.setTimeout(() => {
        void refreshStatus();
      }, 3000);
    } catch (error) {
      errorMessage.value = error instanceof Error ? error.message : String(error);
      showToast(t('toolkit.systemUpdateDisableFailed'), { variant: 'error' });
    } finally {
      pendingAction.value = null;
    }
  }

  async function applyContextMenuStyle() {
    if (!runtimeSupported.value || pendingAction.value || !contextMenuDirty.value) {
      return;
    }
    pendingAction.value = 'contextMenu';
    errorMessage.value = '';
    try {
      status.value = await api.applyContextMenuStyle(selectedContextMenuStyle.value);
      selectedContextMenuStyle.value = status.value.contextMenuStyle;
      showToast(t('toolkit.systemContextMenuApplied'), { variant: 'success' });
    } catch (error) {
      errorMessage.value = error instanceof Error ? error.message : String(error);
      showToast(t('toolkit.systemContextMenuFailed'), { variant: 'error' });
    } finally {
      pendingAction.value = null;
    }
  }

  async function activateWindows() {
    await launchActivation('activateWindows');
  }

  async function activateOffice() {
    await launchActivation('activateOffice');
  }

  async function launchActivation(action: 'activateWindows' | 'activateOffice') {
    if (!runtimeSupported.value || pendingAction.value) {
      return;
    }
    const confirmed = await confirmAction(
      t('toolkit.systemActivationConfirmTitle'),
      t('toolkit.systemActivationConfirmMessage')
    );
    if (!confirmed) {
      return;
    }
    pendingAction.value = action;
    errorMessage.value = '';
    try {
      await api.launchMasActivation();
      showToast(t('toolkit.systemActivationLaunched'), { variant: 'info' });
    } catch (error) {
      errorMessage.value = error instanceof Error ? error.message : String(error);
      showToast(t('toolkit.systemActivationFailed'), { variant: 'error' });
    } finally {
      pendingAction.value = null;
    }
  }

  onMounted(() => {
    void refreshStatus();
  });

  return {
    status,
    loading,
    pendingAction,
    selectedContextMenuStyle,
    errorMessage,
    runtimeSupported,
    contextMenuDirty,
    refreshStatus,
    disableWindowsUpdate,
    applyContextMenuStyle,
    activateWindows,
    activateOffice
  };
}
