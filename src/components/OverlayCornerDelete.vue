<template>
  <CornerAction
    preset="overlay-corner-danger"
    icon="close"
    :ariaLabel="ariaLabel"
    @click="emit('click')" />
</template>

<script setup lang="ts">
import CornerAction from '@/components/overlay/CornerAction.vue';

defineProps<{
  ariaLabel: string;
}>();

const emit = defineEmits<{
  (e: 'click'): void;
}>();
</script>

