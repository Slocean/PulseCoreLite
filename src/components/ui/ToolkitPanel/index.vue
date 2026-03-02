<template>
  <article class="toolkit-card ui-toolkit-panel" :class="props.cardClass">
    <template v-if="props.collapsible">
      <div v-if="props.headerMode === 'split'" class="toolkit-section-header ui-toolkit-panel__header">
        <UiButton native-type="button" preset="toolkit-collapse-title" @click="toggleOpen">
          <span class="toolkit-section-title">{{ props.title }}</span>
        </UiButton>
        <slot name="header-actions" />
        <UiButton
          native-type="button"
          preset="toolkit-collapse-icon"
          :aria-label="toggleLabel"
          @click="toggleOpen">
          <span class="toolkit-collapse-indicator material-symbols-outlined" :class="{ 'is-open': isOpen }">
            expand_more
          </span>
        </UiButton>
      </div>
      <UiButton v-else native-type="button" preset="toolkit-collapse" @click="toggleOpen">
        <span class="toolkit-section-title">{{ props.title }}</span>
        <span class="toolkit-collapse-indicator material-symbols-outlined" :class="{ 'is-open': isOpen }">
          expand_more
        </span>
      </UiButton>
    </template>
    <h2 v-else class="toolkit-section-title ui-toolkit-panel__title">{{ props.title }}</h2>

    <div v-if="isOpen" :class="props.contentClass">
      <slot />
    </div>
  </article>
</template>

<script setup lang="ts">
import { computed } from 'vue';

import UiButton from '@/components/ui/Button';
import type { ToolkitPanelProps } from './types';

const props = withDefaults(defineProps<ToolkitPanelProps>(), {
  modelValue: true,
  collapsible: true,
  headerMode: 'single',
  titleAriaLabel: '',
  toggleAriaLabel: '',
  contentClass: '',
  cardClass: ''
});

const emit = defineEmits<{
  'update:modelValue': [value: boolean];
  toggle: [value: boolean];
}>();

const isOpen = computed(() => (props.collapsible ? props.modelValue : true));
const toggleLabel = computed(() => props.toggleAriaLabel || props.titleAriaLabel || props.title);

function toggleOpen() {
  if (!props.collapsible) return;
  const next = !isOpen.value;
  emit('update:modelValue', next);
  emit('toggle', next);
}
</script>

<style scoped>
.ui-toolkit-panel__title {
  margin: 0;
}
</style>
