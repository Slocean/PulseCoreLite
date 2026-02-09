<template>
  <section class="page-grid">
    <article class="glass-panel page-header">
      <h2>{{ t("network.title") }}</h2>
      <p>HTTP download speed test + ping latency</p>
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
        <button @click="start" :disabled="running">{{ t("network.start") }}</button>
        <button @click="cancel" :disabled="!running">{{ t("network.cancel") }}</button>
        <button @click="runPing">{{ t("network.ping") }}</button>
      </div>
    </article>

    <article class="glass-panel stat-card">
      <h3>Speed Test</h3>
      <p>Task: {{ activeTask || "-" }}</p>
      <p>Progress: {{ progressMbps }}</p>
      <p>Result: {{ speedResult }}</p>
    </article>

    <article class="glass-panel stat-card">
      <h3>Ping</h3>
      <p>Target: {{ pingTarget }}</p>
      <p>Avg: {{ pingAvg }}</p>
      <p>Loss: {{ pingLoss }}</p>
    </article>

    <article class="glass-panel full-width">
      <h3>History</h3>
      <button @click="loadHistory">Refresh History</button>
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

import { useAppStore } from "../stores/app";

const { t } = useI18n();
const store = useAppStore();
const endpoint = ref(store.settings.speedtest_endpoints[0] ?? "");
const pingTarget = ref("8.8.8.8");

const settings = computed(() => store.settings);
const running = computed(() => store.activeSpeedTaskId.length > 0);
const activeTask = computed(() => store.activeSpeedTaskId);
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
</script>
