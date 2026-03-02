<template>
  <nav class="toolkit-tabs" :aria-label="ariaLabel">
    <UiButton
      v-for="tab in tabs"
      :key="tab.id"
      native-type="button"
      preset="toolkit-tab"
      :active="modelValue === tab.id"
      @click="setActive(tab.id)">
      {{ tab.label }}
    </UiButton>
  </nav>
</template>

<script setup lang="ts">
import UiButton from '@/components/ui/Button';

type TabId = string | number;

const props = withDefaults(
  defineProps<{
    tabs: Array<{ id: TabId; label: string }>;
    modelValue: TabId;
    ariaLabel?: string;
  }>(),
  {
    ariaLabel: 'Tabs'
  }
);

const emit = defineEmits<{
  (event: 'update:modelValue', value: TabId): void;
}>();

function setActive(id: TabId) {
  if (id === props.modelValue) return;
  emit('update:modelValue', id);
}
</script>
