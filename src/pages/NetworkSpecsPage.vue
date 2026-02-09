<template>
  <section class="page-grid">
    <article class="glass-panel page-header">
      <h2>{{ t("network.title") }}</h2>
      <p>Real-time latency and bandwidth diagnostics</p>
    </article>

    <article class="glass-panel full-width network-hero">
      <div class="network-gauge" :style="gaugeStyle">
        <div>
          <span>DOWNLOAD</span>
          <strong>{{ displayGauge.toFixed(0) }}</strong>
          <small>Mbps</small>
        </div>
      </div>
      <div class="network-hero-side">
        <div>
          <span>PING LATENCY</span>
          <strong>{{ pingAvg }}</strong>
        </div>
        <div>
          <span>UPLOAD SPEED</span>
          <strong>{{ upMbps.toFixed(2) }} Mbps</strong>
        </div>
        <div>
          <span>PACKET LOSS</span>
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
        Ping target
        <input v-model="pingTarget" />
      </label>
      <div class="row-actions">
        <button class="cyber-btn" @click="start" :disabled="running">{{ t("network.start") }}</button>
        <button @click="cancel" :disabled="!running">{{ t("network.cancel") }}</button>
        <button @click="runPing">{{ t("network.ping") }}</button>
      </div>
    </article>

    <article class="glass-panel stat-card">
      <h3>SPEED TEST TASK</h3>
      <p>Task: {{ activeTask || "-" }}</p>
      <p>Progress: {{ progressMbps }}</p>
      <p>Last Result: {{ speedResult }}</p>
      <p v-if="lastExportPath">Exported: {{ lastExportPath }}</p>
    </article>

    <article class="glass-panel stat-card">
      <h3>ACTIVE ENDPOINT</h3>
      <p>{{ endpoint }}</p>
      <p>Live down: {{ downMbps.toFixed(2) }} Mbps</p>
      <p>Live up: {{ upMbps.toFixed(2) }} Mbps</p>
    </article>

    <article class="glass-panel full-width">
      <h3>History</h3>
      <div class="row-actions">
        <button @click="loadHistory">Refresh History</button>
        <button @click="exportHistory">Export CSV</button>
      </div>
      <table>
        <thead>
          <tr>
            <th>Time</th>
            <th>Endpoint</th>
            <th>Download Mbps</th>
            <th>Latency</th>
          </tr>
        </thead>
        <tbody>
          <tr v-for="item in store.historyPage.items" :key="item.task_id + item.started_at">
            <td>{{ item.started_at }}</td>
            <td>{{ item.endpoint }}</td>
            <td>{{ item.download_mbps.toFixed(2) }}</td>
            <td>{{ item.latency_ms ?? "N/A" }}</td>
          </tr>
        </tbody>
      </table>
    </article>
  </section>
</template>

<script setup lang="ts">
import { computed, ref } from "vue";
import { useI18n } from "vue-i18n";

import { api, inTauri } from "../services/tauri";
import { useAppStore } from "../stores/app";

const { t } = useI18n();
const store = useAppStore();
const endpoint = ref(store.settings.speedtest_endpoints[0] ?? "");
const pingTarget = ref("8.8.8.8");
const lastExportPath = ref("");

const settings = computed(() => store.settings);
const running = computed(() => store.activeSpeedTaskId.length > 0);
const activeTask = computed(() => store.activeSpeedTaskId);
const downMbps = computed(() => store.snapshot.network.download_bytes_per_sec * 8 / 1_000_000);
const upMbps = computed(() => store.snapshot.network.upload_bytes_per_sec * 8 / 1_000_000);
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

async function start() {
  await store.startSpeedTest({ endpoint: endpoint.value, max_seconds: 8 });
}

async function cancel() {
  await store.cancelSpeedTest();
}

async function runPing() {
  await store.runPing(pingTarget.value, 4);
}

async function loadHistory() {
  await store.queryHistory({ page: 1, page_size: 20 });
}

async function exportHistory() {
  if (!inTauri()) {
    lastExportPath.value = "Tauri runtime required";
    return;
  }
  const result = await api.exportHistoryCsv({});
  lastExportPath.value = result.path;
}
</script>
