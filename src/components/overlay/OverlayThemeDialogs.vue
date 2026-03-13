<template>
  <UiDialog
    v-model:open="backgroundDialogOpen"
    :title="t('overlay.backgroundImageTitle')"
    :confirm-text="t('overlay.backgroundApply')"
    :cancel-text="t('overlay.dialogCancel')"
    :close-label="t('overlay.dialogClose')"
    @confirm="applyBackgroundCrop"
    @cancel="closeBackgroundDialog">
    <template #body>
      <div class="overlay-background-body">
        <div
          class="overlay-upload"
          :class="{ 'overlay-upload--active': isDragging }"
          @click="triggerFileInput"
          @dragover.prevent="handleDragOver"
          @dragleave.prevent="handleDragLeave"
          @drop.prevent="handleDrop">
          <input
            :ref="setBackgroundFileInput"
            class="overlay-upload-input"
            type="file"
            accept="image/*"
            @change="handleFileChange" />
          <div class="overlay-upload-title">{{ t('overlay.backgroundUpload') }}</div>
          <div class="overlay-upload-subtitle">{{ t('overlay.backgroundUploadHint') }}</div>
          <div v-if="backgroundFileName" class="overlay-upload-name">{{ backgroundFileName }}</div>
        </div>
        <div v-if="backgroundImageSource" class="overlay-crop">
          <div class="overlay-crop-title">{{ t('overlay.backgroundCrop') }}</div>
          <canvas :ref="setCropCanvas" class="overlay-crop-canvas" @mousedown="handleCropMouseDown"></canvas>
          <div class="overlay-crop-tip">{{ t('overlay.backgroundCropHint') }}</div>
        </div>
        <div v-if="backgroundImageSource" class="overlay-config-language overlay-config-effect">
          <span class="overlay-config-label">{{ t('overlay.backgroundEffect') }}</span>
          <div class="overlay-lang-buttons overlay-config-effect-buttons">
            <UiButton
              native-type="button"
              preset="overlay-chip-soft"
              :active="backgroundEffect === 'gaussian'"
              @click="setBackgroundEffect('gaussian')">
              {{ t('overlay.effectGaussian') }}
            </UiButton>
            <UiButton
              native-type="button"
              preset="overlay-chip-soft"
              :active="backgroundEffect === 'liquidGlass'"
              @click="setBackgroundEffect('liquidGlass')">
              {{ t('overlay.effectLiquidGlass') }}
            </UiButton>
          </div>
        </div>
        <div v-if="backgroundImageSource" class="overlay-config-range">
          <span class="overlay-config-label">
            {{ backgroundEffect === 'gaussian' ? t('overlay.backgroundBlur') : t('overlay.backgroundGlassBlur') }}
          </span>
          <span class="overlay-config-value">{{ backgroundBlurPx }}px</span>
          <input
            type="range"
            min="0"
            max="24"
            step="1"
            v-model.number="backgroundBlurPx"
            @input="drawCropCanvas" />
        </div>
        <div v-if="backgroundImageSource && backgroundEffect === 'liquidGlass'" class="overlay-config-range">
          <span class="overlay-config-label">{{ t('overlay.backgroundGlassStrength') }}</span>
          <span class="overlay-config-value">{{ backgroundGlassStrength }}%</span>
          <input
            type="range"
            min="0"
            max="100"
            step="5"
            v-model.number="backgroundGlassStrength"
            @input="drawCropCanvas" />
        </div>
        <div v-if="backgroundImageSource" class="overlay-config-range">
          <span class="overlay-config-label">{{ t('overlay.textBrightnessBoost') }}</span>
          <span class="overlay-config-value">{{ backgroundTextBrightnessBoost }}%</span>
          <input type="range" min="0" max="100" step="5" v-model.number="backgroundTextBrightnessBoost" />
        </div>
      </div>
    </template>
    <template #actions>
      <UiButton native-type="button" preset="overlay-chip" @click="closeBackgroundDialog">
        {{ t('overlay.dialogCancel') }}
      </UiButton>
      <UiButton
        native-type="button"
        preset="overlay-primary"
        :disabled="!canApplyBackground"
        @click="applyBackgroundCrop">
        {{ t('overlay.backgroundApply') }}
      </UiButton>
      <UiButton
        native-type="button"
        preset="overlay-primary"
        :disabled="!canApplyBackground || !canSaveTheme"
        @click="applyBackgroundAndSave">
        {{ t('overlay.backgroundApplySave') }}
      </UiButton>
    </template>
  </UiDialog>

  <UiDialog
    v-model:open="themeNameDialogOpen"
    :title="t('overlay.themeSaveTitle')"
    :confirm-text="t('overlay.dialogConfirm')"
    :cancel-text="t('overlay.dialogCancel')"
    :close-label="t('overlay.dialogClose')"
    :autofocus-confirm="false"
    @confirm="confirmSaveTheme"
    @cancel="closeThemeNameDialog">
    <template #body>
      <div class="overlay-dialog-input-wrap">
        <div class="overlay-dialog-message">{{ t('overlay.themeNameHint') }}</div>
        <input
          v-model="themeNameInput"
          class="overlay-dialog-input"
          type="text"
          :placeholder="t('overlay.themeNamePlaceholder')"
          maxlength="3" />
      </div>
    </template>
    <template #actions>
      <UiButton native-type="button" preset="overlay-chip" @click="closeThemeNameDialog">
        {{ t('overlay.dialogCancel') }}
      </UiButton>
      <UiButton
        native-type="button"
        preset="overlay-primary"
        :disabled="!canConfirmThemeName"
        @click="confirmSaveTheme">
        {{ t('overlay.dialogConfirm') }}
      </UiButton>
    </template>
  </UiDialog>

  <UiDialog
    v-model:open="themeDeleteDialogOpen"
    :title="t('overlay.themeDeleteTitle')"
    :message="t('overlay.themeDeleteMessage')"
    :confirm-text="t('overlay.dialogConfirm')"
    :cancel-text="t('overlay.dialogCancel')"
    :close-label="t('overlay.dialogClose')"
    @confirm="confirmDeleteTheme"
    @cancel="closeDeleteThemeDialog" />

  <OverlayThemeEditDialog
    v-model:open="themeEditDialogOpen"
    v-model:effect="themeEditEffect"
    v-model:blurPx="themeEditBlurPx"
    v-model:glassStrength="themeEditGlassStrength"
    v-model:text-brightness-boost="themeEditTextBrightnessBoost"
    :can-confirm-theme-edit="canConfirmThemeEdit"
    @confirm="confirmEditTheme"
    @cancel="closeEditThemeDialog" />
</template>

<script setup lang="ts">
import type { VNodeRef } from 'vue';

import UiButton from '@/components/ui/Button';
import UiDialog from '@/components/ui/Dialog';
import UiSwitch from '@/components/ui/Switch';
import OverlayThemeEditDialog from './OverlayThemeEditDialog.vue';

type ThemeEffect = 'gaussian' | 'liquidGlass';

defineProps<{
  t: (key: string, params?: Record<string, unknown>) => string;
  backgroundImageSource: string | null;
  backgroundFileName: string | null;
  setBackgroundFileInput: VNodeRef;
  setCropCanvas: VNodeRef;
  isDragging: boolean;
  canApplyBackground: boolean;
  canSaveTheme: boolean;
  canConfirmThemeName: boolean;
  canConfirmThemeEdit: boolean;
  applyBackgroundCrop: () => void;
  applyBackgroundAndSave: () => void;
  closeBackgroundDialog: () => void;
  setBackgroundEffect: (effect: ThemeEffect) => void;
  triggerFileInput: () => void;
  handleDragOver: (event: DragEvent) => void;
  handleDragLeave: (event: DragEvent) => void;
  handleDrop: (event: DragEvent) => void;
  handleFileChange: (event: Event) => void;
  handleCropMouseDown: (event: MouseEvent) => void;
  drawCropCanvas: () => void;
  confirmSaveTheme: () => void;
  closeThemeNameDialog: () => void;
  confirmDeleteTheme: () => void;
  closeDeleteThemeDialog: () => void;
  confirmEditTheme: () => void;
  closeEditThemeDialog: () => void;
}>();

const backgroundDialogOpen = defineModel<boolean>('backgroundDialogOpen', { required: true });
const themeNameDialogOpen = defineModel<boolean>('themeNameDialogOpen', { required: true });
const themeDeleteDialogOpen = defineModel<boolean>('themeDeleteDialogOpen', { required: true });
const themeEditDialogOpen = defineModel<boolean>('themeEditDialogOpen', { required: true });
const themeEditEffect = defineModel<ThemeEffect>('themeEditEffect', { required: true });
const themeEditBlurPx = defineModel<number>('themeEditBlurPx', { required: true });
const themeEditGlassStrength = defineModel<number>('themeEditGlassStrength', { required: true });
const themeEditTextBrightnessBoost = defineModel<number>('themeEditTextBrightnessBoost', { required: true });
const themeNameInput = defineModel<string>('themeNameInput', { required: true });
const backgroundEffect = defineModel<ThemeEffect>('backgroundEffect', { required: true });
const backgroundBlurPx = defineModel<number>('backgroundBlurPx', { required: true });
const backgroundGlassStrength = defineModel<number>('backgroundGlassStrength', { required: true });
const backgroundTextBrightnessBoost = defineModel<number>('backgroundTextBrightnessBoost', { required: true });

</script>
