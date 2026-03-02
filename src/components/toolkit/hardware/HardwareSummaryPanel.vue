<template>
  <UiCollapsiblePanel
    class="toolkit-card"
    :title="t('toolkit.hardwareSummaryTitle')"
    v-model="openModel"
    single-header-preset="toolkit-collapse"
    title-class="toolkit-section-title"
    indicator-class="toolkit-collapse-indicator"
    @toggle="emit('contentChange')">
    <div class="toolkit-summary-grid">
      <div v-for="row in rows" :key="row.id" class="toolkit-summary-item">
        <span class="toolkit-summary-label">{{ row.label }}</span>
        <span class="toolkit-summary-value">{{ row.value }}</span>
      </div>
    </div>
  </UiCollapsiblePanel>
</template>

<script setup lang="ts">
import { computed } from 'vue';
import { useI18n } from 'vue-i18n';

import UiCollapsiblePanel from '@/components/ui/CollapsiblePanel';

type SummaryRow = {
  id: string;
  label: string;
  value: string;
};

const props = defineProps<{
  modelValue: boolean;
  rows: SummaryRow[];
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

const rows = computed(() => props.rows);
</script>
