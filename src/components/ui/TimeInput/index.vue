<template>
  <div ref="rootRef" class="ui-time-input" :class="containerClass">
    <button
      ref="triggerRef"
      type="button"
      class="ui-time-input-trigger"
      :disabled="props.disabled"
      :aria-label="triggerAriaLabel"
      :aria-expanded="isOpen"
      :aria-haspopup="'dialog'"
      @click="toggleOpen">
      <span class="ui-time-input-value">{{ normalizedValue }}</span>
      <span class="ui-time-input-icon material-symbols-outlined" aria-hidden="true">
        schedule
      </span>
    </button>
  </div>

  <Teleport to="body">
    <div
      v-if="isOpen"
      ref="panelRef"
      class="ui-time-input-panel"
      :style="panelStyle"
      role="dialog"
      :aria-label="t('ui.timeInput.panelAria')">
      <div ref="hourColumnRef" class="ui-time-input-column">
        <div class="ui-time-input-column-title">{{ t('ui.timeInput.hour') }}</div>
        <button
          v-for="hour in HOURS"
          :key="`h-${hour}`"
          type="button"
          class="ui-time-input-option"
          :class="{ 'ui-time-input-option--selected': hour === selectedHour }"
          :data-value="hour"
          @click="selectHour(hour)">
          {{ hour }}
        </button>
      </div>
      <div ref="minuteColumnRef" class="ui-time-input-column">
        <div class="ui-time-input-column-title">{{ t('ui.timeInput.minute') }}</div>
        <button
          v-for="minute in MINUTES"
          :key="`m-${minute}`"
          type="button"
          class="ui-time-input-option"
          :class="{ 'ui-time-input-option--selected': minute === selectedMinute }"
          :data-value="minute"
          @click="selectMinute(minute)">
          {{ minute }}
        </button>
      </div>
    </div>
  </Teleport>
</template>

<script setup lang="ts">
import { computed, nextTick, ref } from 'vue';
import { useI18n } from 'vue-i18n';
import { useFloatingPanel } from '../shared/useFloatingPanel';
import type { TimeInputProps } from './types';

const props = withDefaults(defineProps<TimeInputProps>(), {
  disabled: false
});

const emit = defineEmits<{
  (e: 'update:modelValue', value: string): void;
}>();
const { t } = useI18n();

const HOURS = Array.from({ length: 24 }, (_, index) => String(index).padStart(2, '0'));
const MINUTES = Array.from({ length: 60 }, (_, index) => String(index).padStart(2, '0'));

const rootRef = ref<HTMLElement | null>(null);
const triggerRef = ref<HTMLElement | null>(null);
const panelRef = ref<HTMLElement | null>(null);
const hourColumnRef = ref<HTMLElement | null>(null);
const minuteColumnRef = ref<HTMLElement | null>(null);
const isOpen = ref(false);
const panelStyle = ref<Record<string, string>>({});

const normalizedValue = computed(() => normalizeTime(props.modelValue));
const selectedHour = computed(() => normalizedValue.value.slice(0, 2));
const selectedMinute = computed(() => normalizedValue.value.slice(3, 5));
const triggerAriaLabel = computed(() => props.ariaLabel ?? t('ui.timeInput.triggerAria'));

const containerClass = computed(() => ({
  'ui-time-input--open': isOpen.value,
  'ui-time-input--disabled': props.disabled
}));

const { closePanel, toggleOpen: toggleFloatingPanel } = useFloatingPanel({
  rootRef,
  triggerRef,
  panelRef,
  isOpen,
  panelStyle,
  estimatedHeight: 220,
  minWidth: 156,
  widthMode: 'min',
  onAfterOpen: scrollSelectedIntoView
});

function normalizeTime(value: string): string {
  const matched = value.match(/^(\d{1,2}):(\d{1,2})$/);
  if (!matched) return '00:00';
  const hour = Number.parseInt(matched[1], 10);
  const minute = Number.parseInt(matched[2], 10);
  if (!Number.isFinite(hour) || !Number.isFinite(minute)) return '00:00';
  if (hour < 0 || hour > 23 || minute < 0 || minute > 59) return '00:00';
  return `${String(hour).padStart(2, '0')}:${String(minute).padStart(2, '0')}`;
}

function toggleOpen() {
  if (props.disabled) return;
  toggleFloatingPanel();
}

function selectHour(hour: string) {
  emit('update:modelValue', `${hour}:${selectedMinute.value}`);
  void nextTick(scrollSelectedIntoView);
}

function selectMinute(minute: string) {
  emit('update:modelValue', `${selectedHour.value}:${minute}`);
  closePanel();
}

function scrollSelectedIntoView() {
  const selectedHourOption = hourColumnRef.value?.querySelector<HTMLElement>(`[data-value="${selectedHour.value}"]`);
  const selectedMinuteOption = minuteColumnRef.value?.querySelector<HTMLElement>(`[data-value="${selectedMinute.value}"]`);
  selectedHourOption?.scrollIntoView({ block: 'center' });
  selectedMinuteOption?.scrollIntoView({ block: 'center' });
}
</script>

<style scoped>
.ui-time-input {
  position: relative;
  width: 100%;
  min-width: 76px;
}

.ui-time-input-trigger {
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
  -webkit-app-region: no-drag;
}

.ui-time-input-trigger:hover:not(:disabled) {
  border-color: rgba(255, 255, 255, 0.3);
}

.ui-time-input--open .ui-time-input-trigger,
.ui-time-input-trigger:focus-visible {
  outline: none;
  border-color: rgba(0, 242, 255, 0.58);
  box-shadow: 0 0 0 2px rgba(0, 242, 255, 0.16);
}

.ui-time-input-trigger:disabled {
  opacity: 0.45;
  cursor: not-allowed;
}

.ui-time-input-value {
  letter-spacing: 0.04em;
  font-variant-numeric: tabular-nums;
}

.ui-time-input-icon {
  font-size: 16px;
  color: rgba(0, 242, 255, 0.88);
}

.ui-time-input-panel {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 6px;
  max-height: 220px;
  overflow: hidden;
  z-index: 10050;
  border-radius: 8px;
  border: 1px solid rgba(255, 255, 255, 0.16);
  background: rgba(10, 14, 22, 0.96);
  backdrop-filter: blur(8px);
  box-shadow:
    0 8px 24px rgba(0, 0, 0, 0.35),
    0 0 0 1px rgba(255, 255, 255, 0.03) inset;
  padding: 6px;
}

.ui-time-input-column {
  display: grid;
  gap: 2px;
  max-height: 208px;
  overflow: auto;
  padding-right: 2px;
}

.ui-time-input-column-title {
  position: sticky;
  top: 0;
  z-index: 1;
  min-height: 20px;
  display: grid;
  align-items: center;
  padding: 0 6px;
  border-radius: 4px;
  background: rgba(5, 8, 14, 0.82);
  color: rgba(255, 255, 255, 0.56);
  font-size: 10px;
  letter-spacing: 0.08em;
}

.ui-time-input-option {
  width: 100%;
  min-height: 26px;
  border-radius: 6px;
  border: 1px solid transparent;
  background: transparent;
  color: rgba(255, 255, 255, 0.84);
  padding: 4px 6px;
  font-size: 12px;
  text-align: center;
  font-variant-numeric: tabular-nums;
  cursor: pointer;
  transition: all 140ms ease;
}

.ui-time-input-option:hover {
  border-color: rgba(255, 255, 255, 0.2);
  background: rgba(255, 255, 255, 0.06);
}

.ui-time-input-option--selected {
  border-color: rgba(0, 242, 255, 0.4);
  background: rgba(0, 242, 255, 0.12);
  color: rgba(0, 242, 255, 0.94);
}
</style>
