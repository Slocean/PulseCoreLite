<template>
  <nav class="ui-nav-tabs" :aria-label="props.ariaLabel">
    <div
      v-for="item in props.items"
      :key="item.id"
      class="ui-nav-tabs__item"
      :class="{ 'ui-nav-tabs__item--active': item.active }">
      <span class="ui-nav-tabs__icon material-symbols-outlined" :class="{ 'fill-1': item.active }">
        {{ item.icon }}
      </span>
      <span class="ui-nav-tabs__label">{{ item.label }}</span>
    </div>
  </nav>
</template>

<script setup lang="ts">
import type { NavTabsProps } from './types';

const props = withDefaults(defineProps<NavTabsProps>(), {
  ariaLabel: 'Main navigation'
});
</script>

<style scoped lang="css">
.ui-nav-tabs {
  --ui-nav-tabs-bg: linear-gradient(180deg, rgba(6, 13, 21, 0.95), rgba(3, 9, 15, 0.95));
  --ui-nav-tabs-border: rgba(0, 242, 255, 0.2);
  --ui-nav-tabs-text: rgba(219, 231, 242, 0.72);
  --ui-nav-tabs-active: #00f2ff;
  --ui-nav-tabs-shadow: 0 -8px 26px rgba(0, 0, 0, 0.34);
  display: grid;
  grid-template-columns: repeat(3, minmax(0, 1fr));
  gap: 0;
  margin-top: 10px;
  border-top: 1px solid var(--ui-nav-tabs-border);
  background: var(--ui-nav-tabs-bg);
  box-shadow: var(--ui-nav-tabs-shadow);
}

.ui-nav-tabs__item {
  min-height: 56px;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 3px;
  color: var(--ui-nav-tabs-text);
  border-bottom: 2px solid transparent;
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
