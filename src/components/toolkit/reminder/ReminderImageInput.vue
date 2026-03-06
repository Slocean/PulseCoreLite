<template>
  <div class="toolkit-reminder-advanced-input">
    <input v-model.trim="model" type="text" />
    <input
      ref="fileInput"
      class="toolkit-hidden-file"
      type="file"
      accept="image/*"
      @change="emit('fileChange', $event)" />
    <UiButton native-type="button" preset="overlay-primary" class="toolkit-reminder-advanced-upload" @click="triggerSelect">
      {{ uploadLabel }}
    </UiButton>
  </div>
</template>

<script setup lang="ts">
import { computed, ref } from 'vue';

import UiButton from '@/components/ui/Button';

const props = defineProps<{
  modelValue: string;
  uploadLabel: string;
}>();

const emit = defineEmits<{
  (event: 'update:modelValue', value: string): void;
  (event: 'fileChange', value: Event): void;
}>();

const fileInput = ref<HTMLInputElement | null>(null);

const model = computed({
  get: () => props.modelValue,
  set: value => emit('update:modelValue', value)
});

function triggerSelect() {
  fileInput.value?.click();
}
</script>
