<template>
  <div class="overlay-config-item--wide overlay-config-feedback">
    <div class="overlay-config-feedback-header">
      <span class="overlay-config-label">{{ t('overlay.feedbackTitle') }}</span>
      <span class="overlay-config-feedback-subtitle">{{ t('overlay.feedbackHint') }}</span>
    </div>

    <div class="overlay-config-feedback-grid">
      <div class="overlay-config-row">
        <span class="overlay-config-label">{{ t('overlay.feedbackType') }}</span>
        <UiSelect
          v-model="feedbackType"
          class="overlay-config-feedback-select"
          :aria-label="t('overlay.feedbackType')"
          :options="feedbackTypeOptions" />
      </div>
      <div class="overlay-config-row">
        <span class="overlay-config-label">{{ t('overlay.feedbackContact') }}</span>
        <input
          v-model.trim="contact"
          class="overlay-config-input overlay-config-input--compact"
          type="text"
          maxlength="120"
          :placeholder="t('overlay.feedbackContactPlaceholder')" />
      </div>
    </div>

    <div class="overlay-config-feedback-message">
      <textarea
        v-model.trim="message"
        class="overlay-config-textarea"
        rows="4"
        maxlength="800"
        :placeholder="t('overlay.feedbackMessagePlaceholder')"></textarea>
      <div class="overlay-config-feedback-meta">
        <span class="overlay-config-feedback-count">{{ message.length }}/800</span>
        <div class="overlay-config-inline">
          <span class="overlay-config-label">{{ t('overlay.feedbackIncludeSystem') }}</span>
          <UiSwitch
            :model-value="includeSystemInfo"
            :aria-label="t('overlay.feedbackIncludeSystem')"
            @update:model-value="includeSystemInfo = $event" />
        </div>
      </div>
    </div>

    <div class="overlay-config-feedback-actions">
      <UiButton native-type="button" preset="overlay-chip" :disabled="!canSubmit" @click="copyPayload">
        {{ t('overlay.feedbackCopy') }}
      </UiButton>
      <UiButton native-type="button" preset="overlay-chip-soft" :disabled="!canSubmit" @click="openIssue">
        {{ t('overlay.feedbackOpenIssue') }}
      </UiButton>
      <UiButton native-type="button" preset="overlay-primary" :disabled="!canSubmit" @click="submitFeedback">
        {{ t('overlay.feedbackSubmit') }}
      </UiButton>
    </div>
    <div class="overlay-config-feedback-footnote">{{ t('overlay.feedbackPrivacy') }}</div>
  </div>
</template>

<script setup lang="ts">
import { computed, ref } from 'vue';
import { useI18n } from 'vue-i18n';

import UiButton from '@/components/ui/Button';
import UiSelect from '@/components/ui/Select';
import UiSwitch from '@/components/ui/Switch';
import { useToastService } from '@/composables/useToastService';
import type { SelectOption } from '@/components/ui/Select/types';

const props = withDefaults(
  defineProps<{
    appVersion: string;
    language: 'zh-CN' | 'en-US';
    feedbackIssueUrl?: string;
    toastChannel?: string;
  }>(),
  {
    feedbackIssueUrl: 'https://github.com/Slocean/PulseCoreLite/issues/new',
    toastChannel: 'overlay'
  }
);

const { t } = useI18n();
const { showToast } = useToastService(props.toastChannel);

const feedbackType = ref<'bug' | 'feature' | 'experience' | 'other'>('bug');
const contact = ref('');
const message = ref('');
const includeSystemInfo = ref(true);

const feedbackTypeOptions = computed<SelectOption[]>(() => [
  { value: 'bug', label: t('overlay.feedbackTypeBug') },
  { value: 'feature', label: t('overlay.feedbackTypeFeature') },
  { value: 'experience', label: t('overlay.feedbackTypeExperience') },
  { value: 'other', label: t('overlay.feedbackTypeOther') }
]);

const canSubmit = computed(() => message.value.trim().length >= 6);

function openExternalUrl(url: string): boolean {
  try {
    const anchor = document.createElement('a');
    anchor.href = url;
    anchor.target = '_blank';
    anchor.rel = 'noopener noreferrer';
    anchor.click();
    return true;
  } catch {
    return false;
  }
}

function buildSystemInfo() {
  if (!includeSystemInfo.value) return null;
  if (typeof navigator === 'undefined' || typeof window === 'undefined') return null;
  return {
    userAgent: navigator.userAgent,
    platform: navigator.platform,
    locale: navigator.language,
    screen: `${window.screen.width}x${window.screen.height}`
  };
}

function buildPayload() {
  return {
    type: feedbackType.value,
    message: message.value.trim(),
    contact: contact.value.trim() || null,
    appVersion: props.appVersion,
    language: props.language,
    createdAt: new Date().toISOString(),
    system: buildSystemInfo()
  };
}

function buildIssueBody(payload: ReturnType<typeof buildPayload>) {
  const lines: string[] = [];
  lines.push('## Feedback');
  lines.push(`- Type: ${payload.type}`);
  lines.push(`- Message: ${payload.message}`);
  lines.push(`- Contact: ${payload.contact ?? 'N/A'}`);
  lines.push('');
  lines.push('## Environment');
  lines.push(`- App Version: v${payload.appVersion}`);
  lines.push(`- Language: ${payload.language}`);
  if (payload.system) {
    lines.push(`- Platform: ${payload.system.platform}`);
    lines.push(`- Locale: ${payload.system.locale}`);
    lines.push(`- Screen: ${payload.system.screen}`);
    lines.push(`- User Agent: ${payload.system.userAgent}`);
  }
  return lines.join('\n');
}

async function copyPayload() {
  const payload = buildPayload();
  try {
    await navigator.clipboard.writeText(JSON.stringify(payload, null, 2));
    showToast(t('overlay.feedbackCopySuccess'));
  } catch {
    showToast(t('overlay.feedbackCopyFailed'));
  }
}

function openIssue() {
  const payload = buildPayload();
  const title = `[Feedback] ${feedbackType.value}`;
  const body = buildIssueBody(payload);
  const url = `${props.feedbackIssueUrl}?title=${encodeURIComponent(title)}&body=${encodeURIComponent(body)}`;
  if (!openExternalUrl(url)) {
    showToast(t('overlay.feedbackOpenFailed'));
    return;
  }
  showToast(t('overlay.feedbackOpenSuccess'));
}

async function submitFeedback() {
  await copyPayload();
  openIssue();
}
</script>
