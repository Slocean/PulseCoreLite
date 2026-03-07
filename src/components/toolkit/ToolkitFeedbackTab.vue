<template>
  <UiToast channel="toolkit" />

  <UiCollapsiblePanel class="toolkit-card" :title="t('overlay.feedbackTitle')" :collapsible="false" title-class="toolkit-section-title">
    <OverlayConfigFeedbackSection
      :app-version="appVersion"
      :language="language"
      toast-channel="toolkit" />
  </UiCollapsiblePanel>
</template>

<script setup lang="ts">
import { computed } from 'vue';
import { useI18n } from 'vue-i18n';

import OverlayConfigFeedbackSection from '@/components/overlay/config/OverlayConfigFeedbackSection.vue';
import UiCollapsiblePanel from '@/components/ui/CollapsiblePanel';
import UiToast from '@/components/ui/Toast';
import packageJson from '../../../package.json';
import { useAppStore } from '../../stores/app';

const { t } = useI18n();
const store = useAppStore();
const appVersion = packageJson.version;
const language = computed(() => store.settings.language);
</script>
