<template>
  <article class="ui-collapsible-panel" :class="{ 'ui-collapsible-panel--framed': props.framed }">
    <template v-if="props.collapsible">
      <div v-if="props.headerMode === 'split'" class="ui-collapsible-panel__header" :class="props.headerClass">
        <UiButton native-type="button" :preset="props.splitTitlePreset" @click="toggleOpen">
          <span class="ui-collapsible-panel__title" :class="props.titleClass">{{ props.title }}</span>
        </UiButton>
        <slot name="header-actions" />
        <UiButton native-type="button" :preset="props.splitTogglePreset" :aria-label="toggleLabel" @click="toggleOpen">
          <span
            class="ui-collapsible-panel__indicator material-symbols-outlined"
            :class="[props.indicatorClass, { 'is-open': isOpen }]">
            {{ props.toggleIcon }}
          </span>
        </UiButton>
      </div>
      <UiButton v-else native-type="button" :preset="props.singleHeaderPreset" @click="toggleOpen">
        <span class="ui-collapsible-panel__title" :class="props.titleClass">{{ props.title }}</span>
        <span
          class="ui-collapsible-panel__indicator material-symbols-outlined"
          :class="[props.indicatorClass, { 'is-open': isOpen }]">
          {{ props.toggleIcon }}
        </span>
      </UiButton>
    </template>
    <h2 v-else class="ui-collapsible-panel__title ui-collapsible-panel__title--static" :class="props.titleClass">
      {{ props.title }}
    </h2>

    <div v-if="isOpen" :class="props.contentClass">
      <slot />
    </div>
  </article>
</template>

<script setup lang="ts">
import { computed } from 'vue';

import UiButton from '@/components/ui/Button';
import {
  getNextCollapsiblePanelValue,
  resolveCollapsiblePanelOpenState,
  resolveCollapsiblePanelToggleLabel
} from './logic';
import { COLLAPSIBLE_PANEL_DEFAULTS } from './types';
import type { CollapsiblePanelProps, CollapsiblePanelSlots } from './types';

const props = withDefaults(defineProps<CollapsiblePanelProps>(), COLLAPSIBLE_PANEL_DEFAULTS);

const emit = defineEmits<{
  'update:modelValue': [value: boolean];
  toggle: [value: boolean];
}>();

defineSlots<CollapsiblePanelSlots>();

const isOpen = computed(() => resolveCollapsiblePanelOpenState(props.collapsible, props.modelValue));
const toggleLabel = computed(() =>
  resolveCollapsiblePanelToggleLabel(props.toggleAriaLabel, props.titleAriaLabel, props.title)
);

function toggleOpen() {
  if (!props.collapsible) return;
  const next = getNextCollapsiblePanelValue(isOpen.value);
  emit('update:modelValue', next);
  emit('toggle', next);
}
</script>

<style scoped>
.ui-collapsible-panel {
  display: grid;
  gap: 6px;
}

.ui-collapsible-panel--framed {
  padding: var(--ui-panel-padding, 10px);
  border-radius: var(--ui-panel-radius, 10px);
  border: var(--ui-panel-border, 1px solid rgba(255, 255, 255, 0.12));
  background: var(--ui-panel-bg, rgba(0, 0, 0, 0.24));
}

.ui-collapsible-panel__header {
  display: grid;
  grid-template-columns: 1fr auto auto;
  align-items: center;
  gap: 6px;
}

.ui-collapsible-panel__title {
  margin: 0;
}

.ui-collapsible-panel__title--static {
  font-size: 14px;
  font-weight: 600;
}

.ui-collapsible-panel__indicator {
  transition: transform 160ms ease;
}

.ui-collapsible-panel__indicator.is-open {
  transform: rotate(180deg);
}
</style>
