import { computed, onMounted, ref } from 'vue';
import type { ComposerTranslation } from 'vue-i18n';

import { api, inTauri } from '@/services/tauri';
import { useToastService } from '@/composables/useToastService';
import type { StartupItem } from '@/types/startup';

type Translate = ComposerTranslation;

export function useToolkitStartupItems(t: Translate) {
  const { showToast } = useToastService('toolkit');
  const items = ref<StartupItem[]>([]);
  const loading = ref(false);
  const togglingId = ref<string | null>(null);
  const errorMessage = ref('');

  const runtimeSupported = computed(() => inTauri());
  const enabledCount = computed(() => items.value.filter(item => item.enabled).length);

  function sourceLabel(source: string) {
    const key = `toolkit.systemStartupSource${source
      .split('_')
      .map(part => part.charAt(0).toUpperCase() + part.slice(1))
      .join('')}` as 'toolkit.systemStartupSourceRegistryHkcu';
    const translated = t(key);
    return translated === key ? source : translated;
  }

  async function refresh() {
    if (!runtimeSupported.value) {
      return;
    }
    loading.value = true;
    errorMessage.value = '';
    try {
      items.value = await api.listStartupItems();
    } catch (error) {
      errorMessage.value = error instanceof Error ? error.message : String(error);
      showToast(t('toolkit.systemStartupLoadFailed'), { variant: 'error' });
    } finally {
      loading.value = false;
    }
  }

  async function toggleItem(item: StartupItem, enabled: boolean) {
    if (!item.writable || togglingId.value) {
      return;
    }
    togglingId.value = item.id;
    errorMessage.value = '';
    try {
      await api.setStartupItemEnabled(item.id, enabled);
      await refresh();
      showToast(
        enabled ? t('toolkit.systemStartupEnabledToast') : t('toolkit.systemStartupDisabledToast'),
        { variant: 'success' }
      );
    } catch (error) {
      errorMessage.value = error instanceof Error ? error.message : String(error);
      showToast(t('toolkit.systemStartupToggleFailed'), { variant: 'error' });
    } finally {
      togglingId.value = null;
    }
  }

  onMounted(() => {
    void refresh();
  });

  return {
    items,
    loading,
    togglingId,
    errorMessage,
    runtimeSupported,
    enabledCount,
    sourceLabel,
    refresh,
    toggleItem
  };
}
