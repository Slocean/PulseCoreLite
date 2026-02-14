<template>
  <button
    type="button"
    class="overlay-corner-delete"
    :aria-label="ariaLabel"
    @click.stop="emit('click')"
    @contextmenu.prevent.stop>
    <span class="material-symbols-outlined">close</span>
  </button>
</template>

<script setup lang="ts">
defineProps<{
  ariaLabel: string;
}>();

const emit = defineEmits<{
  (e: 'click'): void;
}>();
</script>
