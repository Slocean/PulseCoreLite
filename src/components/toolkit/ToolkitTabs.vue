<template>
  <nav class="toolkit-tabs" :aria-label="ariaLabel" role="tablist">
    <UiButton
      v-for="(tab, index) in tabs"
      :key="tab.id"
      :ref="element => setTabRef(element, index)"
      native-type="button"
      preset="toolkit-tab"
      role="tab"
      :tabindex="tabIndexAt(index)"
      :aria-selected="String(modelValue === tab.id)"
      :active="modelValue === tab.id"
      @click="setActive(tab.id)"
      @keydown="onTabKeydown($event, index)">
      {{ tab.label }}
    </UiButton>
  </nav>
</template>

<script setup lang="ts">
import { nextTick, ref } from 'vue';
import type { ComponentPublicInstance } from 'vue';

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

const tabRefs = ref<Array<HTMLElement | null>>([]);

function tabIndexAt(index: number) {
  const activeIndex = props.tabs.findIndex(tab => tab.id === props.modelValue);
  if (activeIndex === -1) {
    return index === 0 ? 0 : -1;
  }
  return index === activeIndex ? 0 : -1;
}

function setTabRef(target: Element | ComponentPublicInstance | null, index: number) {
  if (!target) {
    tabRefs.value[index] = null;
    return;
  }
  let element: Element | null = null;
  if (target instanceof HTMLElement) {
    element = target;
  } else if (target && '$el' in target) {
    element = (target as ComponentPublicInstance).$el as Element | null;
  }
  tabRefs.value[index] = element instanceof HTMLElement ? element : null;
}

function focusTab(index: number) {
  const tab = props.tabs[index];
  if (!tab) return;
  setActive(tab.id);
  void nextTick(() => {
    tabRefs.value[index]?.focus();
  });
}

function onTabKeydown(event: KeyboardEvent, index: number) {
  if (!props.tabs.length) return;
  const lastIndex = props.tabs.length - 1;
  if (event.key === 'ArrowRight' || event.key === 'ArrowDown') {
    event.preventDefault();
    focusTab(index >= lastIndex ? 0 : index + 1);
    return;
  }
  if (event.key === 'ArrowLeft' || event.key === 'ArrowUp') {
    event.preventDefault();
    focusTab(index <= 0 ? lastIndex : index - 1);
    return;
  }
  if (event.key === 'Home') {
    event.preventDefault();
    focusTab(0);
    return;
  }
  if (event.key === 'End') {
    event.preventDefault();
    focusTab(lastIndex);
  }
}
</script>
