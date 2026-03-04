<template>
  <nav
    class="ui-nav-tabs"
    :aria-label="props.ariaLabel"
    role="tablist"
    :style="{ '--ui-nav-tabs-columns': String(columnCount) }">
    <button
      v-for="item in props.items"
      :key="item.id"
      type="button"
      class="ui-nav-tabs__item"
      role="tab"
      :aria-selected="isActive(item)"
      :tabindex="isActive(item) ? 0 : -1"
      :class="{ 'ui-nav-tabs__item--active': isActive(item) }"
      @click="handleItemClick(item.id)">
      <span class="ui-nav-tabs__icon material-symbols-outlined" :class="{ 'fill-1': isActive(item) }">
        {{ item.icon }}
      </span>
      <span class="ui-nav-tabs__label">{{ item.label }}</span>
    </button>
  </nav>
</template>

<script setup lang="ts">
import { computed, ref, watch } from 'vue';

import type { NavTabsProps } from './types';

const props = withDefaults(defineProps<NavTabsProps>(), {
  ariaLabel: 'Main navigation'
});

const emit = defineEmits<{
  (event: 'update:modelValue', value: string): void;
  (event: 'change', value: string): void;
}>();

const internalActiveId = ref(resolveInitialActiveId());
const activeId = computed(() => props.modelValue ?? internalActiveId.value);
const columnCount = computed(() => Math.max(props.items.length, 1));

watch(
  () => props.modelValue,
  nextValue => {
    if (nextValue !== undefined) {
      internalActiveId.value = nextValue;
    }
  },
  { immediate: true }
);

watch(
  () => props.items,
  items => {
    if (!items.some(item => item.id === activeId.value)) {
      internalActiveId.value = resolveInitialActiveId();
    }
  },
  { deep: true }
);

function resolveInitialActiveId() {
  const preferredItem = props.items.find(item => item.active) ?? props.items[0];
  return preferredItem?.id ?? '';
}

function isActive(item: NavTabsProps['items'][number]) {
  return activeId.value === item.id;
}

function handleItemClick(id: string) {
  if (props.modelValue === undefined) {
    internalActiveId.value = id;
  }
  emit('update:modelValue', id);
  emit('change', id);
}
</script>

<style scoped lang="css">
.ui-nav-tabs {
  --ui-nav-tabs-bg: transparent;
  /* --ui-nav-tabs-border: rgba(0, 242, 255, 0.2); */
  --ui-nav-tabs-text: rgba(219, 231, 242, 0.72);
  --ui-nav-tabs-active: #00f2ff;
  /* --ui-nav-tabs-shadow: 0 -8px 26px rgba(0, 0, 0, 0.34); */
  display: grid;
  grid-template-columns: repeat(var(--ui-nav-tabs-columns, 3), minmax(0, 1fr));
  gap: 0;
  margin-top: 10px;
  border-top: 1px solid var(--ui-nav-tabs-border);
  background: var(--ui-nav-tabs-bg);
  box-shadow: var(--ui-nav-tabs-shadow);
  margin: 8px 0;
}

.ui-nav-tabs__item {
  appearance: none;
  background: transparent;
  width: 100%;
  min-height: 56px;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 3px;
  color: var(--ui-nav-tabs-text);
  border-bottom: 2px solid transparent;
  border-left: 0;
  border-right: 0;
  border-top: 0;
  cursor: pointer;
}

.ui-nav-tabs__item--active {
  color: var(--ui-nav-tabs-active);
  border-bottom-color: var(--ui-nav-tabs-active);
}

.ui-nav-tabs__icon {
  font-size: 20px;
  line-height: 1;
}

.ui-nav-tabs__label {
  font-size: 13px;
  font-weight: 600;
  line-height: 1;
}
</style>
