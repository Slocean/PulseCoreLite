import { computed, nextTick, onMounted, reactive, ref, watch } from 'vue';
import { useToastService } from '@/composables/useToastService';
import { useI18n } from 'vue-i18n';

import type { SelectOption } from '@/components/ui/Select/types';
import { useTaskReminders } from '@/composables/useTaskReminders';
import { storageKeys, storageRepository } from '@/services/storageRepository';
import type {
  MonthlyReminderSlot,
  ReminderAdvancedSettings,
  SmtpEmailConfig,
  TaskReminder,
  WeeklyReminderSlot
} from '@/types';

type ReminderTabEmit = (event: 'contentChange') => void;

export function useReminderTabState(emit: ReminderTabEmit) {
  const { t } = useI18n();
  const { showToast, hideToast } = useToastService('toolkit');
  const {
    reminders,
    smtpConfig,
    reminderCount,
    enabledCount,
    load,
    upsertReminder,
    removeReminder,
    toggleReminderEnabled,
    runReminderNow,
    saveSmtpConfig,
    testSmtpConfig,
    formatWeekday
  } = useTaskReminders();

  const viewMode = ref<'list' | 'form'>('list');
  const editingId = ref<string | null>(null);
  const smtpDialogOpen = ref(false);
  const statusMessage = ref('');
  const errorMessage = ref('');
  const allowCloseWarningOpen = ref(false);
  const smtpTestSending = ref(false);
  const allowCloseWarningDismissed = ref(false);
  const sections = reactive({
    task: false,
    schedule: false,
    content: false,
    list: true,
    advanced: false
  });

  const form = reactive({
    id: '',
    enabled: true,
    title: '',
    channel: 'fullscreen' as 'email' | 'fullscreen',
    email: '',
    dailyTimes: [] as string[],
    weeklySlots: [] as WeeklyReminderSlot[],
    monthlySlots: [] as MonthlyReminderSlot[],
    contentType: 'text' as 'text' | 'markdown' | 'web' | 'image',
    content: ''
  });

  const dailyInputTime = ref('09:00');
  const weeklyInputDays = ref<number[]>([1]);
  const weeklyInputTime = ref('09:00');
  const monthlyInputDays = ref<number[]>([new Date().getDate()]);
  const monthlyInputTime = ref('09:00');
  const smtpTestTo = ref('');
  const smtpForm = reactive<SmtpEmailConfig>({
    host: '',
    port: 587,
    username: '',
    password: '',
    fromEmail: '',
    fromName: '',
    security: 'starttls'
  });

  const defaultAdvancedSettings = (): ReminderAdvancedSettings => ({
    backgroundType: 'image',
    backgroundImage: '',
    backgroundColor: '#000000',
    allowClose: true,
    blockAllKeys: false,
    requireClosePassword: false,
    closePassword: ''
  });

  const advancedSettings = reactive<ReminderAdvancedSettings>(defaultAdvancedSettings());
  let allowCloseBaseline = advancedSettings.allowClose;

  const weekdayOptions = computed<SelectOption[]>(() => [
    { value: 1, label: t('toolkit.weekdayMon') },
    { value: 2, label: t('toolkit.weekdayTue') },
    { value: 3, label: t('toolkit.weekdayWed') },
    { value: 4, label: t('toolkit.weekdayThu') },
    { value: 5, label: t('toolkit.weekdayFri') },
    { value: 6, label: t('toolkit.weekdaySat') },
    { value: 7, label: t('toolkit.weekdaySun') }
  ]);

  const channelOptions = computed<SelectOption[]>(() => [
    { value: 'email', label: t('toolkit.reminderChannelEmail') },
    { value: 'fullscreen', label: t('toolkit.reminderChannelFullscreen') }
  ]);

  const contentTypeOptions = computed<SelectOption[]>(() => [
    { value: 'text', label: t('toolkit.reminderContentText') },
    { value: 'markdown', label: t('toolkit.reminderContentMarkdown') },
    { value: 'web', label: t('toolkit.reminderContentWeb') },
    { value: 'image', label: t('toolkit.reminderContentImage') }
  ]);

  const advancedBackgroundOptions = computed<SelectOption[]>(() => [
    { value: 'image', label: t('toolkit.reminderAdvancedImage') },
    { value: 'color', label: t('toolkit.reminderAdvancedColor') }
  ]);

  const advancedBackgroundTypeModel = computed<'image' | 'color'>({
    get: () => (advancedSettings.backgroundType || 'image') as 'image' | 'color',
    set: value => {
      if (value === advancedSettings.backgroundType) return;
      advancedSettings.backgroundType = value;
      if (value === 'image') {
        advancedSettings.backgroundColor = '';
        return;
      }
      advancedSettings.backgroundImage = '';
    }
  });

  const smtpSecurityOptions = computed<SelectOption[]>(() => [
    { value: 'none', label: t('toolkit.reminderSmtpSecurityNone') },
    { value: 'starttls', label: t('toolkit.reminderSmtpSecurityStarttls') },
    { value: 'tls', label: t('toolkit.reminderSmtpSecurityTls') }
  ]);

  const reminderListTitle = computed(() => {
    const summary = t('toolkit.reminderSummary', { total: reminderCount.value, enabled: enabledCount.value });
    return `${t('toolkit.reminderTitle')} · ${summary}`;
  });

  const monthlyDayOptions = computed<SelectOption[]>(() =>
    Array.from({ length: 31 }, (_, index) => {
      const day = index + 1;
      return {
        value: day,
        label: t('toolkit.reminderDayOfMonth', { day })
      };
    })
  );

  watch(
    [reminders, statusMessage, errorMessage, sections, advancedSettings, viewMode],
    () => {
      nextTick(() => emit('contentChange'));
    },
    { deep: true, immediate: true }
  );

  watch(
    () => advancedSettings.allowClose,
    value => {
      if (value) return;
      advancedSettings.requireClosePassword = false;
      advancedSettings.closePassword = '';
    }
  );

  onMounted(async () => {
    allowCloseWarningDismissed.value =
      storageRepository.getStringSync(storageKeys.reminderAllowCloseWarningDismissed) === '1';
    await load();
    if (smtpConfig.value) {
      Object.assign(smtpForm, smtpConfig.value);
      smtpTestTo.value = smtpConfig.value.fromEmail ?? '';
    }
    nextTick(() => emit('contentChange'));
  });

  function clearTip() {
    statusMessage.value = '';
    errorMessage.value = '';
  }

  function formatErrorMessage(error: unknown, fallbackKey: string) {
    if (typeof error === 'string') {
      const message = error.trim();
      return message || t(fallbackKey);
    }
    if (error instanceof Error) {
      const message = error.message.trim();
      if (message.startsWith('toolkit.')) {
        return t(message);
      }
      if (message) {
        return message;
      }
    }
    if (error && typeof error === 'object') {
      const record = error as Record<string, unknown>;
      for (const key of ['message', 'msg', 'error', 'cause']) {
        const value = record[key];
        if (typeof value === 'string' && value.trim()) {
          return value.trim();
        }
      }
    }
    return t(fallbackKey);
  }

  const makeRefUpdater =
    <T>(target: { value: T }) =>
    (value: T) => {
      target.value = value;
    };

  const updateDailyInputTime = makeRefUpdater(dailyInputTime);
  const updateWeeklyInputDays = makeRefUpdater(weeklyInputDays);
  const updateWeeklyInputTime = makeRefUpdater(weeklyInputTime);
  const updateMonthlyInputDays = makeRefUpdater(monthlyInputDays);
  const updateMonthlyInputTime = makeRefUpdater(monthlyInputTime);
  const updateSmtpTestTo = makeRefUpdater(smtpTestTo);

  async function processImageFile(
    file: File,
    errorKeys: { canvas: string; encode: string; read: string }
  ) {
    const bitmap = await createImageBitmap(file);
    const maxSize = 1920;
    const scale = Math.min(1, maxSize / Math.max(bitmap.width, bitmap.height));
    const canvas = document.createElement('canvas');
    canvas.width = Math.max(1, Math.round(bitmap.width * scale));
    canvas.height = Math.max(1, Math.round(bitmap.height * scale));
    const ctx = canvas.getContext('2d');
    if (!ctx) {
      throw new Error(errorKeys.canvas);
    }
    ctx.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
    const blob =
      (await new Promise<Blob | null>(resolve => canvas.toBlob(resolve, 'image/webp', 0.86))) ||
      (await new Promise<Blob | null>(resolve => canvas.toBlob(resolve, 'image/png')));
    if (!blob) {
      throw new Error(errorKeys.encode);
    }
    return await new Promise<string>((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(String(reader.result || ''));
      reader.onerror = () => reject(new Error(errorKeys.read));
      reader.readAsDataURL(blob);
    });
  }

  function closeAllowCloseWarning() {
    allowCloseWarningOpen.value = false;
  }

  function dismissAllowCloseWarning() {
    allowCloseWarningDismissed.value = true;
    storageRepository.setStringSync(storageKeys.reminderAllowCloseWarningDismissed, '1');
    allowCloseWarningOpen.value = false;
  }

  function maybeOpenAllowCloseWarning() {
    if (allowCloseWarningDismissed.value) {
      return;
    }
    if (form.channel !== 'fullscreen') {
      return;
    }
    if (!advancedSettings.allowClose && allowCloseBaseline) {
      allowCloseWarningOpen.value = true;
    }
  }

  async function handleAdvancedImageChange(event: Event) {
    const input = event.target as HTMLInputElement | null;
    const file = input?.files?.[0];
    if (!file) {
      return;
    }
    if (!file.type.startsWith('image/')) {
      errorMessage.value = t('toolkit.reminderAdvancedUploadInvalid');
      return;
    }
    try {
      clearTip();
      const dataUrl = await processImageFile(file, {
        canvas: 'toolkit.reminderAdvancedUploadCanvasFailed',
        encode: 'toolkit.reminderAdvancedUploadEncodeFailed',
        read: 'toolkit.reminderAdvancedUploadReadFailed'
      });
      advancedSettings.backgroundImage = dataUrl;
      statusMessage.value = t('toolkit.reminderAdvancedUploadSuccess');
    } catch (error) {
      errorMessage.value = formatErrorMessage(error, 'toolkit.reminderAdvancedUploadFailed');
    } finally {
      if (input) {
        input.value = '';
      }
    }
  }

  async function handleContentImageChange(event: Event) {
    const input = event.target as HTMLInputElement | null;
    const file = input?.files?.[0];
    if (!file) {
      return;
    }
    if (!file.type.startsWith('image/')) {
      errorMessage.value = t('toolkit.reminderContentUploadInvalid');
      return;
    }
    try {
      clearTip();
      const dataUrl = await processImageFile(file, {
        canvas: 'toolkit.reminderContentUploadCanvasFailed',
        encode: 'toolkit.reminderContentUploadEncodeFailed',
        read: 'toolkit.reminderContentUploadReadFailed'
      });
      form.content = dataUrl;
      statusMessage.value = t('toolkit.reminderContentUploadSuccess');
    } catch (error) {
      errorMessage.value = formatErrorMessage(error, 'toolkit.reminderContentUploadFailed');
    } finally {
      if (input) {
        input.value = '';
      }
    }
  }

  function addDailyTime() {
    clearTip();
    if (!dailyInputTime.value || form.dailyTimes.includes(dailyInputTime.value)) {
      return;
    }
    form.dailyTimes.push(dailyInputTime.value);
    form.dailyTimes.sort();
  }

  function removeDailyTime(time: string) {
    form.dailyTimes = form.dailyTimes.filter(item => item !== time);
  }

  function normalizeDays(values: number[]) {
    return [...new Set(values)]
      .map(value => Math.round(value))
      .filter(value => value >= 1 && value <= 7)
      .sort((a, b) => a - b);
  }

  function normalizeMonthDays(values: number[]) {
    return [...new Set(values)]
      .map(value => Math.round(value))
      .filter(value => value >= 1 && value <= 31)
      .sort((a, b) => a - b);
  }

  function addWeeklySlot() {
    clearTip();
    if (!weeklyInputTime.value) return;
    const days = normalizeDays(weeklyInputDays.value);
    if (!days.length) return;

    let changed = false;
    for (const weekday of days) {
      if (form.weeklySlots.some(item => item.weekday === weekday && item.time === weeklyInputTime.value)) {
        continue;
      }
      form.weeklySlots.push({ weekday, time: weeklyInputTime.value });
      changed = true;
    }
    if (!changed) return;
    form.weeklySlots.sort((a, b) =>
      a.weekday === b.weekday ? a.time.localeCompare(b.time) : a.weekday - b.weekday
    );
  }

  function removeWeeklySlot(weekday: number, time: string) {
    form.weeklySlots = form.weeklySlots.filter(item => !(item.weekday === weekday && item.time === time));
  }

  function addMonthlySlot() {
    clearTip();
    if (!monthlyInputTime.value) return;
    const days = normalizeMonthDays(monthlyInputDays.value);
    if (!days.length) return;

    let changed = false;
    for (const day of days) {
      if (form.monthlySlots.some(item => item.day === day && item.time === monthlyInputTime.value)) {
        continue;
      }
      form.monthlySlots.push({ day, time: monthlyInputTime.value });
      changed = true;
    }
    if (!changed) return;

    form.monthlySlots.sort((a, b) => (a.day === b.day ? a.time.localeCompare(b.time) : a.day - b.day));
  }

  function removeMonthlySlot(day: number, time: string) {
    form.monthlySlots = form.monthlySlots.filter(item => !(item.day === day && item.time === time));
  }

  function applyReminderToForm(item?: TaskReminder) {
    if (!item) {
      form.id = '';
      form.enabled = true;
      form.title = '';
      form.channel = 'fullscreen';
      form.email = '';
      form.dailyTimes = [];
      form.weeklySlots = [];
      form.monthlySlots = [];
      form.contentType = 'text';
      form.content = '';
      Object.assign(advancedSettings, defaultAdvancedSettings());
      allowCloseBaseline = advancedSettings.allowClose;
      weeklyInputDays.value = [1];
      monthlyInputDays.value = [new Date().getDate()];
      return;
    }
    form.id = item.id;
    form.enabled = item.enabled;
    form.title = item.title;
    form.channel = item.channel;
    form.email = item.email;
    form.dailyTimes = [...item.dailyTimes];
    form.weeklySlots = [...item.weeklySlots];
    form.monthlySlots = [...item.monthlySlots];
    form.contentType = item.contentType;
    form.content = item.content;
    Object.assign(advancedSettings, item.advancedSettings ?? defaultAdvancedSettings());
    allowCloseBaseline = advancedSettings.allowClose;
    weeklyInputDays.value = normalizeDays(item.weeklySlots.map(slot => slot.weekday));
    if (!weeklyInputDays.value.length) weeklyInputDays.value = [1];
    monthlyInputDays.value = normalizeMonthDays(item.monthlySlots.map(slot => slot.day));
    if (!monthlyInputDays.value.length) monthlyInputDays.value = [new Date().getDate()];
  }

  function resetForm() {
    clearTip();
    editingId.value = null;
    applyReminderToForm();
  }

  function showListView() {
    viewMode.value = 'list';
    sections.list = true;
    sections.task = false;
    sections.schedule = false;
    sections.content = false;
    sections.advanced = false;
  }

  function showEditorView() {
    viewMode.value = 'form';
    sections.task = true;
    sections.schedule = true;
    sections.content = true;
  }

  function startCreateReminder() {
    clearTip();
    editingId.value = null;
    applyReminderToForm();
    showEditorView();
  }

  function returnToList() {
    resetForm();
    showListView();
  }

  function openSmtpDialog() {
    clearTip();
    if (smtpConfig.value) {
      Object.assign(smtpForm, smtpConfig.value);
      smtpTestTo.value = smtpTestTo.value || smtpConfig.value.fromEmail || '';
    }
    smtpDialogOpen.value = true;
  }

  async function saveSmtpSettings() {
    clearTip();
    try {
      await saveSmtpConfig({ ...smtpForm });
      smtpTestTo.value = smtpTestTo.value || smtpForm.fromEmail || '';
      statusMessage.value = t('toolkit.reminderSmtpSaveSuccess');
    } catch (error) {
      errorMessage.value = formatErrorMessage(error, 'toolkit.reminderSmtpSaveFailed');
    }
  }

  async function sendSmtpTestEmail() {
    clearTip();
    smtpTestSending.value = true;
    showToast(t('toolkit.reminderSmtpTesting'), { durationMs: 0 });
    try {
      await testSmtpConfig({ ...smtpForm }, smtpTestTo.value);
      hideToast();
      statusMessage.value = t('toolkit.reminderSmtpTestSuccess');
    } catch (error) {
      hideToast();
      errorMessage.value = formatErrorMessage(error, 'toolkit.reminderSmtpTestFailed');
    } finally {
      smtpTestSending.value = false;
    }
  }

  async function saveReminder() {
    clearTip();
    try {
      const payload: TaskReminder = {
        id: editingId.value ?? '',
        enabled: form.enabled,
        title: form.title,
        channel: form.channel,
        email: form.email,
        dailyTimes: [...form.dailyTimes],
        weeklySlots: [...form.weeklySlots],
        monthlySlots: [...form.monthlySlots],
        contentType: form.contentType,
        content: form.content,
        advancedSettings: { ...advancedSettings },
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString()
      };
      await upsertReminder(payload);
      statusMessage.value = t('toolkit.reminderSaveSuccess');
      maybeOpenAllowCloseWarning();
      allowCloseBaseline = advancedSettings.allowClose;
      resetForm();
      showListView();
    } catch (error) {
      errorMessage.value = formatErrorMessage(error, 'toolkit.reminderSaveFailed');
    }
  }

  function editReminder(item: TaskReminder) {
    clearTip();
    editingId.value = item.id;
    applyReminderToForm(item);
    showEditorView();
  }

  async function deleteReminder(id: string) {
    clearTip();
    await removeReminder(id);
    if (editingId.value === id) {
      resetForm();
    }
    statusMessage.value = t('toolkit.reminderDeleteSuccess');
  }

  async function triggerNow(item: TaskReminder) {
    clearTip();
    try {
      await runReminderNow(item);
      statusMessage.value = t('toolkit.reminderTriggerSuccess');
    } catch (error) {
      errorMessage.value = formatErrorMessage(error, 'toolkit.reminderTriggerFailed');
    }
  }

  return {
    t,
    reminders,
    reminderListTitle,
    viewMode,
    editingId,
    sections,
    form,
    dailyInputTime,
    weeklyInputDays,
    weeklyInputTime,
    monthlyInputDays,
    monthlyInputTime,
    channelOptions,
    weekdayOptions,
    monthlyDayOptions,
    contentTypeOptions,
    advancedBackgroundTypeModel,
    advancedBackgroundOptions,
    advancedSettings,
    statusMessage,
    errorMessage,
    allowCloseWarningOpen,
    smtpDialogOpen,
    smtpForm,
    smtpTestTo,
    smtpTestSending,
    smtpSecurityOptions,
    formatWeekday,
    toggleReminderEnabled,
    updateDailyInputTime,
    updateWeeklyInputDays,
    updateWeeklyInputTime,
    updateMonthlyInputDays,
    updateMonthlyInputTime,
    updateSmtpTestTo,
    closeAllowCloseWarning,
    dismissAllowCloseWarning,
    handleAdvancedImageChange,
    handleContentImageChange,
    addDailyTime,
    removeDailyTime,
    addWeeklySlot,
    removeWeeklySlot,
    addMonthlySlot,
    removeMonthlySlot,
    openSmtpDialog,
    saveSmtpSettings,
    sendSmtpTestEmail,
    saveReminder,
    resetForm,
    startCreateReminder,
    returnToList,
    showListView,
    editReminder,
    deleteReminder,
    triggerNow
  };
}
