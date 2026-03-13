<template>
  <UiDialog
    v-model:open="open"
    :title="t('overlay.themeEditTitle')"
    :confirm-text="t('overlay.dialogConfirm')"
    :cancel-text="t('overlay.dialogCancel')"
    :close-label="t('overlay.dialogClose')"
    :autofocus-confirm="false"
    @confirm="emit('confirm')"
    @cancel="emit('cancel')">
    <template #body>
      <div class="overlay-dialog-input-wrap">
        <input
          v-if="false"
          class="overlay-dialog-input"
          type="text"
          :placeholder="t('overlay.themeNamePlaceholder')"
          maxlength="3" />
        <div class="overlay-config-language overlay-config-effect" style="margin-top: 10px">
          <span class="overlay-config-label">{{ t('overlay.backgroundEffect') }}</span>
          <div class="overlay-lang-buttons overlay-config-effect-buttons">
            <UiButton native-type="button" preset="overlay-chip-soft" :active="effect === 'gaussian'" @click="effect = 'gaussian'">
              {{ t('overlay.effectGaussian') }}
            </UiButton>
            <UiButton
              native-type="button"
              preset="overlay-chip-soft"
              :active="effect === 'liquidGlass'"
              @click="effect = 'liquidGlass'">
              {{ t('overlay.effectLiquidGlass') }}
            </UiButton>
          </div>
        </div>
        <div class="overlay-config-range" style="margin-top: 10px">
          <span class="overlay-config-label">
            {{ effect === 'gaussian' ? t('overlay.backgroundBlur') : t('overlay.backgroundGlassBlur') }}
          </span>
          <span class="overlay-config-value">{{ blurPx }}px</span>
          <input type="range" min="0" max="24" step="1" v-model.number="blurPx" />
        </div>
        <div v-if="effect === 'liquidGlass'" class="overlay-config-range">
          <span class="overlay-config-label">{{ t('overlay.backgroundGlassStrength') }}</span>
          <span class="overlay-config-value">{{ glassStrength }}%</span>
          <input type="range" min="0" max="100" step="5" v-model.number="glassStrength" />
        </div>
        <div class="overlay-config-row">
          <span class="overlay-config-label">{{ t('overlay.textBrightnessBoost') }}</span>
          <UiSwitch v-model="textBrightnessBoost" :aria-label="t('overlay.textBrightnessBoost')" />
        </div>
      </div>
    </template>
    <template #actions>
      <UiButton native-type="button" preset="overlay-chip" @click="emit('cancel')">
        {{ t('overlay.dialogCancel') }}
      </UiButton>
      <UiButton native-type="button" preset="overlay-primary" :disabled="!canConfirmThemeEdit" @click="emit('confirm')">
        {{ t('overlay.dialogConfirm') }}
      </UiButton>
    </template>
  </UiDialog>
</template>

<script setup lang="ts">
import { useI18n } from 'vue-i18n';

import UiButton from '@/components/ui/Button';
import UiDialog from '@/components/ui/Dialog';
import UiSwitch from '@/components/ui/Switch';
import type { OverlayBackgroundEffect } from '../../composables/useOverlayPrefs';

defineProps<{
  canConfirmThemeEdit: boolean;
}>();

const open = defineModel<boolean>('open', { required: true });
const effect = defineModel<OverlayBackgroundEffect>('effect', { required: true });
const blurPx = defineModel<number>('blurPx', { required: true });
const glassStrength = defineModel<number>('glassStrength', { required: true });
const textBrightnessBoost = defineModel<boolean>('textBrightnessBoost', { required: true });

const emit = defineEmits<{
  (e: 'confirm'): void;
  (e: 'cancel'): void;
}>();

const { t } = useI18n();
</script>
