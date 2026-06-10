<template>
  <button
    type="button"
    class="toolkit-system-hint-trigger"
    :class="{ 'toolkit-system-hint-trigger--active': active }"
    :aria-expanded="active"
    :aria-label="label"
    @click.stop="emit('toggle')">
    <span class="material-symbols-outlined" aria-hidden="true">info</span>
  </button>
</template>

<script setup lang="ts">
defineProps<{
  active: boolean;
  label: string;
}>();

const emit = defineEmits<{
  (event: 'toggle'): void;
}>();
</script>
