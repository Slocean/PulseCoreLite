<template>
  <UiCollapsiblePanel
    class="toolkit-card"
    :title="t('toolkit.dimensionTitle')"
    v-model="openModel"
    header-mode="split"
    header-class="toolkit-section-header"
    split-title-preset="toolkit-collapse-title"
    split-toggle-preset="toolkit-collapse-icon"
    title-class="toolkit-section-title"
    indicator-class="toolkit-collapse-indicator"
    :toggle-aria-label="t('toolkit.dimensionTitle')"
    @toggle="emit('contentChange')">
    <template #header-actions>
      <UiButton
        native-type="button"
        preset="toolkit-view-toggle"
        :aria-label="dimensionViewLabel"
        @click="emit('toggleView')">
        <span class="material-symbols-outlined">{{ dimensionViewIcon }}</span>
        <span class="toolkit-view-toggle-text">{{ dimensionViewLabel }}</span>
      </UiButton>
    </template>
    <div>
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
            <polygon v-for="ring in radarGridPolygons" :key="ring.step" class="toolkit-radar-grid" :points="ring.points" />
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
  </UiCollapsiblePanel>
</template>

<script setup lang="ts">
import { computed } from 'vue';
import { useI18n } from 'vue-i18n';

import UiButton from '@/components/ui/Button';
import UiCollapsiblePanel from '@/components/ui/CollapsiblePanel';
import { RADAR_CENTER } from './hardwareScoring';

type DimensionScoreItem = {
  id: string;
  title: string;
  score: number;
  level: string;
  summary: string;
  badgeClass: string;
  color: string;
};

type RadarAxis = {
  x: number;
  y: number;
  labelX: number;
  labelY: number;
  label: string;
  anchor: string;
  baseline: string;
};

type RadarGridPolygon = {
  step: number;
  points: string;
};

type RadarDot = {
  x: number;
  y: number;
};

const props = defineProps<{
  modelValue: boolean;
  dimensionView: 'bars' | 'radar';
  dimensionViewLabel: string;
  dimensionViewIcon: string;
  dimensionScores: DimensionScoreItem[];
  radarAxes: RadarAxis[];
  radarGridPolygons: RadarGridPolygon[];
  radarValuePoints: string;
  radarValueDots: RadarDot[];
}>();

const emit = defineEmits<{
  (event: 'update:modelValue', value: boolean): void;
  (event: 'toggleView'): void;
  (event: 'contentChange'): void;
}>();

const { t } = useI18n();

const openModel = computed({
  get: () => props.modelValue,
  set: value => emit('update:modelValue', value)
});

const dimensionView = computed(() => props.dimensionView);
const dimensionViewLabel = computed(() => props.dimensionViewLabel);
const dimensionViewIcon = computed(() => props.dimensionViewIcon);
const dimensionScores = computed(() => props.dimensionScores);
const radarAxes = computed(() => props.radarAxes);
const radarGridPolygons = computed(() => props.radarGridPolygons);
const radarValuePoints = computed(() => props.radarValuePoints);
const radarValueDots = computed(() => props.radarValueDots);
</script>
