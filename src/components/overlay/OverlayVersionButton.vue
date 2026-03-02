<template>
  <UiButton
    native-type="button"
    preset="overlay-version"
    :active="Boolean(updateAvailable)"
    :title="updateAvailable ? updateLabel : undefined"
    @click="emit('click')">
    v{{ appVersion }}
    <span v-if="updateAvailable" class="version-dot" aria-hidden="true"></span>
  </UiButton>
</template>

<script setup lang="ts">
import UiButton from '@/components/ui/Button';

defineProps<{
  appVersion: string;
  updateAvailable?: boolean;
  updateLabel?: string;
}>();

const emit = defineEmits<{
  (e: 'click'): void;
}>();
</script>
