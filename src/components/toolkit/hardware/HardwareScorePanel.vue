<template>
  <UiCollapsiblePanel
    class="toolkit-card toolkit-card--score"
    :title="t('toolkit.hardwareScoreTitle')"
    v-model="openModel"
    single-header-preset="toolkit-collapse"
    title-class="toolkit-section-title"
    indicator-class="toolkit-collapse-indicator"
    @toggle="emit('contentChange')">
    <div>
      <div class="toolkit-score-ring" :style="scoreRingStyle">
        <div class="toolkit-score-center">
          <div class="toolkit-score-value">{{ totalScore }}</div>
          <div class="toolkit-score-grade">{{ totalGrade }}</div>
        </div>
      </div>
      <div class="toolkit-score-caption">{{ totalGradeLabel }}</div>
      <p class="toolkit-score-desc">{{ totalSummary }}</p>
    </div>
  </UiCollapsiblePanel>
</template>

<script setup lang="ts">
import { computed } from 'vue';
import { useI18n } from 'vue-i18n';

import UiCollapsiblePanel from '@/components/ui/CollapsiblePanel';

const props = defineProps<{
  modelValue: boolean;
  totalScore: number;
  totalGrade: string;
  totalGradeLabel: string;
  totalSummary: string;
  scoreRingStyle: Record<string, string>;
}>();

const emit = defineEmits<{
  (event: 'update:modelValue', value: boolean): void;
  (event: 'contentChange'): void;
}>();

const { t } = useI18n();

const openModel = computed({
  get: () => props.modelValue,
  set: value => emit('update:modelValue', value)
});

const totalScore = computed(() => props.totalScore);
const totalGrade = computed(() => props.totalGrade);
const totalGradeLabel = computed(() => props.totalGradeLabel);
const totalSummary = computed(() => props.totalSummary);
const scoreRingStyle = computed(() => props.scoreRingStyle);
</script>
