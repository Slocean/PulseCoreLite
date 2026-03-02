<template>
  <section class="reminder-screen" @contextmenu.prevent>
    <div class="reminder-screen__inner">
      <div class="reminder-screen__badge">TASK REMINDER</div>
      <h1 class="reminder-screen__title">{{ title }}</h1>
      <div class="reminder-screen__content">
        <pre v-if="contentType === 'text'" class="reminder-screen__text">{{ content }}</pre>
        <article v-else-if="contentType === 'markdown'" class="reminder-screen__markdown" v-html="markdownHtml"></article>
        <iframe
          v-else-if="contentType === 'web'"
          class="reminder-screen__web"
          :src="content"
          referrerpolicy="no-referrer"></iframe>
        <img v-else-if="contentType === 'image'" class="reminder-screen__image" :src="content" :alt="title" />
      </div>
      <div class="reminder-screen__hint">This reminder is locked by policy.</div>
    </div>
  </section>
</template>

<script setup lang="ts">
import { computed, onMounted, ref } from 'vue';

import { readReminderScreenPayload } from '../composables/useTaskReminders';
import type { ReminderContentType } from '../types';

const contentType = ref<ReminderContentType>('text');
const title = ref('Task Reminder');
const content = ref('');

const markdownHtml = computed(() => renderMarkdown(content.value));

onMounted(async () => {
  const params = new URLSearchParams(window.location.search);
  const token = params.get('token');
  const payload = readReminderScreenPayload(token);
  if (payload) {
    title.value = payload.title || title.value;
    content.value = payload.content || '';
    contentType.value = payload.contentType;
  }

  if ('keyboard' in navigator && typeof (navigator as any).keyboard?.lock === 'function') {
    try {
      await (navigator as any).keyboard.lock(['Escape']);
    } catch {
      // ignore
    }
  }

  try {
    const { getCurrentWindow } = await import('@tauri-apps/api/window');
    const current = getCurrentWindow();
    await current.setAlwaysOnTop(true);
    await current.setFocus();
    await current.onCloseRequested(event => {
      event.preventDefault();
    });
  } catch {
    // ignore
  }
});

function escapeHtml(value: string) {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function renderMarkdown(raw: string) {
  const escaped = escapeHtml(raw);
  return escaped
    .replace(/^###\s+(.+)$/gm, '<h3>$1</h3>')
    .replace(/^##\s+(.+)$/gm, '<h2>$1</h2>')
    .replace(/^#\s+(.+)$/gm, '<h1>$1</h1>')
    .replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>')
    .replace(/\*(.+?)\*/g, '<em>$1</em>')
    .replace(/\[(.+?)\]\((.+?)\)/g, '<a href="$2" target="_blank" rel="noreferrer">$1</a>')
    .replace(/\n/g, '<br />');
}
</script>

<style scoped>
.reminder-screen {
  min-height: 100vh;
  width: 100vw;
  display: grid;
  place-items: center;
  background:
    radial-gradient(140% 120% at 20% 10%, rgba(0, 242, 255, 0.18), rgba(0, 0, 0, 0) 60%),
    radial-gradient(140% 120% at 80% 90%, rgba(255, 72, 112, 0.2), rgba(0, 0, 0, 0) 62%),
    #05070b;
  color: rgba(243, 247, 255, 0.96);
  padding: 3vw;
}

.reminder-screen__inner {
  width: min(1100px, 100%);
  max-height: 100%;
  display: grid;
  gap: 20px;
}

.reminder-screen__badge {
  width: fit-content;
  padding: 6px 12px;
  border-radius: 999px;
  border: 1px dashed rgba(0, 242, 255, 0.68);
  color: rgba(0, 242, 255, 0.92);
  letter-spacing: 0.18em;
  font-size: clamp(11px, 1vw, 14px);
}

.reminder-screen__title {
  margin: 0;
  font-size: clamp(30px, 5vw, 64px);
  line-height: 1.04;
  letter-spacing: 0.04em;
  text-transform: uppercase;
}

.reminder-screen__content {
  min-height: 45vh;
  border-radius: 18px;
  border: 1px solid rgba(255, 255, 255, 0.18);
  background: rgba(0, 0, 0, 0.5);
  padding: clamp(16px, 2.2vw, 28px);
  overflow: auto;
}

.reminder-screen__text,
.reminder-screen__markdown {
  margin: 0;
  font-size: clamp(18px, 1.8vw, 30px);
  line-height: 1.6;
  white-space: pre-wrap;
  word-break: break-word;
}

.reminder-screen__markdown :deep(a) {
  color: rgba(0, 242, 255, 0.96);
}

.reminder-screen__web {
  width: 100%;
  height: 64vh;
  border: 1px solid rgba(255, 255, 255, 0.2);
  border-radius: 12px;
  background: rgba(0, 0, 0, 0.4);
}

.reminder-screen__image {
  width: 100%;
  max-height: 72vh;
  object-fit: contain;
}

.reminder-screen__hint {
  justify-self: center;
  padding: 8px 12px;
  font-size: 13px;
  border-radius: 999px;
  letter-spacing: 0.08em;
  color: rgba(255, 173, 173, 0.95);
  border: 1px dashed rgba(255, 140, 140, 0.68);
  background: rgba(255, 72, 112, 0.08);
}
</style>
