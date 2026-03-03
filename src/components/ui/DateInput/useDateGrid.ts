import { computed, nextTick, type Ref } from 'vue';

export interface DateGridCell {
  iso: string;
  day: number;
  isCurrentMonth: boolean;
  selectable: boolean;
}

type ValueRef<T> = { value: T };

export interface UseDateGridOptions {
  locale: ValueRef<string>;
  weekStart: ValueRef<number>;
  viewMonth: Ref<Date>;
  focusedIso: Ref<string>;
  normalizedValue: ValueRef<string>;
  normalizedMin: ValueRef<string>;
  normalizedMax: ValueRef<string>;
  todayIso: ValueRef<string>;
  onSelectDate: (iso: string) => void;
  focusCell: (iso: string) => void;
}

export function useDateGrid(options: UseDateGridOptions) {
  const monthTitle = computed(() =>
    new Intl.DateTimeFormat(options.locale.value, { year: 'numeric', month: 'long' }).format(options.viewMonth.value)
  );

  const weekdayLabels = computed(() => {
    const base = new Date(Date.UTC(2024, 0, 7));
    return Array.from({ length: 7 }, (_, index) => {
      const day = new Date(base.getTime() + ((options.weekStart.value + index) % 7) * 24 * 60 * 60 * 1000);
      return new Intl.DateTimeFormat(options.locale.value, { weekday: 'short' }).format(day);
    });
  });

  const calendarCells = computed<DateGridCell[]>(() => {
    const first = startOfMonth(options.viewMonth.value);
    const startOffset = getWeekIndex(first, options.weekStart.value);
    const startDate = addDays(first, -startOffset);

    return Array.from({ length: 42 }, (_, index) => {
      const date = addDays(startDate, index);
      const iso = formatIsoDate(date);
      return {
        iso,
        day: date.getDate(),
        isCurrentMonth: date.getMonth() === first.getMonth() && date.getFullYear() === first.getFullYear(),
        selectable: isSelectableIso(iso, options.normalizedMin.value, options.normalizedMax.value)
      };
    });
  });

  function shiftMonth(offset: number) {
    const next = new Date(options.viewMonth.value);
    next.setMonth(next.getMonth() + offset, 1);
    options.viewMonth.value = startOfMonth(next);
    syncFocusMonth();
    void nextTick(() => options.focusCell(options.focusedIso.value));
  }

  function shiftYear(offset: number) {
    const next = new Date(options.viewMonth.value);
    next.setFullYear(next.getFullYear() + offset, next.getMonth(), 1);
    options.viewMonth.value = startOfMonth(next);
    syncFocusMonth();
    void nextTick(() => options.focusCell(options.focusedIso.value));
  }

  function syncViewMonthToValue() {
    const valueDate = parseIsoDate(options.normalizedValue.value);
    if (valueDate) {
      options.viewMonth.value = startOfMonth(valueDate);
    }
  }

  function getInitialFocusIso(): string {
    return ensureSelectableIso(
      options.normalizedValue.value || options.todayIso.value,
      1,
      options.normalizedMin.value,
      options.normalizedMax.value
    );
  }

  function onGridKeyDown(event: KeyboardEvent) {
    const current = parseIsoDate(options.focusedIso.value || getInitialFocusIso());
    if (!current) return;

    let nextDate: Date | null = null;
    if (event.key === 'ArrowLeft') nextDate = addDays(current, -1);
    if (event.key === 'ArrowRight') nextDate = addDays(current, 1);
    if (event.key === 'ArrowUp') nextDate = addDays(current, -7);
    if (event.key === 'ArrowDown') nextDate = addDays(current, 7);
    if (event.key === 'Home') nextDate = addDays(current, -getWeekIndex(current, options.weekStart.value));
    if (event.key === 'End') nextDate = addDays(current, 6 - getWeekIndex(current, options.weekStart.value));
    if (event.key === 'PageUp') nextDate = event.shiftKey ? addYears(current, -1) : addMonths(current, -1);
    if (event.key === 'PageDown') nextDate = event.shiftKey ? addYears(current, 1) : addMonths(current, 1);
    if (event.key === 'Enter' || event.key === ' ') {
      event.preventDefault();
      options.onSelectDate(
        ensureSelectableIso(
          options.focusedIso.value || formatIsoDate(current),
          1,
          options.normalizedMin.value,
          options.normalizedMax.value
        )
      );
      return;
    }
    if (!nextDate) return;

    event.preventDefault();
    options.focusedIso.value = ensureSelectableIso(
      formatIsoDate(nextDate),
      event.key === 'ArrowLeft' ? -1 : 1,
      options.normalizedMin.value,
      options.normalizedMax.value
    );
    options.viewMonth.value = startOfMonth(nextDate);
    void nextTick(() => options.focusCell(options.focusedIso.value));
  }

  function syncFocusMonth() {
    const currentFocused = parseIsoDate(options.focusedIso.value);
    if (!currentFocused) {
      options.focusedIso.value = ensureSelectableIso(
        formatIsoDate(options.viewMonth.value),
        1,
        options.normalizedMin.value,
        options.normalizedMax.value
      );
      return;
    }
    options.focusedIso.value = ensureSelectableIso(
      formatIsoDate(
        new Date(
          options.viewMonth.value.getFullYear(),
          options.viewMonth.value.getMonth(),
          Math.min(currentFocused.getDate(), daysInMonth(options.viewMonth.value))
        )
      ),
      1,
      options.normalizedMin.value,
      options.normalizedMax.value
    );
  }

  return {
    monthTitle,
    weekdayLabels,
    calendarCells,
    shiftMonth,
    shiftYear,
    syncViewMonthToValue,
    getInitialFocusIso,
    onGridKeyDown,
    ensureSelectableIso: (iso: string, preferredStep: number) =>
      ensureSelectableIso(iso, preferredStep, options.normalizedMin.value, options.normalizedMax.value),
    isSelectableIso: (iso: string) => isSelectableIso(iso, options.normalizedMin.value, options.normalizedMax.value)
  };
}

export function startOfMonth(date: Date): Date {
  return new Date(date.getFullYear(), date.getMonth(), 1);
}

export function normalizeIsoDate(value: string): string {
  if (!value) return '';
  const parsed = parseIsoDate(value);
  if (!parsed) return '';
  return formatIsoDate(parsed);
}

export function parseIsoDate(value: string): Date | null {
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

export function formatIsoDate(date: Date): string {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(
    2,
    '0'
  )}`;
}

function isSelectableIso(iso: string, normalizedMin: string, normalizedMax: string): boolean {
  if (!iso) return false;
  if (normalizedMin && iso < normalizedMin) return false;
  if (normalizedMax && iso > normalizedMax) return false;
  return true;
}

function ensureSelectableIso(iso: string, preferredStep: number, normalizedMin: string, normalizedMax: string): string {
  if (isSelectableIso(iso, normalizedMin, normalizedMax)) return iso;
  const source = parseIsoDate(iso) ?? new Date();
  let forward = new Date(source);
  let backward = new Date(source);

  for (let index = 0; index < 370; index += 1) {
    if (preferredStep >= 0) {
      forward = addDays(forward, 1);
      const forwardIso = formatIsoDate(forward);
      if (isSelectableIso(forwardIso, normalizedMin, normalizedMax)) return forwardIso;
      backward = addDays(backward, -1);
      const backwardIso = formatIsoDate(backward);
      if (isSelectableIso(backwardIso, normalizedMin, normalizedMax)) return backwardIso;
    } else {
      backward = addDays(backward, -1);
      const backwardIso = formatIsoDate(backward);
      if (isSelectableIso(backwardIso, normalizedMin, normalizedMax)) return backwardIso;
      forward = addDays(forward, 1);
      const forwardIso = formatIsoDate(forward);
      if (isSelectableIso(forwardIso, normalizedMin, normalizedMax)) return forwardIso;
    }
  }
  return iso;
}

function getWeekIndex(date: Date, weekStart: number): number {
  return (date.getDay() - weekStart + 7) % 7;
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
