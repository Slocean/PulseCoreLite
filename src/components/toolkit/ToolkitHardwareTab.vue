<template>
  <HardwareScorePanel
    v-model="sections.score"
    :total-score="totalScore"
    :total-grade="totalGrade"
    :total-grade-label="totalGradeLabel"
    :total-summary="totalSummary"
    :score-ring-style="scoreRingStyle"
    @content-change="emit('contentChange')" />

  <HardwareDimensionPanel
    v-model="sections.dimension"
    :dimension-view="dimensionView"
    :dimension-view-label="dimensionViewLabel"
    :dimension-view-icon="dimensionViewIcon"
    :dimension-scores="dimensionScores"
    :radar-axes="radarAxes"
    :radar-grid-polygons="radarGridPolygons"
    :radar-value-points="radarValuePoints"
    :radar-value-dots="radarValueDots"
    @toggle-view="toggleDimensionView"
    @content-change="emit('contentChange')" />

  <HardwareSummaryPanel
    v-model="sections.summary"
    :rows="hardwareSummaryRows"
    @content-change="emit('contentChange')" />

  <HardwareAdvicePanel
    v-model="sections.advice"
    :advice-list="adviceList"
    @content-change="emit('contentChange')" />
</template>

<script setup lang="ts">
import { computed, nextTick, onMounted, ref, watch } from 'vue';
import { useI18n } from 'vue-i18n';

import {
  badgeClassForScore,
  buildRamLabel,
  calcBalanceScore,
  calcCodingScore,
  calcCpuScore,
  calcDiskScore,
  calcGpuScore,
  calcLlmScore,
  calcOverallScore,
  calcProductivityScore,
  calcRadarAxes,
  calcRadarGridPolygons,
  calcRadarValueDots,
  calcRadarValuePoints,
  calcRamScore,
  clampScore,
  detectDiskType,
  gradeColor,
  gradeForScore,
  gradeLabel,
  isCudaSupported,
  parseRamSpec,
  totalSummaryText
} from './hardware/hardwareScoring';
import HardwareAdvicePanel from './hardware/HardwareAdvicePanel.vue';
import HardwareDimensionPanel from './hardware/HardwareDimensionPanel.vue';
import HardwareScorePanel from './hardware/HardwareScorePanel.vue';
import HardwareSummaryPanel from './hardware/HardwareSummaryPanel.vue';
import { useAppStore } from '../../stores/app';

const emit = defineEmits<{
  (event: 'contentChange'): void;
}>();

const { t } = useI18n();
const store = useAppStore();

const sections = ref({
  score: true,
  dimension: true,
  summary: false,
  advice: false
});

const dimensionView = ref<'bars' | 'radar'>('radar');

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

const dimensionViewLabel = computed(() =>
  dimensionView.value === 'bars' ? t('toolkit.dimensionViewRadar') : t('toolkit.dimensionViewBars')
);
const dimensionViewIcon = computed(() => (dimensionView.value === 'bars' ? 'radar' : 'bar_chart'));

const radarAxes = computed(() => calcRadarAxes(dimensionScores.value));
const radarGridPolygons = computed(() => calcRadarGridPolygons(dimensionScores.value.length));
const radarValuePoints = computed(() => calcRadarValuePoints(dimensionScores.value));
const radarValueDots = computed(() => calcRadarValueDots(dimensionScores.value));

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
    hardwareInfo.value.cpu_model,
    hardwareInfo.value.gpu_model,
    hardwareInfo.value.ram_spec,
    hardwareInfo.value.disk_models.join('|'),
    snapshot.value.memory.total_mb,
    snapshot.value.gpu.memory_total_mb
  ].join('|')
);

watch(
  hardwareLayoutKey,
  () => {
    nextTick(() => emit('contentChange'));
  },
  { immediate: true }
);

onMounted(() => {
  nextTick(() => emit('contentChange'));
});

function toggleDimensionView() {
  dimensionView.value = dimensionView.value === 'bars' ? 'radar' : 'bars';
  nextTick(() => emit('contentChange'));
}
</script>

