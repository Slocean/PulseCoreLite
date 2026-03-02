<template>
  <UiButton
    native-type="button"
    preset="overlay-corner-danger"
    :aria-label="ariaLabel"
    @click.stop="emit('click')"
    @contextmenu.prevent.stop>
    <span class="material-symbols-outlined">close</span>
  </UiButton>
</template>

<script setup lang="ts">
import UiButton from '@/components/ui/Button';

defineProps<{
  ariaLabel: string;
}>();

const emit = defineEmits<{
  (e: 'click'): void;
}>();
</script>

