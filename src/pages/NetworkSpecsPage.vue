<template>
  <section class="page-grid">
    <article class="glass-panel page-header">
      <h2>{{ t("network.title") }}</h2>
      <p>{{ t("network.subtitle") }}</p>
    </article>

    <article class="glass-panel full-width network-hero">
      <div class="network-gauge" :style="gaugeStyle">
        <div>
          <span>{{ t("network.download") }}</span>
          <strong>{{ displayGauge.toFixed(0) }}</strong>
          <small>Mbps</small>
        </div>
      </div>
      <div class="network-hero-side">
        <div>
          <span>{{ t("network.pingLatency") }}</span>
          <strong>{{ pingAvg }}</strong>
        </div>
        <div>
          <span>{{ t("network.uploadSpeed") }}</span>
          <strong>{{ upMbps.toFixed(2) }} Mbps</strong>
        </div>
        <div>
          <span>{{ t("network.packetLoss") }}</span>
          <strong>{{ pingLoss }}</strong>
        </div>
      </div>
    </article>

    <article class="glass-panel control-card">
      <label>
        {{ t("network.endpoint") }}
        <select v-model="endpoint">
          <option v-for="item in settings.speedtest_endpoints" :key="item" :value="item">{{ item }}</option>
        </select>
      </label>
      <label>
        {{ t("network.pingTarget") }}
        <input v-model="pingTarget" />
      </label>
      <div class="row-actions">
        <button class="cyber-btn" @click="start" :disabled="running">{{ t("network.start") }}</button>
        <button @click="cancel" :disabled="!running">{{ t("network.cancel") }}</button>
        <button @click="runPing">{{ t("network.ping") }}</button>
      </div>
    </article>

    <article class="glass-panel stat-card">
      <h3>{{ t("network.taskCard") }}</h3>
      <p>{{ t("network.task") }}: {{ activeTask || "-" }}</p>
      <p>{{ t("network.progress") }}: {{ progressMbps }}</p>
      <p>{{ t("network.lastResult") }}: {{ speedResult }}</p>
      <p v-if="lastExportPath">{{ t("network.exported") }}: {{ lastExportPath }}</p>
    </article>

    <article class="glass-panel stat-card">
      <h3>{{ t("network.activeEndpoint") }}</h3>
      <p>{{ endpoint }}</p>
      <p>{{ t("network.liveDown") }}: {{ downMbps.toFixed(2) }} Mbps</p>
      <p>{{ t("network.liveUp") }}: {{ upMbps.toFixed(2) }} Mbps</p>
    </article>

    <article class="glass-panel full-width">
      <h3>{{ t("network.history") }}</h3>

      <div class="history-filters">
        <label>
          {{ t("network.from") }}
          <input v-model="fromDate" type="date" />
        </label>
        <label>
          {{ t("network.to") }}
          <input v-model="toDate" type="date" />
        </label>
        <label>
          {{ t("network.pageSize") }}
          <select v-model.number="pageSize">
            <option :value="10">10</option>
            <option :value="20">20</option>
            <option :value="50">50</option>
          </select>
        </label>
      </div>

      <div class="row-actions">
        <button @click="applyHistoryFilter">{{ t("network.applyFilter") }}</button>
        <button @click="clearHistoryFilter">{{ t("network.clearFilter") }}</button>
        <button @click="exportHistory">{{ t("network.exportCsv") }}</button>
      </div>

      <table>
        <thead>
          <tr>
            <th>{{ t("network.time") }}</th>
            <th>{{ t("network.endpoint") }}</th>
            <th>{{ t("network.downloadMbps") }}</th>
            <th>{{ t("network.latency") }}</th>
          </tr>
        </thead>
        <tbody>
          <tr v-if="store.historyLoading">
            <td colspan="4">{{ t("common.loading") }}</td>
          </tr>
          <tr v-else-if="store.historyPage.items.length === 0">
            <td colspan="4">{{ t("network.noHistory") }}</td>
          </tr>
          <tr v-else v-for="item in store.historyPage.items" :key="item.task_id + item.started_at">
            <td>{{ item.started_at }}</td>
            <td>{{ item.endpoint }}</td>
            <td>{{ item.download_mbps.toFixed(2) }}</td>
            <td>{{ item.latency_ms == null ? t("common.na") : item.latency_ms.toFixed(2) }}</td>
          </tr>
        </tbody>
      </table>

      <div class="pagination">
        <button @click="goToPage(currentPage - 1)" :disabled="currentPage <= 1">{{ t("network.prev") }}</button>
        <span>{{ t("network.pageInfo", { page: currentPage, total: totalPages, rows: store.historyPage.total }) }}</span>
        <button @click="goToPage(currentPage + 1)" :disabled="currentPage >= totalPages">{{ t("network.next") }}</button>
      </div>
    </article>
  </section>
</template>

<script setup lang="ts">
import { computed, ref, watch } from "vue";
import { useI18n } from "vue-i18n";

import { api, inTauri } from "../services/tauri";
import { useAppStore } from "../stores/app";

const { t } = useI18n();
const store = useAppStore();
const endpoint = ref(store.settings.speedtest_endpoints[0] ?? "");
const pingTarget = ref("8.8.8.8");
const lastExportPath = ref("");
const fromDate = ref("");
const toDate = ref("");
const pageSize = ref(store.historyFilter.page_size);

const settings = computed(() => store.settings);
const running = computed(() => store.activeSpeedTaskId.length > 0);
const activeTask = computed(() => store.activeSpeedTaskId);
const downMbps = computed(() => (store.snapshot.network.download_bytes_per_sec * 8) / 1_000_000);
const upMbps = computed(() => (store.snapshot.network.upload_bytes_per_sec * 8) / 1_000_000);
const currentPage = computed(() => store.historyFilter.page);
const totalPages = computed(() => store.totalHistoryPages);

watch(
  () => store.settings.speedtest_endpoints,
  (next) => {
    if (!next.includes(endpoint.value)) {
      endpoint.value = next[0] ?? "";
    }
  },
  { deep: true }
);

const displayGauge = computed(() => {
  if (store.lastSpeedResult) {
    return store.lastSpeedResult.download_mbps;
  }
  if (store.speedProgress) {
    return store.speedProgress.download_mbps;
  }
  return downMbps.value;
});

const gaugeStyle = computed(() => {
  const normalized = Math.max(0, Math.min(100, displayGauge.value / 10));
  return {
    background: `conic-gradient(#ccff00 ${normalized * 3.6}deg, rgba(255,255,255,0.1) 0deg)`
  };
});

const progressMbps = computed(() => {
  if (!store.speedProgress) {
    return "-";
  }
  return `${store.speedProgress.download_mbps.toFixed(2)} Mbps`;
});

const speedResult = computed(() => {
  if (!store.lastSpeedResult) {
    return "-";
  }
  return `${store.lastSpeedResult.download_mbps.toFixed(2)} Mbps`;
});

const pingAvg = computed(() => (store.lastPingResult?.avg_ms == null ? "-" : `${store.lastPingResult.avg_ms.toFixed(2)} ms`));
const pingLoss = computed(() => (store.lastPingResult?.loss_pct == null ? "-" : `${store.lastPingResult.loss_pct.toFixed(2)} %`));

function toStartIso(value: string): string | undefined {
  if (!value) {
    return undefined;
  }
  return new Date(`${value}T00:00:00`).toISOString();
}

function toEndIso(value: string): string | undefined {
  if (!value) {
    return undefined;
  }
  return new Date(`${value}T23:59:59`).toISOString();
}

async function start() {
  await store.startSpeedTest({ endpoint: endpoint.value, max_seconds: 8 });
}

async function cancel() {
  await store.cancelSpeedTest();
}

async function runPing() {
  await store.runPing(pingTarget.value, 4);
}

async function goToPage(page: number) {
  const clamped = Math.max(1, Math.min(totalPages.value, page));
  await store.queryHistory({
    page: clamped,
    page_size: pageSize.value,
    from: toStartIso(fromDate.value),
    to: toEndIso(toDate.value)
  });
}

async function applyHistoryFilter() {
  await store.queryHistory({
    page: 1,
    page_size: pageSize.value,
    from: toStartIso(fromDate.value),
    to: toEndIso(toDate.value)
  });
}

async function clearHistoryFilter() {
  fromDate.value = "";
  toDate.value = "";
  pageSize.value = 10;
  await store.queryHistory({
    page: 1,
    page_size: pageSize.value,
    from: undefined,
    to: undefined
  });
}

async function exportHistory() {
  const range = {
    from: toStartIso(fromDate.value),
    to: toEndIso(toDate.value)
  };

  if (!inTauri()) {
    lastExportPath.value = t("network.tauriRequired");
    return;
  }

  const result = await api.exportHistoryCsv(range);
  lastExportPath.value = result.path;
}
</script>
