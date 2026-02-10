<template>
  <div ref="el" class="chart"></div>
</template>

<script setup lang="ts">
import { onMounted, onUnmounted, ref, watch } from "vue";
import * as echarts from "echarts";

const props = defineProps<{
  values: number[];
  color: string;
}>();

const el = ref<HTMLElement | null>(null);
let chart: echarts.ECharts | null = null;

function handleResize() {
  chart?.resize();
}

function render() {
  if (!chart) {
    return;
  }

  chart.setOption({
    animation: true,
    backgroundColor: "transparent",
    grid: { left: 24, right: 18, top: 18, bottom: 24 },
    xAxis: {
      type: "category",
      data: props.values.map((_, idx) => idx + 1),
      axisLine: { show: false },
      axisTick: { show: false },
      axisLabel: { show: false }
    },
    yAxis: {
      type: "value",
      axisLine: { show: false },
      axisTick: { show: false },
      splitLine: { lineStyle: { color: "rgba(255,255,255,0.08)" } },
      axisLabel: { color: "#a3b5e8", fontSize: 11, fontWeight: 600 }
    },
    series: [
      {
        type: "line",
        data: props.values,
        smooth: true,
        symbol: "none",
        lineStyle: { width: 2.4, color: props.color },
        areaStyle: {
          color: new echarts.graphic.LinearGradient(0, 0, 0, 1, [
            { offset: 0, color: `${props.color}66` },
            { offset: 1, color: `${props.color}11` }
          ])
        }
      }
    ]
  });
}

onMounted(() => {
  if (!el.value) {
    return;
  }
  chart = echarts.init(el.value);
  render();
  window.addEventListener("resize", handleResize);
});

onUnmounted(() => {
  window.removeEventListener("resize", handleResize);
  chart?.dispose();
  chart = null;
});

watch(() => [props.values, props.color], render, { deep: true });
</script>
