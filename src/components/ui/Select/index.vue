<template>
  <div
    ref="rootRef"
    class="ui-select"
    :class="[containerClass, attrClass]"
    :style="[containerStyle, attrStyle]"
    v-bind="forwardedAttrs">
    <button
      ref="triggerRef"
      type="button"
      class="ui-select-trigger"
      :disabled="props.disabled"
      :aria-label="props.ariaLabel"
      :aria-expanded="isOpen"
      :aria-haspopup="'listbox'"
      @click="toggleOpen">
      <span class="ui-select-trigger-text" :class="{ 'ui-select-trigger-text--placeholder': !hasSelection }">
        {{ summaryText }}
      </span>
      <span class="ui-select-icon material-symbols-outlined" aria-hidden="true">expand_more</span>
    </button>
  </div>

  <Teleport to="body">
    <div
      v-if="isOpen"
      ref="menuRef"
      class="ui-select-menu"
      :style="menuStyle"
      role="listbox"
      :aria-multiselectable="props.multiple ? 'true' : undefined">
      <button
        v-for="option in props.options"
        :key="String(option.value)"
        type="button"
        class="ui-select-option"
        :class="{
          'ui-select-option--selected': isSelected(option.value),
          'ui-select-option--disabled': option.disabled
        }"
        role="option"
        :aria-selected="isSelected(option.value)"
        :disabled="option.disabled"
        @click.stop="selectOption(option.value)">
        <span
          v-if="props.multiple"
          class="ui-select-option-box"
          :class="{ 'ui-select-option-box--checked': isSelected(option.value) }"
          aria-hidden="true">
          <span class="ui-select-option-check"></span>
        </span>
        <span class="ui-select-option-label">{{ option.label }}</span>
      </button>

      <div v-if="!props.options.length" class="ui-select-empty">
        {{ props.emptyText }}
      </div>
    </div>
  </Teleport>
</template>

<script setup lang="ts">
import { computed, ref, useAttrs } from 'vue';
import { useFloatingPanel } from '../shared/useFloatingPanel';
import type { SelectOption, SelectProps, SelectValue } from './types';

defineOptions({
  inheritAttrs: false
});

const props = withDefaults(defineProps<SelectProps>(), {
  placeholder: 'Select',
  disabled: false,
  multiple: false,
  emptyText: 'No options',
  maxSummaryItems: 2
});

const emit = defineEmits<{
  (e: 'update:modelValue', value: SelectValue | SelectValue[] | null): void;
  (e: 'change', value: SelectValue | SelectValue[] | null): void;
}>();
const attrs = useAttrs();

const rootRef = ref<HTMLElement | null>(null);
const triggerRef = ref<HTMLElement | null>(null);
const menuRef = ref<HTMLElement | null>(null);
const isOpen = ref(false);
const menuStyle = ref<Record<string, string>>({});

const selectedValues = computed<SelectValue[]>(() => {
  if (props.multiple) {
    return Array.isArray(props.modelValue) ? props.modelValue : [];
  }
  if (Array.isArray(props.modelValue) || props.modelValue == null) {
    return [];
  }
  return [props.modelValue];
});

const selectedSet = computed(() => new Set(selectedValues.value));

const selectedOptions = computed<SelectOption[]>(() => {
  if (!selectedValues.value.length) return [];
  return props.options.filter(option => selectedSet.value.has(option.value));
});

const hasSelection = computed(() => selectedOptions.value.length > 0);

const summaryText = computed(() => {
  if (!selectedOptions.value.length) return props.placeholder;
  if (!props.multiple) return selectedOptions.value[0]?.label ?? props.placeholder;

  const labels = selectedOptions.value.map(option => option.label);
  const max = Math.max(1, props.maxSummaryItems);
  if (labels.length <= max) return labels.join(' / ');
  return `${labels.slice(0, max).join(' / ')} +${labels.length - max}`;
});

const containerClass = computed(() => ({
  'ui-select--open': isOpen.value,
  'ui-select--disabled': props.disabled,
  'ui-select--multiple': props.multiple,
  'ui-select--selected': hasSelection.value
}));

const { closePanel, toggleOpen: toggleFloatingPanel } = useFloatingPanel({
  rootRef,
  triggerRef,
  panelRef: menuRef,
  isOpen,
  panelStyle: menuStyle,
  estimatedHeight: 220,
  widthMode: 'match'
});

const containerStyle = computed(() => {
  const width = props.width;
  if (width == null || width === '') {
    return null;
  }
  const value = typeof width === 'number' ? `${width}px` : String(width);
  return { width: value };
});

const attrClass = computed(() => attrs.class as string | string[] | Record<string, boolean> | undefined);
const attrStyle = computed(
  () => attrs.style as string | Record<string, string> | Array<string | Record<string, string>> | undefined
);

const forwardedAttrs = computed(() => {
  const rest = { ...attrs } as Record<string, unknown>;
  delete rest.class;
  delete rest.style;
  return rest;
});

function isSelected(value: SelectValue): boolean {
  return selectedSet.value.has(value);
}

function toggleOpen() {
  if (props.disabled) return;
  toggleFloatingPanel();
}

function selectOption(value: SelectValue) {
  if (props.disabled) return;

  if (props.multiple) {
    const next = [...selectedValues.value];
    const index = next.indexOf(value);
    if (index === -1) {
      next.push(value);
    } else {
      next.splice(index, 1);
    }
    emit('update:modelValue', next);
    emit('change', next);
    return;
  }

  emit('update:modelValue', value);
  emit('change', value);
  closePanel();
}
</script>

<style scoped>
.ui-select {
  position: relative;
  width: 100%;
  min-width: 0;
}

.ui-select-trigger {
  margin: 5px 0;
  line-height: 1;
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 6px;
  width: 100%;
  min-height: 30px;
  border-radius: 6px;
  border: 1px solid rgba(255, 255, 255, 0.2);
  background: linear-gradient(180deg, rgba(255, 255, 255, 0.06), rgba(0, 0, 0, 0.24));
  color: rgba(255, 255, 255, 0.92);
  padding: 5px 8px;
  font-size: 12px;
  text-align: left;
  cursor: pointer;
  transition: all 160ms ease;
}

.ui-select-trigger:hover:not(:disabled) {
  border-color: rgba(255, 255, 255, 0.3);
}

.ui-select--open .ui-select-trigger,
.ui-select-trigger:focus-visible {
  outline: none;
  border-color: rgba(0, 242, 255, 0.58);
  box-shadow: 0 0 0 2px rgba(0, 242, 255, 0.16);
}

.ui-select-trigger:disabled {
  opacity: 0.45;
  cursor: not-allowed;
}

.ui-select-trigger-text {
  flex: 1 1 auto;
  min-width: 0;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.ui-select-trigger-text--placeholder {
  color: rgba(255, 255, 255, 0.5);
}

.ui-select-icon {
  flex: 0 0 auto;
  font-size: 18px;
  color: rgba(0, 242, 255, 0.88);
  transition: transform 160ms ease;
}

.ui-select--open .ui-select-icon {
  transform: rotate(180deg);
}

.ui-select-menu {
  position: fixed;
  max-height: 220px;
  overflow: auto;
  z-index: 10050;
  border-radius: 8px;
  border: 1px solid rgba(255, 255, 255, 0.16);
  background: rgba(10, 14, 22, 0.96);
  backdrop-filter: blur(8px);
  box-shadow:
    0 8px 24px rgba(0, 0, 0, 0.35),
    0 0 0 1px rgba(255, 255, 255, 0.03) inset;
  padding: 4px;
  display: grid;
  gap: 2px;
}

.ui-select-option {
  display: flex;
  align-items: center;
  gap: 6px;
  width: 100%;
  min-height: 28px;
  border-radius: 6px;
  border: 1px solid transparent;
  background: transparent;
  color: rgba(255, 255, 255, 0.84);
  padding: 4px 6px;
  font-size: 12px;
  text-align: left;
  cursor: pointer;
  transition: all 140ms ease;
}

.ui-select-option:hover:not(:disabled) {
  border-color: rgba(255, 255, 255, 0.2);
  background: rgba(255, 255, 255, 0.06);
}

.ui-select-option--selected {
  border-color: rgba(0, 242, 255, 0.4);
  background: rgba(0, 242, 255, 0.12);
  color: rgba(0, 242, 255, 0.94);
}

.ui-select-option:disabled,
.ui-select-option--disabled {
  opacity: 0.45;
  cursor: not-allowed;
}

.ui-select-option-box {
  position: relative;
  width: 14px;
  height: 14px;
  border-radius: 3px;
  border: 1px solid rgba(255, 255, 255, 0.28);
  background: rgba(0, 0, 0, 0.24);
  flex-shrink: 0;
}

.ui-select-option-box--checked {
  border-color: rgba(0, 242, 255, 0.66);
  background: rgba(0, 242, 255, 0.2);
}

.ui-select-option-check {
  position: absolute;
  inset: 0;
  margin: auto;
  width: 8px;
  height: 5px;
  border-left: 1.5px solid rgba(0, 242, 255, 0.95);
  border-bottom: 1.5px solid rgba(0, 242, 255, 0.95);
  transform: rotate(-45deg) translateY(-1px);
  opacity: 0;
}

.ui-select-option-box--checked .ui-select-option-check {
  opacity: 1;
}

.ui-select-option-label {
  min-width: 0;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.ui-select-empty {
  min-height: 30px;
  border-radius: 6px;
  display: grid;
  align-items: center;
  padding: 0 8px;
  color: rgba(255, 255, 255, 0.52);
  font-size: 12px;
}
</style>
