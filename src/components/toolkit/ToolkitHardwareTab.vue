<template>
  <div class="toolkit-card toolkit-card--score">
    <button type="button" class="toolkit-collapse-toggle" @click="toggleSection('score')">
      <span class="toolkit-section-title">{{ t('toolkit.hardwareScoreTitle') }}</span>
      <span class="toolkit-collapse-indicator material-symbols-outlined" :class="{ 'is-open': sections.score }">
        expand_more
      </span>
    </button>
    <div v-if="sections.score">
      <div class="toolkit-score-ring" :style="scoreRingStyle">
        <div class="toolkit-score-center">
          <div class="toolkit-score-value">{{ totalScore }}</div>
          <div class="toolkit-score-grade">{{ totalGrade }}</div>
        </div>
      </div>
      <div class="toolkit-score-caption">{{ totalGradeLabel }}</div>
      <p class="toolkit-score-desc">{{ totalSummary }}</p>
    </div>
  </div>

  <div class="toolkit-card">
    <div class="toolkit-section-header">
      <button type="button" class="toolkit-collapse-toggle toolkit-collapse-toggle--title" @click="toggleSection('dimension')">
        <span class="toolkit-section-title">{{ t('toolkit.dimensionTitle') }}</span>
      </button>
      <button type="button" class="toolkit-view-toggle" :aria-label="dimensionViewLabel" @click="toggleDimensionView">
        <span class="material-symbols-outlined">{{ dimensionViewIcon }}</span>
        <span class="toolkit-view-toggle-text">{{ dimensionViewLabel }}</span>
      </button>
      <button
        type="button"
        class="toolkit-collapse-toggle toolkit-collapse-toggle--icon"
        @click="toggleSection('dimension')"
        :aria-label="t('toolkit.dimensionTitle')">
        <span class="toolkit-collapse-indicator material-symbols-outlined" :class="{ 'is-open': sections.dimension }">
          expand_more
        </span>
      </button>
    </div>
    <div v-if="sections.dimension">
      <div v-if="dimensionView === 'bars'" class="toolkit-score-list">
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
      <div v-else class="toolkit-radar">
        <svg class="toolkit-radar-svg" viewBox="0 0 200 200" aria-hidden="true">
          <g>
            <polygon
              v-for="ring in radarGridPolygons"
              :key="ring.step"
              class="toolkit-radar-grid"
              :points="ring.points" />
          </g>
          <g>
            <line
              v-for="(axis, index) in radarAxes"
              :key="`axis-${index}`"
              class="toolkit-radar-axis"
              :x1="RADAR_CENTER"
              :y1="RADAR_CENTER"
              :x2="axis.x"
              :y2="axis.y" />
          </g>
          <polygon class="toolkit-radar-area" :points="radarValuePoints" />
          <circle
            v-for="(point, index) in radarValueDots"
            :key="`dot-${index}`"
            class="toolkit-radar-point"
            :cx="point.x"
            :cy="point.y"
            r="2.4" />
          <text
            v-for="(axis, index) in radarAxes"
            :key="`label-${index}`"
            class="toolkit-radar-label"
            :x="axis.labelX"
            :y="axis.labelY"
            :text-anchor="axis.anchor"
            :dominant-baseline="axis.baseline">
            {{ axis.label }}
          </text>
        </svg>
        <div class="toolkit-radar-legend">
          <div v-for="item in dimensionScores" :key="`legend-${item.id}`" class="toolkit-radar-legend-item">
            <span class="toolkit-radar-dot" :style="{ background: item.color }"></span>
            <span class="toolkit-radar-label-text">{{ item.title }}</span>
            <span class="toolkit-radar-value">{{ item.score }}</span>
          </div>
        </div>
      </div>
    </div>
  </div>

  <div class="toolkit-card">
    <button type="button" class="toolkit-collapse-toggle" @click="toggleSection('summary')">
      <span class="toolkit-section-title">{{ t('toolkit.hardwareSummaryTitle') }}</span>
      <span
        class="toolkit-collapse-indicator material-symbols-outlined"
        :class="{ 'is-open': sections.summary }">
        expand_more
      </span>
    </button>
    <div v-if="sections.summary" class="toolkit-summary-grid">
      <div v-for="row in hardwareSummaryRows" :key="row.id" class="toolkit-summary-item">
        <span class="toolkit-summary-label">{{ row.label }}</span>
        <span class="toolkit-summary-value">{{ row.value }}</span>
      </div>
    </div>
  </div>

  <div class="toolkit-card">
    <button type="button" class="toolkit-collapse-toggle" @click="toggleSection('advice')">
      <span class="toolkit-section-title">{{ t('toolkit.hardwareAdviceTitle') }}</span>
      <span class="toolkit-collapse-indicator material-symbols-outlined" :class="{ 'is-open': sections.advice }">
        expand_more
      </span>
    </button>
    <ul v-if="sections.advice" class="toolkit-advice-list">
      <li v-for="(item, index) in adviceList" :key="index" class="toolkit-advice-item">{{ item }}</li>
    </ul>
  </div>
</template>

<script setup lang="ts">
import { computed, nextTick, onMounted, ref, watch } from 'vue';
import { useI18n } from 'vue-i18n';

import { useAppStore } from '../../stores/app';

type Grade = 'S' | 'A' | 'B' | 'C' | 'D';
type DiskType = 'nvme' | 'ssd' | 'hdd' | 'unknown';

const emit = defineEmits<{
  (event: 'contentChange'): void;
}>();

const { t } = useI18n();
const store = useAppStore();

const RADAR_CENTER = 100;
const RADAR_RADIUS = 68;
const RADAR_LABEL_RADIUS = 88;
const RADAR_RINGS = [0.2, 0.4, 0.6, 0.8, 1];

const sections = ref({
  score: true,
  dimension: true,
  summary: false,
  advice: false
});

const dimensionView = ref<'bars' | 'radar'>('bars');

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

const radarAxes = computed(() => {
  const total = Math.max(1, dimensionScores.value.length);
  return dimensionScores.value.map((item, index) => {
    const angle = ((-90 + (360 / total) * index) * Math.PI) / 180;
    const x = RADAR_CENTER + RADAR_RADIUS * Math.cos(angle);
    const y = RADAR_CENTER + RADAR_RADIUS * Math.sin(angle);
    const labelX = RADAR_CENTER + RADAR_LABEL_RADIUS * Math.cos(angle);
    const labelY = RADAR_CENTER + RADAR_LABEL_RADIUS * Math.sin(angle);
    const axisCos = Math.cos(angle);
    const axisSin = Math.sin(angle);
    const anchor = Math.abs(axisCos) < 0.2 ? 'middle' : axisCos > 0 ? 'start' : 'end';
    const baseline = Math.abs(axisSin) < 0.2 ? 'middle' : axisSin > 0 ? 'hanging' : 'baseline';
    return { x, y, labelX, labelY, label: item.title, anchor, baseline };
  });
});

const radarGridPolygons = computed(() => {
  const total = Math.max(1, dimensionScores.value.length);
  return RADAR_RINGS.map(step => {
    const points = dimensionScores.value
      .map((_, index) => {
        const angle = ((-90 + (360 / total) * index) * Math.PI) / 180;
        const radius = RADAR_RADIUS * step;
        const x = RADAR_CENTER + radius * Math.cos(angle);
        const y = RADAR_CENTER + radius * Math.sin(angle);
        return `${x.toFixed(1)},${y.toFixed(1)}`;
      })
      .join(' ');
    return { step, points };
  });
});

const radarValuePoints = computed(() => {
  const total = Math.max(1, dimensionScores.value.length);
  return dimensionScores.value
    .map((item, index) => {
      const angle = ((-90 + (360 / total) * index) * Math.PI) / 180;
      const radius = (RADAR_RADIUS * item.score) / 100;
      const x = RADAR_CENTER + radius * Math.cos(angle);
      const y = RADAR_CENTER + radius * Math.sin(angle);
      return `${x.toFixed(1)},${y.toFixed(1)}`;
    })
    .join(' ');
});

const radarValueDots = computed(() => {
  const total = Math.max(1, dimensionScores.value.length);
  return dimensionScores.value.map((item, index) => {
    const angle = ((-90 + (360 / total) * index) * Math.PI) / 180;
    const radius = (RADAR_RADIUS * item.score) / 100;
    return {
      x: RADAR_CENTER + radius * Math.cos(angle),
      y: RADAR_CENTER + radius * Math.sin(angle)
    };
  });
});

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

function toggleSection(key: 'score' | 'dimension' | 'summary' | 'advice') {
  sections.value[key] = !sections.value[key];
  nextTick(() => emit('contentChange'));
}

function toggleDimensionView() {
  dimensionView.value = dimensionView.value === 'bars' ? 'radar' : 'bars';
  nextTick(() => emit('contentChange'));
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
