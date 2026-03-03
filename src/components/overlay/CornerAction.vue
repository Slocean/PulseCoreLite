<template>
  <UiButton
    native-type="button"
    :preset="preset"
    :aria-label="ariaLabel"
    @click.stop="emit('click', $event)"
    @contextmenu.prevent.stop>
    <slot>
      <span class="material-symbols-outlined">{{ icon }}</span>
    </slot>
  </UiButton>
</template>

<script setup lang="ts">
import UiButton from '@/components/ui/Button';
import type { ButtonPreset } from '@/components/ui/Button/types';

withDefaults(
  defineProps<{
    ariaLabel: string;
    preset?: ButtonPreset;
    icon?: string;
  }>(),
  {
    preset: 'overlay-corner-danger',
    icon: 'close'
  }
);

const emit = defineEmits<{
  (e: 'click', event: MouseEvent): void;
}>();
</script>
