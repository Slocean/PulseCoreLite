<template>
  <div ref="rootRef" class="ui-date-input" :class="containerClass">
    <button
      ref="triggerRef"
      type="button"
      class="ui-date-input-trigger"
      :disabled="props.disabled"
      :aria-label="triggerAriaLabel"
      :aria-expanded="isOpen"
      :aria-haspopup="'dialog'"
      @click="toggleOpen">
      <span class="ui-date-input-value">{{ displayValue }}</span>
      <span class="ui-date-input-icon material-symbols-outlined" aria-hidden="true">
        calendar_month
      </span>
    </button>
  </div>

  <Teleport to="body">
    <div
      v-if="isOpen"
      ref="panelRef"
      class="ui-date-input-panel"
      :style="panelStyle"
      role="dialog"
      :aria-label="t('ui.dateInput.panelAria')">
      <div class="ui-date-input-header">
        <button
          type="button"
          class="ui-date-input-nav"
          :aria-label="t('ui.dateInput.prevYear')"
          @click="shiftYear(-1)">
          <span class="material-symbols-outlined" aria-hidden="true">keyboard_double_arrow_left</span>
        </button>
        <button
          type="button"
          class="ui-date-input-nav"
          :aria-label="t('ui.dateInput.prevMonth')"
          @click="shiftMonth(-1)">
          <span class="material-symbols-outlined" aria-hidden="true">chevron_left</span>
        </button>
        <div class="ui-date-input-title">{{ monthTitle }}</div>
        <button
          type="button"
          class="ui-date-input-nav"
          :aria-label="t('ui.dateInput.nextMonth')"
          @click="shiftMonth(1)">
          <span class="material-symbols-outlined" aria-hidden="true">chevron_right</span>
        </button>
        <button
          type="button"
          class="ui-date-input-nav"
          :aria-label="t('ui.dateInput.nextYear')"
          @click="shiftYear(1)">
          <span class="material-symbols-outlined" aria-hidden="true">keyboard_double_arrow_right</span>
        </button>
      </div>

      <div class="ui-date-input-weekdays">
        <span v-for="weekday in weekdayLabels" :key="weekday" class="ui-date-input-weekday">
          {{ weekday }}
        </span>
      </div>

      <div class="ui-date-input-grid" role="grid" @keydown="onGridKeyDown">
        <button
          v-for="cell in calendarCells"
          :key="cell.iso"
          type="button"
          role="gridcell"
          class="ui-date-input-cell"
          :class="{
            'ui-date-input-cell--outside': !cell.isCurrentMonth,
            'ui-date-input-cell--selected': cell.iso === normalizedValue,
            'ui-date-input-cell--today': cell.iso === todayIso
          }"
          :data-iso="cell.iso"
          :aria-selected="cell.iso === normalizedValue"
          :tabindex="cell.iso === focusedIso ? 0 : -1"
          @focus="focusedIso = cell.iso"
          @click="selectDate(cell.iso)">
          {{ cell.day }}
        </button>
      </div>

      <div class="ui-date-input-footer">
        <button type="button" class="ui-date-input-action" @click="clearDate">
          {{ t('ui.dateInput.clear') }}
        </button>
        <button type="button" class="ui-date-input-action ui-date-input-action--primary" @click="pickToday">
          {{ t('ui.dateInput.today') }}
        </button>
      </div>
    </div>
  </Teleport>
</template>

<script setup lang="ts">
import { computed, nextTick, onBeforeUnmount, onMounted, ref, watch } from 'vue';
import { useI18n } from 'vue-i18n';
import type { DateInputProps } from './types';

const props = withDefaults(defineProps<DateInputProps>(), {
  disabled: false
});

const emit = defineEmits<{
  (e: 'update:modelValue', value: string): void;
}>();

const { t, locale } = useI18n();
const rootRef = ref<HTMLElement | null>(null);
const triggerRef = ref<HTMLElement | null>(null);
const panelRef = ref<HTMLElement | null>(null);
const isOpen = ref(false);
const panelStyle = ref<Record<string, string>>({});
const viewMonth = ref(startOfMonth(parseIsoDate(props.modelValue) ?? new Date()));
const focusedIso = ref('');

const normalizedValue = computed(() => normalizeIsoDate(props.modelValue));
const todayIso = computed(() => formatIsoDate(new Date()));
const triggerAriaLabel = computed(() => props.ariaLabel ?? t('ui.dateInput.triggerAria'));
const weekStart = computed(() => (locale.value.toLowerCase().startsWith('en-us') ? 0 : 1));

const displayValue = computed(() => {
  if (!normalizedValue.value) return t('ui.dateInput.placeholder');
  const date = parseIsoDate(normalizedValue.value);
  if (!date) return normalizedValue.value;
  return new Intl.DateTimeFormat(locale.value, { year: 'numeric', month: '2-digit', day: '2-digit' }).format(date);
});

const monthTitle = computed(() =>
  new Intl.DateTimeFormat(locale.value, { year: 'numeric', month: 'long' }).format(viewMonth.value)
);

const weekdayLabels = computed(() => {
  const base = new Date(Date.UTC(2024, 0, 7));
  return Array.from({ length: 7 }, (_, index) => {
    const day = new Date(base.getTime() + ((weekStart.value + index) % 7) * 24 * 60 * 60 * 1000);
    return new Intl.DateTimeFormat(locale.value, { weekday: 'short' }).format(day);
  });
});

const calendarCells = computed(() => {
  const first = startOfMonth(viewMonth.value);
  const startOffset = getWeekIndex(first);
  const startDate = new Date(first);
  startDate.setDate(first.getDate() - startOffset);

  return Array.from({ length: 42 }, (_, index) => {
    const date = new Date(startDate);
    date.setDate(startDate.getDate() + index);
    return {
      iso: formatIsoDate(date),
      day: date.getDate(),
      isCurrentMonth: date.getMonth() === first.getMonth() && date.getFullYear() === first.getFullYear()
    };
  });
});

const containerClass = computed(() => ({
  'ui-date-input--open': isOpen.value,
  'ui-date-input--disabled': props.disabled
}));

function toggleOpen() {
  if (props.disabled) return;
  isOpen.value = !isOpen.value;
  if (isOpen.value) {
    syncViewMonthToValue();
    focusedIso.value = getInitialFocusIso();
    void nextTick(() => {
      updatePanelPosition();
      focusCell(focusedIso.value);
    });
  }
}

function shiftMonth(offset: number) {
  const next = new Date(viewMonth.value);
  next.setMonth(next.getMonth() + offset, 1);
  viewMonth.value = startOfMonth(next);
  syncFocusMonth();
  void nextTick(() => focusCell(focusedIso.value));
}

function shiftYear(offset: number) {
  const next = new Date(viewMonth.value);
  next.setFullYear(next.getFullYear() + offset, next.getMonth(), 1);
  viewMonth.value = startOfMonth(next);
  syncFocusMonth();
  void nextTick(() => focusCell(focusedIso.value));
}

function selectDate(iso: string) {
  emit('update:modelValue', iso);
  isOpen.value = false;
}

function clearDate() {
  emit('update:modelValue', '');
  isOpen.value = false;
}

function pickToday() {
  emit('update:modelValue', todayIso.value);
  isOpen.value = false;
}

function syncViewMonthToValue() {
  const valueDate = parseIsoDate(normalizedValue.value);
  if (valueDate) {
    viewMonth.value = startOfMonth(valueDate);
  }
}

function getInitialFocusIso(): string {
  return normalizedValue.value || todayIso.value;
}

function onDocumentPointerDown(event: PointerEvent) {
  if (!isOpen.value) return;
  const target = event.target as Node | null;
  if (!target) return;
  if (rootRef.value?.contains(target)) return;
  if (panelRef.value?.contains(target)) return;
  isOpen.value = false;
}

function onDocumentKeyDown(event: KeyboardEvent) {
  if (event.key === 'Escape' && isOpen.value) {
    isOpen.value = false;
  }
}

function onGridKeyDown(event: KeyboardEvent) {
  if (!isOpen.value) return;
  const current = parseIsoDate(focusedIso.value || getInitialFocusIso());
  if (!current) return;

  let nextDate: Date | null = null;
  if (event.key === 'ArrowLeft') nextDate = addDays(current, -1);
  if (event.key === 'ArrowRight') nextDate = addDays(current, 1);
  if (event.key === 'ArrowUp') nextDate = addDays(current, -7);
  if (event.key === 'ArrowDown') nextDate = addDays(current, 7);
  if (event.key === 'Home') nextDate = addDays(current, -getWeekIndex(current));
  if (event.key === 'End') nextDate = addDays(current, 6 - getWeekIndex(current));
  if (event.key === 'PageUp') nextDate = event.shiftKey ? addYears(current, -1) : addMonths(current, -1);
  if (event.key === 'PageDown') nextDate = event.shiftKey ? addYears(current, 1) : addMonths(current, 1);
  if (event.key === 'Enter' || event.key === ' ') {
    event.preventDefault();
    selectDate(focusedIso.value || formatIsoDate(current));
    return;
  }
  if (!nextDate) return;

  event.preventDefault();
  focusedIso.value = formatIsoDate(nextDate);
  viewMonth.value = startOfMonth(nextDate);
  void nextTick(() => focusCell(focusedIso.value));
}

function updatePanelPosition() {
  if (!isOpen.value) return;
  const trigger = triggerRef.value;
  if (!trigger) return;
  const rect = trigger.getBoundingClientRect();
  const panelWidth = panelRef.value?.offsetWidth ?? Math.max(268, Math.round(rect.width));
  const panelHeight = panelRef.value?.offsetHeight ?? 292;
  const viewportWidth = window.innerWidth;
  const viewportHeight = window.innerHeight;
  let left = Math.round(rect.left);
  let top = Math.round(rect.bottom + 4);

  if (left + panelWidth > viewportWidth - 8) {
    left = Math.max(8, viewportWidth - panelWidth - 8);
  }
  if (top + panelHeight > viewportHeight - 8) {
    top = Math.max(8, Math.round(rect.top - panelHeight - 4));
  }

  panelStyle.value = {
    position: 'fixed',
    left: `${left}px`,
    top: `${top}px`,
    minWidth: `${Math.max(268, Math.round(rect.width))}px`
  };
}

onMounted(() => {
  document.addEventListener('pointerdown', onDocumentPointerDown);
  document.addEventListener('keydown', onDocumentKeyDown);
  window.addEventListener('resize', updatePanelPosition);
  window.addEventListener('scroll', updatePanelPosition, true);
});

onBeforeUnmount(() => {
  document.removeEventListener('pointerdown', onDocumentPointerDown);
  document.removeEventListener('keydown', onDocumentKeyDown);
  window.removeEventListener('resize', updatePanelPosition);
  window.removeEventListener('scroll', updatePanelPosition, true);
});

watch(
  () => props.modelValue,
  () => {
    if (!isOpen.value) return;
    syncViewMonthToValue();
    focusedIso.value = normalizedValue.value || todayIso.value;
    void nextTick(() => focusCell(focusedIso.value));
  }
);

watch(isOpen, open => {
  if (!open) return;
  void nextTick(() => {
    updatePanelPosition();
    focusCell(focusedIso.value || getInitialFocusIso());
  });
});

function getWeekIndex(date: Date): number {
  return (date.getDay() - weekStart.value + 7) % 7;
}

function startOfMonth(date: Date): Date {
  return new Date(date.getFullYear(), date.getMonth(), 1);
}

function normalizeIsoDate(value: string): string {
  if (!value) return '';
  const parsed = parseIsoDate(value);
  if (!parsed) return '';
  return formatIsoDate(parsed);
}

function parseIsoDate(value: string): Date | null {
  const match = value.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (!match) return null;
  const year = Number.parseInt(match[1], 10);
  const month = Number.parseInt(match[2], 10);
  const day = Number.parseInt(match[3], 10);
  if (!Number.isFinite(year) || !Number.isFinite(month) || !Number.isFinite(day)) return null;
  const date = new Date(year, month - 1, day);
  if (date.getFullYear() !== year || date.getMonth() !== month - 1 || date.getDate() !== day) return null;
  return date;
}

function formatIsoDate(date: Date): string {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(
    2,
    '0'
  )}`;
}

function addDays(date: Date, days: number): Date {
  const next = new Date(date);
  next.setDate(date.getDate() + days);
  return next;
}

function addMonths(date: Date, months: number): Date {
  const next = new Date(date.getFullYear(), date.getMonth() + months, 1);
  const day = Math.min(date.getDate(), daysInMonth(next));
  next.setDate(day);
  return next;
}

function addYears(date: Date, years: number): Date {
  return addMonths(date, years * 12);
}

function daysInMonth(date: Date): number {
  return new Date(date.getFullYear(), date.getMonth() + 1, 0).getDate();
}

function syncFocusMonth() {
  const currentFocused = parseIsoDate(focusedIso.value);
  if (!currentFocused) {
    focusedIso.value = formatIsoDate(viewMonth.value);
    return;
  }
  focusedIso.value = formatIsoDate(
    new Date(
      viewMonth.value.getFullYear(),
      viewMonth.value.getMonth(),
      Math.min(currentFocused.getDate(), daysInMonth(viewMonth.value))
    )
  );
}

function focusCell(iso: string) {
  const cell = panelRef.value?.querySelector<HTMLButtonElement>(`button[data-iso="${iso}"]`);
  cell?.focus();
}
</script>

<style scoped>
.ui-date-input {
  position: relative;
  width: 100%;
  min-width: 132px;
}

.ui-date-input-trigger {
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

.ui-date-input-trigger:hover:not(:disabled) {
  border-color: rgba(255, 255, 255, 0.3);
}

.ui-date-input--open .ui-date-input-trigger,
.ui-date-input-trigger:focus-visible {
  outline: none;
  border-color: rgba(0, 242, 255, 0.58);
  box-shadow: 0 0 0 2px rgba(0, 242, 255, 0.16);
}

.ui-date-input-trigger:disabled {
  opacity: 0.45;
  cursor: not-allowed;
}

.ui-date-input-value {
  min-width: 0;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  font-variant-numeric: tabular-nums;
}

.ui-date-input-icon {
  font-size: 16px;
  color: rgba(0, 242, 255, 0.88);
}

.ui-date-input-panel {
  z-index: 10050;
  border-radius: 8px;
  border: 1px solid rgba(255, 255, 255, 0.16);
  background: rgba(10, 14, 22, 0.96);
  backdrop-filter: blur(8px);
  box-shadow:
    0 8px 24px rgba(0, 0, 0, 0.35),
    0 0 0 1px rgba(255, 255, 255, 0.03) inset;
  padding: 8px;
  display: grid;
  gap: 7px;
}

.ui-date-input-header {
  display: grid;
  grid-template-columns: 24px 24px 1fr 24px 24px;
  align-items: center;
  gap: 4px;
  padding: 2px;
  border-radius: 6px;
  background: rgba(255, 255, 255, 0.03);
}

.ui-date-input-title {
  text-align: center;
  font-size: 11px;
  color: rgba(255, 255, 255, 0.9);
  letter-spacing: 0.06em;
  text-transform: uppercase;
}

.ui-date-input-nav {
  width: 24px;
  height: 22px;
  border-radius: 6px;
  border: 1px solid transparent;
  background: transparent;
  color: rgba(255, 255, 255, 0.78);
  cursor: pointer;
  display: grid;
  place-items: center;
  transition: all 140ms ease;
}

.ui-date-input-nav:hover {
  border-color: rgba(255, 255, 255, 0.2);
  background: rgba(255, 255, 255, 0.06);
}

.ui-date-input-nav .material-symbols-outlined {
  font-size: 14px;
}

.ui-date-input-weekdays {
  display: grid;
  grid-template-columns: repeat(7, minmax(0, 1fr));
  gap: 2px;
}

.ui-date-input-weekday {
  min-height: 18px;
  display: grid;
  place-items: center;
  font-size: 9px;
  color: rgba(255, 255, 255, 0.58);
  letter-spacing: 0.09em;
  text-transform: uppercase;
}

.ui-date-input-grid {
  display: grid;
  grid-template-columns: repeat(7, minmax(0, 1fr));
  gap: 2px;
}

.ui-date-input-cell {
  min-height: 27px;
  border-radius: 6px;
  border: 1px solid transparent;
  background: transparent;
  color: rgba(255, 255, 255, 0.88);
  cursor: pointer;
  font-size: 12px;
  font-variant-numeric: tabular-nums;
  transition: all 140ms ease;
}

.ui-date-input-cell:hover {
  border-color: rgba(255, 255, 255, 0.2);
  background: rgba(255, 255, 255, 0.06);
}

.ui-date-input-cell:focus-visible {
  outline: none;
  border-color: rgba(0, 242, 255, 0.6);
  box-shadow: 0 0 0 1px rgba(0, 242, 255, 0.22);
}

.ui-date-input-cell--outside {
  color: rgba(255, 255, 255, 0.42);
}

.ui-date-input-cell--today {
  border-color: rgba(0, 242, 255, 0.32);
}

.ui-date-input-cell--selected {
  border-color: rgba(0, 242, 255, 0.4);
  background: rgba(0, 242, 255, 0.12);
  color: rgba(0, 242, 255, 0.94);
}

.ui-date-input-footer {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 8px;
  padding-top: 2px;
  border-top: 1px solid rgba(255, 255, 255, 0.08);
}

.ui-date-input-action {
  min-height: 24px;
  border-radius: 6px;
  border: 1px solid transparent;
  background: transparent;
  color: rgba(255, 255, 255, 0.68);
  font-size: 11px;
  padding: 0 8px;
  cursor: pointer;
  transition: all 140ms ease;
}

.ui-date-input-action:hover {
  border-color: rgba(255, 255, 255, 0.2);
  background: rgba(255, 255, 255, 0.06);
}

.ui-date-input-action--primary {
  color: rgba(0, 242, 255, 0.94);
}
</style>
