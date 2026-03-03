<template>
  <UiCollapsiblePanel
    class="toolkit-card"
    :title="t('toolkit.hardwareAdviceTitle')"
    v-model="openModel"
    single-header-preset="toolkit-collapse"
    title-class="toolkit-section-title"
    indicator-class="toolkit-collapse-indicator"
    @toggle="emit('contentChange')">
    <ul class="toolkit-advice-list">
      <li v-for="(item, index) in adviceList" :key="index" class="toolkit-advice-item">{{ item }}</li>
    </ul>
  </UiCollapsiblePanel>
</template>

<script setup lang="ts">
import { computed } from 'vue';
import { useI18n } from 'vue-i18n';

import UiCollapsiblePanel from '@/components/ui/CollapsiblePanel';

const props = defineProps<{
  modelValue: boolean;
  adviceList: string[];
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

const adviceList = computed(() => props.adviceList);
</script>
