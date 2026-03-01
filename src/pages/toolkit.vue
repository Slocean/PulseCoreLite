<template>
  <section class="overlay-widget overlay-widget--cyber toolkit-page" @mousedown="handleToolkitMouseDown">
    <div v-if="prefs.backgroundImage" class="overlay-bg" :style="overlayBackgroundStyle" aria-hidden="true"></div>
    <div
      v-if="showLiquidGlassHighlight"
      class="overlay-bg overlay-bg--liquid-highlight"
      :style="overlayLiquidGlassHighlightStyle"
      aria-hidden="true"></div>

    <header class="toolkit-header">
      <div class="overlay-title toolkit-drag-region" data-tauri-drag-region>
        <h1 class="title">{{ t('toolkit.title') }}</h1>
      </div>
      <div class="overlay-header-actions">
        <div class="overlay-drag" @mousedown.stop="startDragging" :aria-label="t('overlay.showDragHandle')">
          <span class="material-symbols-outlined">drag_handle</span>
        </div>
        <button
          type="button"
          class="overlay-action overlay-action--primary"
          :aria-label="t('overlay.minimizeToTray')"
          @click="minimizeToolkitWindow">
          <span class="material-symbols-outlined">remove</span>
        </button>
        <button
          type="button"
          class="overlay-action overlay-action--danger"
          :aria-label="t('overlay.close')"
          @click="closeToolkitWindow">
          <span class="material-symbols-outlined">close</span>
        </button>
      </div>
    </header>

    <nav class="toolkit-tabs" :aria-label="t('toolkit.tabs')">
      <button
        v-for="tab in tabs"
        :key="tab.id"
        type="button"
        class="toolkit-tab"
        :class="{ 'toolkit-tab--active': activeTab === tab.id }"
        @click="activeTab = tab.id">
        {{ tab.label }}
      </button>
    </nav>

    <template v-if="activeTab === 'shutdown'">
      <div class="toolkit-card">
        <h2 class="toolkit-section-title">{{ t('toolkit.countdownTitle') }}</h2>
        <div class="toolkit-grid toolkit-grid--3">
          <label class="toolkit-field">
            <span>{{ t('toolkit.hours') }}</span>
            <input
              v-model.number="countdownHours"
              type="number"
              min="0"
              max="999"
              @wheel="onNumberWheel($event, 'hours', 0, 999)" />
          </label>
          <label class="toolkit-field">
            <span>{{ t('toolkit.minutes') }}</span>
            <input
              v-model.number="countdownMinutes"
              type="number"
              min="0"
              max="59"
              @wheel="onNumberWheel($event, 'minutes', 0, 59)" />
          </label>
          <label class="toolkit-field">
            <span>{{ t('toolkit.seconds') }}</span>
            <input
              v-model.number="countdownSeconds"
              type="number"
              min="0"
              max="59"
              @wheel="onNumberWheel($event, 'seconds', 0, 59)" />
          </label>
        </div>
        <button type="button" class="overlay-config-primary" @click="scheduleCountdown">
          {{ t('toolkit.scheduleCountdown') }}
        </button>
      </div>

      <div class="toolkit-card">
        <h2 class="toolkit-section-title">{{ t('toolkit.datetimeTitle') }}</h2>
        <div class="toolkit-grid">
          <div class="toolkit-field">
            <span class="toolkit-field-label">{{ t('toolkit.datetime') }}</span>
            <input v-model="appointmentAt" type="datetime-local" @click="openDatetimePicker" />
          </div>
          <label class="toolkit-field">
            <span>{{ t('toolkit.repeat') }}</span>
            <select v-model="repeatMode">
              <option value="none">{{ t('toolkit.repeatNone') }}</option>
              <option value="daily">{{ t('toolkit.repeatDaily') }}</option>
              <option value="weekly">{{ t('toolkit.repeatWeekly') }}</option>
              <option value="monthly">{{ t('toolkit.repeatMonthly') }}</option>
            </select>
          </label>
          <label v-if="repeatMode === 'weekly'" class="toolkit-field">
            <span>{{ t('toolkit.weekday') }}</span>
            <select v-model.number="weeklyDay">
              <option v-for="item in weekdayOptions" :key="item.value" :value="item.value">{{ item.label }}</option>
            </select>
          </label>
          <label v-if="repeatMode === 'monthly'" class="toolkit-field">
            <span>{{ t('toolkit.dayOfMonth') }}</span>
            <input v-model.number="monthlyDay" type="number" min="1" max="31" />
          </label>
        </div>
        <button type="button" class="overlay-config-primary" @click="scheduleByDatetime">
          {{ t('toolkit.scheduleDatetime') }}
        </button>
      </div>

      <div class="toolkit-card">
        <h2 class="toolkit-section-title">{{ t('toolkit.currentPlan') }}</h2>
        <p class="toolkit-plan" :class="{ 'toolkit-plan--muted': !plan }">
          {{ planText }}
        </p>
        <div class="toolkit-actions">
          <button type="button" class="overlay-config-danger" @click="cancelPlan">
            {{ t('toolkit.cancelPlan') }}
          </button>
        </div>
      </div>

      <p v-if="statusMessage" class="toolkit-status">{{ statusMessage }}</p>
      <p v-if="errorMessage" class="toolkit-error">{{ errorMessage }}</p>
    </template>

    <template v-else>
      <div class="toolkit-card toolkit-card--score">
        <h2 class="toolkit-section-title">{{ t('toolkit.hardwareScoreTitle') }}</h2>
        <div class="toolkit-score-ring" :style="scoreRingStyle">
          <div class="toolkit-score-center">
            <div class="toolkit-score-value">{{ totalScore }}</div>
            <div class="toolkit-score-grade">{{ totalGrade }}</div>
          </div>
        </div>
        <div class="toolkit-score-caption">{{ totalGradeLabel }}</div>
        <p class="toolkit-score-desc">{{ totalSummary }}</p>
      </div>

      <div class="toolkit-card">
        <h2 class="toolkit-section-title">{{ t('toolkit.dimensionTitle') }}</h2>
        <div class="toolkit-score-list">
          <div v-for="item in dimensionScores" :key="item.id" class="toolkit-score-item">
            <div class="toolkit-score-item-header">
              <span class="toolkit-score-title">{{ item.title }}</span>
              <span class="toolkit-score-badge" :class="item.badgeClass">{{ item.level }}</span>
              <span class="toolkit-score-number" :style="{ color: item.color }">{{ item.score }}</span>
            </div>
            <div class="toolkit-score-bar">
              <span class="toolkit-score-bar-fill" :style="{ width: `${item.score}%`, background: item.color }"></span>
            </div>
            <p class="toolkit-score-desc">{{ item.summary }}</p>
          </div>
        </div>
      </div>

      <div class="toolkit-card">
        <h2 class="toolkit-section-title">{{ t('toolkit.hardwareSummaryTitle') }}</h2>
        <div class="toolkit-summary-grid">
          <div v-for="row in hardwareSummaryRows" :key="row.id" class="toolkit-summary-item">
            <span class="toolkit-summary-label">{{ row.label }}</span>
            <span class="toolkit-summary-value">{{ row.value }}</span>
          </div>
        </div>
      </div>

      <div class="toolkit-card">
        <h2 class="toolkit-section-title">{{ t('toolkit.hardwareAdviceTitle') }}</h2>
        <ul class="toolkit-advice-list">
          <li v-for="(item, index) in adviceList" :key="index" class="toolkit-advice-item">{{ item }}</li>
        </ul>
      </div>
    </template>
  </section>
</template>

<script setup lang="ts">
import { computed, nextTick, onMounted, ref, watch } from 'vue';
import { useI18n } from 'vue-i18n';

import { api, inTauri } from '../services/tauri';
import { useOverlayPrefs, type OverlayBackgroundEffect } from '../composables/useOverlayPrefs';
import { useAppStore } from '../stores/app';
import type { ScheduleShutdownRequest, ShutdownPlan } from '../types';

type RepeatMode = 'none' | 'daily' | 'weekly' | 'monthly';
type ToolkitTab = 'shutdown' | 'hardware';
type Grade = 'S' | 'A' | 'B' | 'C' | 'D';
type DiskType = 'nvme' | 'ssd' | 'hdd' | 'unknown';

const { t } = useI18n();
const { prefs } = useOverlayPrefs();
const store = useAppStore();

const countdownHours = ref(0);
const countdownMinutes = ref(30);
const countdownSeconds = ref(0);
const appointmentAt = ref(nextQuarterHourLocal());
const repeatMode = ref<RepeatMode>('none');
const weeklyDay = ref(dayToWeekday(new Date()));
const monthlyDay = ref(new Date().getDate());
const plan = ref<ShutdownPlan | null>(null);
const statusMessage = ref('');
const errorMessage = ref('');
const activeTab = ref<ToolkitTab>('shutdown');

const weekdayOptions = computed(() => [
  { value: 1, label: t('toolkit.weekdayMon') },
  { value: 2, label: t('toolkit.weekdayTue') },
  { value: 3, label: t('toolkit.weekdayWed') },
  { value: 4, label: t('toolkit.weekdayThu') },
  { value: 5, label: t('toolkit.weekdayFri') },
  { value: 6, label: t('toolkit.weekdaySat') },
  { value: 7, label: t('toolkit.weekdaySun') }
]);

const tabs = computed(() => [
  { id: 'shutdown' as const, label: t('toolkit.tabShutdown') },
  { id: 'hardware' as const, label: t('toolkit.tabHardware') }
]);

const planText = computed(() => {
  if (!plan.value) {
    return t('toolkit.currentPlanNone');
  }
  const current = plan.value;
  const localDate = current.executeAt ? formatLocalDate(current.executeAt) : null;
  if (current.mode === 'countdown') {
    return t('toolkit.planCountdown', { datetime: localDate ?? '-' });
  }
  if (current.mode === 'once') {
    return t('toolkit.planOnce', { datetime: localDate ?? '-' });
  }
  if (current.mode === 'daily') {
    return t('toolkit.planDaily', { time: current.time ?? '-' });
  }
  if (current.mode === 'weekly') {
    const weekday = weekdayOptions.value.find(item => item.value === current.weekday)?.label ?? '-';
    return t('toolkit.planWeekly', { weekday, time: current.time ?? '-' });
  }
  return t('toolkit.planMonthly', { day: String(current.dayOfMonth ?? '-'), time: current.time ?? '-' });
});

const overlayBackgroundStyle = computed(() => {
  const image = prefs.backgroundImage;
  if (!image) {
    return {};
  }
  const effect = normalizeBackgroundEffect(prefs.backgroundEffect);
  const blurPx = clampBlurPx(prefs.backgroundBlurPx);
  const glassStrength = clampGlassStrength(prefs.backgroundGlassStrength);
  return {
    backgroundImage: `url(${image})`,
    backgroundSize: 'cover',
    backgroundPosition: 'center',
    filter: getBackgroundFilter(effect, blurPx, glassStrength),
    transform: effect === 'liquidGlass' ? 'scale(1.03)' : 'none'
  };
});

const showLiquidGlassHighlight = computed(
  () => Boolean(prefs.backgroundImage) && normalizeBackgroundEffect(prefs.backgroundEffect) === 'liquidGlass'
);

const overlayLiquidGlassHighlightStyle = computed(() => {
  const strength = clampGlassStrength(prefs.backgroundGlassStrength);
  const opacity = 0.14 + strength / 420;
  return {
    background:
      'radial-gradient(120% 90% at 0% 0%, rgba(255,255,255,0.34), rgba(255,255,255,0) 60%), radial-gradient(100% 80% at 100% 0%, rgba(180,220,255,0.18), rgba(180,220,255,0) 70%)',
    opacity: opacity.toFixed(3)
  };
});

const hardwareInfo = computed(() => store.hardwareInfo);
const snapshot = computed(() => store.snapshot);

const ramSpec = computed(() => parseRamSpec(hardwareInfo.value.ram_spec));
const ramTotalGb = computed(() => {
  const totalFromSnapshot = snapshot.value.memory.total_mb;
  if (Number.isFinite(totalFromSnapshot) && totalFromSnapshot > 0) {
    return Math.max(1, Math.round(totalFromSnapshot / 1024));
  }
  const totalFromSpec = ramSpec.value.totalGb;
  if (totalFromSpec) {
    return totalFromSpec;
  }
  return 8;
});
const ramFreqMhz = computed(() => ramSpec.value.freqMhz ?? null);
const vramGb = computed(() => {
  const total = snapshot.value.gpu.memory_total_mb;
  if (!Number.isFinite(total) || total == null || total <= 0) {
    return null;
  }
  return Math.max(1, Math.round(total / 1024));
});
const diskType = computed(() => detectDiskType(hardwareInfo.value.disk_models));
const diskTypeLabel = computed(() => {
  if (diskType.value === 'nvme') return t('toolkit.diskNvme');
  if (diskType.value === 'ssd') return t('toolkit.diskSsd');
  if (diskType.value === 'hdd') return t('toolkit.diskHdd');
  return t('toolkit.diskUnknown');
});
const cudaSupported = computed(() => isCudaSupported(hardwareInfo.value.gpu_model));

const cpuScore = computed(() =>
  calcCpuScore(hardwareInfo.value.cpu_model, hardwareInfo.value.cpu_max_freq_mhz, snapshot.value.cpu.frequency_mhz)
);
const gpuScore = computed(() => calcGpuScore(hardwareInfo.value.gpu_model, vramGb.value));
const ramScore = computed(() => calcRamScore(ramTotalGb.value, ramFreqMhz.value));
const diskScore = computed(() => calcDiskScore(diskType.value));

const balanceParts = computed(() => {
  const items = [
    { id: 'cpu', score: cpuScore.value, label: t('overlay.cpu') },
    { id: 'gpu', score: gpuScore.value, label: t('overlay.gpu') },
    { id: 'ram', score: ramScore.value, label: t('overlay.memory') }
  ];
  const minItem = items.reduce((min, item) => (item.score < min.score ? item : min), items[0]);
  const maxItem = items.reduce((max, item) => (item.score > max.score ? item : max), items[0]);
  return {
    min: minItem,
    max: maxItem,
    diff: Math.max(0, maxItem.score - minItem.score)
  };
});

const balanceScore = computed(() => calcBalanceScore(cpuScore.value, gpuScore.value, ramScore.value, diskType.value));
const gameScore = computed(() => clampScore(gpuScore.value * 0.7 + cpuScore.value * 0.2 + ramScore.value * 0.1));
const llmScore = computed(() => calcLlmScore(vramGb.value, ramScore.value, cpuScore.value, diskScore.value, diskType.value));
const overallScore = computed(() => calcOverallScore(cpuScore.value, gpuScore.value, ramScore.value, diskScore.value));
const productivityScore = computed(() =>
  calcProductivityScore(cpuScore.value, gpuScore.value, ramScore.value, diskScore.value)
);
const codingScore = computed(() => calcCodingScore(ramTotalGb.value, diskType.value));

const totalScore = computed(() => {
  const value =
    balanceScore.value * 0.15 +
    gameScore.value * 0.2 +
    llmScore.value * 0.2 +
    overallScore.value * 0.2 +
    productivityScore.value * 0.15 +
    codingScore.value * 0.1;
  return clampScore(value);
});

const totalGrade = computed(() => gradeForScore(totalScore.value));
const totalGradeLabel = computed(() => gradeLabel(totalGrade.value, t));
const totalSummary = computed(() => totalSummaryText(totalScore.value, t));
const scoreRingStyle = computed(() => ({
  '--score-value': totalScore.value.toFixed(0),
  '--score-color': gradeColor(totalGrade.value)
}));

const balanceInfo = computed(() => {
  if (balanceScore.value >= 85) {
    return {
      label: t('toolkit.balanceLevelHigh'),
      summary: t('toolkit.balanceSummaryPerfect')
    };
  }
  if (balanceScore.value >= 70) {
    return {
      label: t('toolkit.balanceLevelOk'),
      summary: t('toolkit.balanceSummaryGood')
    };
  }
  if (balanceScore.value >= 60) {
    return {
      label: t('toolkit.balanceLevelMinor'),
      summary: t('toolkit.balanceSummarySkewed', { weak: balanceParts.value.min.label })
    };
  }
  return {
    label: t('toolkit.balanceLevelBad'),
    summary: t('toolkit.balanceSummaryBottleneck', { weak: balanceParts.value.min.label })
  };
});

const gameInfo = computed(() => {
  if (gameScore.value >= 90) return { label: t('toolkit.gameTier4k'), summary: t('toolkit.gameSummary4k') };
  if (gameScore.value >= 70) return { label: t('toolkit.gameTier2k'), summary: t('toolkit.gameSummary2k') };
  if (gameScore.value >= 50) return { label: t('toolkit.gameTier1080'), summary: t('toolkit.gameSummary1080') };
  if (gameScore.value >= 30) return { label: t('toolkit.gameTierEntry'), summary: t('toolkit.gameSummaryEntry') };
  return { label: t('toolkit.gameTierNo'), summary: t('toolkit.gameSummaryNo') };
});

const llmRecommendation = computed(() => {
  const vram = vramGb.value ?? 0;
  if (vram >= 48) return t('toolkit.llmModel70b');
  if (vram >= 24) return t('toolkit.llmModel30b');
  if (vram >= 16) return t('toolkit.llmModel13bQ8');
  if (vram >= 12) return t('toolkit.llmModel13bQ4');
  if (vram >= 8) return t('toolkit.llmModel7bQ8');
  if (vram >= 6) return t('toolkit.llmModel7bQ4');
  if (vram >= 4) return t('toolkit.llmModel3b');
  return '';
});

const llmSummary = computed(() => {
  if (!cudaSupported.value) {
    return t('toolkit.llmSummaryNoCuda');
  }
  if (vramGb.value != null && vramGb.value < 4) {
    return t('toolkit.llmSummaryCloud');
  }
  const model = llmRecommendation.value;
  if (model) {
    return t('toolkit.llmSummaryRecommend', { model });
  }
  return t('toolkit.llmSummaryCloud');
});

const productivityInfo = computed(() => {
  if (productivityScore.value >= 85)
    return { label: t('toolkit.productivityPro'), summary: t('toolkit.productivitySummaryPro') };
  if (productivityScore.value >= 70)
    return { label: t('toolkit.productivityCreator'), summary: t('toolkit.productivitySummaryCreator') };
  if (productivityScore.value >= 60)
    return { label: t('toolkit.productivityOffice'), summary: t('toolkit.productivitySummaryOffice') };
  return { label: t('toolkit.productivityBasic'), summary: t('toolkit.productivitySummaryBasic') };
});

const codingInfo = computed(() => {
  const ram = ramTotalGb.value;
  const ideCount = Math.max(1, Math.floor((ram - 3) / 2.5));
  if (ram >= 64) {
    return {
      label: t('toolkit.codingUltimate'),
      summary: t('toolkit.codingSummaryUltimate', { ideCount })
    };
  }
  if (ram >= 32) {
    return {
      label: t('toolkit.codingSmooth'),
      summary: t('toolkit.codingSummarySmooth', { ideCount })
    };
  }
  if (ram >= 16) {
    return {
      label: t('toolkit.codingStandard'),
      summary: t('toolkit.codingSummaryStandard', { ideCount })
    };
  }
  return {
    label: t('toolkit.codingLight'),
    summary: t('toolkit.codingSummaryLight', { ideCount })
  };
});

const dimensionScores = computed(() => [
  {
    id: 'balance',
    title: t('toolkit.dimensionBalance'),
    score: balanceScore.value,
    level: balanceInfo.value.label,
    summary: balanceInfo.value.summary,
    badgeClass: badgeClassForScore(balanceScore.value),
    color: gradeColor(gradeForScore(balanceScore.value))
  },
  {
    id: 'game',
    title: t('toolkit.dimensionGame'),
    score: gameScore.value,
    level: gameInfo.value.label,
    summary: gameInfo.value.summary,
    badgeClass: badgeClassForScore(gameScore.value),
    color: gradeColor(gradeForScore(gameScore.value))
  },
  {
    id: 'llm',
    title: t('toolkit.dimensionLlm'),
    score: llmScore.value,
    level: gradeLabel(gradeForScore(llmScore.value), t),
    summary: llmSummary.value,
    badgeClass: badgeClassForScore(llmScore.value),
    color: gradeColor(gradeForScore(llmScore.value))
  },
  {
    id: 'overall',
    title: t('toolkit.dimensionOverall'),
    score: overallScore.value,
    level: gradeLabel(gradeForScore(overallScore.value), t),
    summary: t('toolkit.overallSummary', { level: gradeLabel(gradeForScore(overallScore.value), t) }),
    badgeClass: badgeClassForScore(overallScore.value),
    color: gradeColor(gradeForScore(overallScore.value))
  },
  {
    id: 'productivity',
    title: t('toolkit.dimensionProductivity'),
    score: productivityScore.value,
    level: productivityInfo.value.label,
    summary: productivityInfo.value.summary,
    badgeClass: badgeClassForScore(productivityScore.value),
    color: gradeColor(gradeForScore(productivityScore.value))
  },
  {
    id: 'coding',
    title: t('toolkit.dimensionCoding'),
    score: codingScore.value,
    level: codingInfo.value.label,
    summary: codingInfo.value.summary,
    badgeClass: badgeClassForScore(codingScore.value),
    color: gradeColor(gradeForScore(codingScore.value))
  }
]);

const hardwareSummaryRows = computed(() => {
  const cpuLabel = hardwareInfo.value.cpu_model || t('common.na');
  const gpuLabel = hardwareInfo.value.gpu_model || t('common.na');
  const ramLabel = buildRamLabel(ramSpec.value, ramTotalGb.value, t);
  const vramLabel = vramGb.value != null ? `${vramGb.value}GB` : t('common.na');
  const diskModel = hardwareInfo.value.disk_models[0] ?? '';
  const diskLabel = diskModel ? `${diskTypeLabel.value} · ${diskModel}` : diskTypeLabel.value;
  const systemLabel =
    [hardwareInfo.value.device_brand, hardwareInfo.value.motherboard].filter(Boolean).join(' · ') || t('common.na');
  return [
    { id: 'cpu', label: t('overlay.cpu'), value: cpuLabel },
    { id: 'gpu', label: t('overlay.gpu'), value: gpuLabel },
    { id: 'ram', label: t('overlay.memory'), value: ramLabel },
    { id: 'vram', label: t('overlay.vram'), value: vramLabel },
    { id: 'disk', label: t('overlay.disk'), value: diskLabel },
    { id: 'system', label: t('toolkit.hardwareSystem'), value: systemLabel }
  ];
});

const adviceList = computed(() => {
  const list: string[] = [];
  if (ramTotalGb.value < 16) {
    list.push(t('toolkit.adviceRamUpgrade', { target: 16 }));
  }
  if (diskType.value === 'hdd') {
    list.push(t('toolkit.adviceDiskUpgrade'));
  }
  if (vramGb.value != null && vramGb.value < 8) {
    list.push(t('toolkit.adviceGpuUpgrade'));
  }
  if (balanceParts.value.diff >= 25) {
    list.push(t('toolkit.adviceBalanceWeak', { weak: balanceParts.value.min.label }));
  }
  if (!cudaSupported.value) {
    list.push(t('toolkit.adviceCudaMissing'));
  }
  if (list.length === 0) {
    list.push(t('toolkit.adviceAllGood'));
  }
  return list;
});

const hardwareLayoutKey = computed(() =>
  [
    activeTab.value,
    hardwareInfo.value.cpu_model,
    hardwareInfo.value.gpu_model,
    hardwareInfo.value.ram_spec,
    hardwareInfo.value.disk_models.join('|'),
    snapshot.value.memory.total_mb,
    snapshot.value.gpu.memory_total_mb
  ].join('|')
);

watch(
  () => prefs.backgroundOpacity,
  value => {
    if (typeof document === 'undefined') {
      return;
    }
    const safeValue = Math.max(0, Math.min(100, value));
    document.documentElement.style.setProperty('--overlay-bg-opacity', String(safeValue / 100));
  },
  { immediate: true }
);

watch([repeatMode, plan, statusMessage, errorMessage, hardwareLayoutKey], () => {
  nextTick(updateWindowHeight);
});

watch(appointmentAt, value => {
  const date = parseDatetimeLocal(value);
  if (!date) return;
  weeklyDay.value = dayToWeekday(date);
  monthlyDay.value = date.getDate();
});

onMounted(() => {
  void refreshPlan();
  setTimeout(updateWindowHeight, 100);
});

async function updateWindowHeight() {
  if (!inTauri()) return;
  try {
    const { getCurrentWindow } = await import('@tauri-apps/api/window');
    const { LogicalSize } = await import('@tauri-apps/api/dpi');
    const content = document.querySelector('.toolkit-page');
    const height = (content ? content.scrollHeight : document.body.scrollHeight) + 4;
    await getCurrentWindow().setSize(new LogicalSize(260, height));
  } catch {}
}

async function refreshPlan() {
  if (!inTauri()) {
    plan.value = null;
    return;
  }
  try {
    plan.value = await api.getShutdownPlan();
  } catch {
    errorMessage.value = t('toolkit.loadFailed');
  }
}

async function scheduleCountdown() {
  clearTips();
  if (!inTauri()) return;

  const totalSeconds =
    sanitizeNonNegative(countdownHours.value) * 3600 +
    sanitizeNonNegative(countdownMinutes.value) * 60 +
    sanitizeNonNegative(countdownSeconds.value);

  if (totalSeconds <= 0) {
    errorMessage.value = t('toolkit.invalidCountdown');
    return;
  }

  const request: ScheduleShutdownRequest = {
    mode: 'countdown',
    delaySeconds: totalSeconds
  };

  await submitSchedule(request);
}

async function scheduleByDatetime() {
  clearTips();
  if (!inTauri()) return;

  const date = parseDatetimeLocal(appointmentAt.value);
  if (!date) {
    errorMessage.value = t('toolkit.invalidDatetime');
    return;
  }

  const hhmm = `${String(date.getHours()).padStart(2, '0')}:${String(date.getMinutes()).padStart(2, '0')}`;
  let request: ScheduleShutdownRequest | null = null;

  if (repeatMode.value === 'none') {
    if (date.getTime() <= Date.now()) {
      errorMessage.value = t('toolkit.datetimeMustFuture');
      return;
    }
    request = {
      mode: 'once',
      executeAt: date.toISOString()
    };
  } else if (repeatMode.value === 'daily') {
    request = {
      mode: 'daily',
      time: hhmm
    };
  } else if (repeatMode.value === 'weekly') {
    request = {
      mode: 'weekly',
      time: hhmm,
      weekday: Math.max(1, Math.min(7, Math.round(weeklyDay.value)))
    };
  } else {
    request = {
      mode: 'monthly',
      time: hhmm,
      dayOfMonth: Math.max(1, Math.min(31, Math.round(monthlyDay.value)))
    };
  }

  await submitSchedule(request);
}

async function cancelPlan() {
  clearTips();
  if (!inTauri()) return;

  try {
    await api.cancelShutdownSchedule();
    plan.value = null;
    statusMessage.value = t('toolkit.cancelSuccess');
  } catch {
    errorMessage.value = t('toolkit.cancelFailed');
  }
}

async function submitSchedule(request: ScheduleShutdownRequest) {
  try {
    plan.value = await api.scheduleShutdown(request);
    statusMessage.value = t('toolkit.scheduleSuccess');
  } catch (error) {
    const message = error instanceof Error && error.message ? error.message : t('toolkit.scheduleFailed');
    errorMessage.value = message;
  }
}

async function closeToolkitWindow() {
  if (!inTauri()) return;
  try {
    const { getCurrentWindow } = await import('@tauri-apps/api/window');
    await getCurrentWindow().close();
  } catch {
    // ignore
  }
}

async function minimizeToolkitWindow() {
  if (!inTauri()) return;
  try {
    const { getCurrentWindow } = await import('@tauri-apps/api/window');
    await getCurrentWindow().minimize();
  } catch {
    // ignore
  }
}

async function startDragging() {
  if (!inTauri()) return;
  try {
    const { getCurrentWindow } = await import('@tauri-apps/api/window');
    await getCurrentWindow().startDragging();
  } catch {
    // ignore
  }
}

function openDatetimePicker(event: MouseEvent) {
  const target = event.currentTarget as HTMLInputElement | null;
  if (!target) return;
  if (typeof (target as any).showPicker === 'function') {
    (target as any).showPicker();
  }
}

function onNumberWheel(event: WheelEvent, field: 'hours' | 'minutes' | 'seconds', min: number, max: number) {
  const el = event.currentTarget as HTMLInputElement | null;
  if (!el || document.activeElement !== el) {
    return;
  }
  event.preventDefault();
  const model = field === 'hours' ? countdownHours : field === 'minutes' ? countdownMinutes : countdownSeconds;
  const dir = event.deltaY > 0 ? -1 : 1;
  const current = sanitizeNonNegative(model.value);
  const next = Math.max(min, Math.min(max, current + dir));
  model.value = next;
}

function handleToolkitMouseDown(event: MouseEvent) {
  const target = event.target as HTMLElement | null;
  if (!target) return;
  if (target.closest('.overlay-header-actions')) return;
  if (target.closest('.toolkit-tabs, .toolkit-card')) return;
  if (target.closest('button, input, select, textarea, label, .overlay-config')) return;
  void startDragging();
}

function nextQuarterHourLocal() {
  const now = new Date();
  now.setSeconds(0, 0);
  const nextMinute = Math.ceil((now.getMinutes() + 1) / 15) * 15;
  if (nextMinute >= 60) {
    now.setHours(now.getHours() + 1, 0, 0, 0);
  } else {
    now.setMinutes(nextMinute, 0, 0);
  }
  return formatDatetimeLocal(now);
}

function formatDatetimeLocal(date: Date) {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(
    2,
    '0'
  )}T${String(date.getHours()).padStart(2, '0')}:${String(date.getMinutes()).padStart(2, '0')}`;
}

function formatLocalDate(iso: string) {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) {
    return iso;
  }
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(
    2,
    '0'
  )} ${String(date.getHours()).padStart(2, '0')}:${String(date.getMinutes()).padStart(2, '0')}:${String(
    date.getSeconds()
  ).padStart(2, '0')}`;
}

function parseDatetimeLocal(value: string) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return null;
  }
  return date;
}

function dayToWeekday(date: Date) {
  const day = date.getDay();
  return day === 0 ? 7 : day;
}

function sanitizeNonNegative(value: number) {
  if (!Number.isFinite(value)) return 0;
  return Math.max(0, Math.round(value));
}

function clearTips() {
  statusMessage.value = '';
  errorMessage.value = '';
}

function clampBlurPx(value: unknown) {
  return typeof value === 'number' && Number.isFinite(value) ? Math.max(0, Math.min(40, Math.round(value))) : 0;
}

function clampGlassStrength(value: unknown) {
  return typeof value === 'number' && Number.isFinite(value) ? Math.max(0, Math.min(100, Math.round(value))) : 55;
}

function normalizeBackgroundEffect(value: unknown): OverlayBackgroundEffect {
  return value === 'liquidGlass' ? 'liquidGlass' : 'gaussian';
}

function getBackgroundFilter(effect: OverlayBackgroundEffect, blurPx: number, glassStrength: number) {
  const safeBlur = clampBlurPx(blurPx);
  if (effect === 'liquidGlass') {
    const s = clampGlassStrength(glassStrength);
    const blur = 8 + Math.round((safeBlur / 40) * 14 + (s / 100) * 8);
    const saturate = (130 + Math.round((s / 100) * 70)).toString();
    const brightness = (92 + Math.round((s / 100) * 12)).toString();
    return `blur(${blur}px) saturate(${saturate}%) brightness(${brightness}%)`;
  }
  return safeBlur > 0 ? `blur(${safeBlur}px)` : 'none';
}

function clampScore(value: number) {
  if (!Number.isFinite(value)) return 0;
  return Math.max(0, Math.min(100, Math.round(value)));
}

function gradeForScore(value: number): Grade {
  if (value >= 95) return 'S';
  if (value >= 80) return 'A';
  if (value >= 60) return 'B';
  if (value >= 40) return 'C';
  return 'D';
}

function gradeColor(grade: Grade) {
  if (grade === 'S') return 'rgba(0, 242, 255, 0.96)';
  if (grade === 'A') return 'rgba(99, 255, 212, 0.92)';
  if (grade === 'B') return 'rgba(255, 214, 102, 0.92)';
  if (grade === 'C') return 'rgba(255, 144, 155, 0.92)';
  return 'rgba(255, 92, 92, 0.92)';
}

function gradeLabel(grade: Grade, t: (key: string, params?: Record<string, unknown>) => string) {
  if (grade === 'S') return t('toolkit.levelS');
  if (grade === 'A') return t('toolkit.levelA');
  if (grade === 'B') return t('toolkit.levelB');
  if (grade === 'C') return t('toolkit.levelC');
  return t('toolkit.levelD');
}

function badgeClassForScore(value: number) {
  return `toolkit-score-badge--${gradeForScore(value).toLowerCase()}`;
}

function totalSummaryText(score: number, t: (key: string, params?: Record<string, unknown>) => string) {
  if (score >= 95) return t('toolkit.totalSummaryS');
  if (score >= 80) return t('toolkit.totalSummaryA');
  if (score >= 60) return t('toolkit.totalSummaryB');
  if (score >= 40) return t('toolkit.totalSummaryC');
  return t('toolkit.totalSummaryD');
}

function parseRamSpec(value: string) {
  const text = value ?? '';
  const totalMatch = text.match(/(\d+)\s*(?:GB|G)\b/i);
  const freqMatch = text.match(/(\d{3,5})\s*mhz/i);
  const typeMatch = text.match(/\b(DDR\d|LPDDR\d)\b/i);
  return {
    totalGb: totalMatch ? Math.max(1, Number(totalMatch[1])) : null,
    freqMhz: freqMatch ? Math.max(1, Number(freqMatch[1])) : null,
    type: typeMatch ? typeMatch[1].toUpperCase() : null
  };
}

function buildRamLabel(
  spec: { totalGb: number | null; freqMhz: number | null; type: string | null },
  totalGb: number,
  t: (key: string, params?: Record<string, unknown>) => string
) {
  const parts: string[] = [];
  if (spec.type) parts.push(spec.type);
  if (spec.freqMhz) parts.push(`${spec.freqMhz}MHz`);
  if (totalGb) parts.push(`${totalGb}GB`);
  return parts.length ? parts.join(' ') : t('common.na');
}

function detectDiskType(models: string[]): DiskType {
  const text = models.join(' ').toLowerCase();
  if (!text.trim()) return 'unknown';
  if (/(nvme|pcie|m\.2)/i.test(text)) return 'nvme';
  if (/(ssd|solid state)/i.test(text)) return 'ssd';
  if (/(hdd|hard disk|5400|7200|wdc|seagate|hitachi|toshiba)/i.test(text)) return 'hdd';
  return 'unknown';
}

function calcCpuScore(model: string, maxFreqMhz: number | null, currentFreqMhz: number | null) {
  const freq = maxFreqMhz ?? currentFreqMhz ?? 3200;
  const base = ((freq - 1200) / (6000 - 1200)) * 100;
  const name = (model ?? '').toLowerCase();
  let boost = 0;
  if (/(threadripper|epyc|xeon w|xeon gold|i9|ryzen 9)/i.test(name)) boost = 12;
  else if (/(i7|ryzen 7)/i.test(name)) boost = 6;
  else if (/(i5|ryzen 5)/i.test(name)) boost = 2;
  else if (/(i3|ryzen 3)/i.test(name)) boost = -6;
  else if (/(celeron|pentium|athlon)/i.test(name)) boost = -14;
  else if (/\bm[1-3]\b|\bm2\b|\bm3\b/i.test(name)) boost = 8;
  return clampScore(base + boost);
}

function calcGpuScore(model: string, vramGb: number | null) {
  const normalized = (model ?? '').trim().toLowerCase();
  if (!normalized || normalized === 'n/a' || normalized === 'unknown') {
    const fallback = calcVramScore(vramGb);
    return clampScore(fallback ?? 25);
  }
  const candidates = (model ?? '')
    .split('/')
    .map(item => item.trim())
    .filter(Boolean);
  const modelScore = candidates.reduce((best, name) => {
    const score = gpuModelScore(name);
    if (score == null) return best;
    return Math.max(best ?? 0, score);
  }, null as number | null);
  const vramScore = calcVramScore(vramGb);
  if (modelScore != null && vramScore != null) {
    return clampScore(modelScore * 0.7 + vramScore * 0.3);
  }
  if (modelScore != null) return clampScore(modelScore);
  if (vramScore != null) return clampScore(vramScore);
  return 50;
}

function gpuModelScore(name: string): number | null {
  const text = name.toLowerCase();
  const table: Array<[RegExp, number]> = [
    [/rtx\s?4090/, 100],
    [/rtx\s?4080/, 95],
    [/rtx\s?4070\s?ti/, 88],
    [/rtx\s?4070/, 84],
    [/rtx\s?4060\s?ti/, 78],
    [/rtx\s?4060/, 74],
    [/rtx\s?3090/, 90],
    [/rtx\s?3080/, 86],
    [/rtx\s?3070/, 80],
    [/rtx\s?3060/, 72],
    [/rtx\s?3050/, 62],
    [/rtx\s?2080/, 78],
    [/rtx\s?2070/, 72],
    [/rtx\s?2060/, 66],
    [/gtx\s?1660/, 58],
    [/gtx\s?1650/, 50],
    [/gtx\s?1060/, 50],
    [/gtx\s?1050/, 40],
    [/arc\s?a770/, 78],
    [/arc\s?a750/, 74],
    [/arc\s?a580/, 68],
    [/arc\s?a380/, 55],
    [/7900\s?xtx/, 96],
    [/7900\s?xt/, 92],
    [/7800\s?xt/, 86],
    [/7700\s?xt/, 80],
    [/7600/, 72],
    [/6950\s?xt/, 88],
    [/6900\s?xt/, 86],
    [/6800\s?xt/, 84],
    [/6700\s?xt/, 78],
    [/6600/, 68],
    [/6500/, 58],
    [/quadro|tesla|rtx\s?a\d{3,4}/, 78],
    [/iris|uhd|hd graphics|intel graphics/, 30],
    [/radeon graphics|vega|rx vega|apu/, 34]
  ];
  for (const [regex, score] of table) {
    if (regex.test(text)) return score;
  }
  return null;
}

function calcVramScore(vramGb: number | null) {
  if (vramGb == null) return null;
  if (vramGb >= 24) return 92;
  if (vramGb >= 16) return 84;
  if (vramGb >= 12) return 76;
  if (vramGb >= 8) return 68;
  if (vramGb >= 6) return 60;
  if (vramGb >= 4) return 50;
  if (vramGb >= 2) return 35;
  return 25;
}

function calcRamScore(totalGb: number, freqMhz: number | null) {
  let score = 0;
  if (totalGb >= 64) score = 100;
  else if (totalGb >= 32) score = 95;
  else if (totalGb >= 16) score = 80;
  else if (totalGb >= 12) score = 72;
  else if (totalGb >= 8) score = 60;
  else if (totalGb >= 4) score = 40;
  else score = 20;

  if (freqMhz != null) {
    if (freqMhz >= 5600) score += 4;
    else if (freqMhz >= 3600) score += 2;
  }
  return clampScore(score);
}

function calcDiskScore(type: DiskType) {
  if (type === 'nvme') return 100;
  if (type === 'ssd') return 80;
  if (type === 'hdd') return 40;
  return 60;
}

function calcBalanceScore(cpu: number, gpu: number, ram: number, diskType: DiskType) {
  const values = [cpu, gpu, ram];
  const mean = values.reduce((sum, value) => sum + value, 0) / values.length;
  const variance = values.reduce((sum, value) => sum + Math.pow(value - mean, 2), 0) / values.length;
  const stddev = Math.sqrt(variance);
  let score = 100 - stddev * 2;
  if (diskType === 'hdd') score -= 10;
  return clampScore(score);
}

function calcLlmScore(vramGb: number | null, ramScore: number, cpuScore: number, diskScore: number, diskType: DiskType) {
  const vramScore = calcVramScore(vramGb) ?? 30;
  let score = vramScore * 0.5 + ramScore * 0.25 + cpuScore * 0.15 + diskScore * 0.1;
  if (diskType === 'hdd') score -= 15;
  return clampScore(score);
}

function calcOverallScore(cpu: number, gpu: number, ram: number, diskScore: number) {
  return clampScore(cpu * 0.35 + gpu * 0.35 + ram * 0.2 + diskScore * 0.1);
}

function calcProductivityScore(cpu: number, gpu: number, ram: number, diskScore: number) {
  return clampScore(cpu * 0.4 + ram * 0.3 + diskScore * 0.2 + gpu * 0.1);
}

function calcCodingScore(ramGb: number, diskType: DiskType) {
  let score = 0;
  if (ramGb >= 64) score = 100;
  else if (ramGb >= 32) score = 95;
  else if (ramGb >= 16) score = 80;
  else if (ramGb >= 8) score = 60;
  else if (ramGb >= 4) score = 40;
  else score = 25;
  if (diskType === 'hdd') score -= 10;
  return clampScore(score);
}

function isCudaSupported(model: string) {
  return /(nvidia|geforce|rtx|gtx|quadro|tesla)/i.test(model ?? '');
}
</script>
