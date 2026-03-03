<template>
  <pre v-if="contentType === 'text'" class="reminder-screen__text">{{ content }}</pre>
  <article v-else-if="contentType === 'markdown'" class="reminder-screen__markdown" v-html="markdownHtml"></article>
  <iframe
    v-else-if="contentType === 'web' && safeWebUrl"
    class="reminder-screen__web"
    :src="safeWebUrl"
    referrerpolicy="no-referrer"
    sandbox="allow-forms allow-popups allow-scripts"></iframe>
  <div v-else-if="contentType === 'web'" class="reminder-screen__blocked">
    <p>{{ t('toolkit.reminderScreenWebBlocked') }}</p>
    <code class="reminder-screen__blocked-url">{{ content || t('common.na') }}</code>
  </div>
  <img v-else-if="contentType === 'image' && safeImageUrl" class="reminder-screen__image" :src="safeImageUrl" :alt="title" />
  <div v-else-if="contentType === 'image'" class="reminder-screen__blocked">
    <p>{{ t('toolkit.reminderScreenImageBlocked') }}</p>
    <code class="reminder-screen__blocked-url">{{ content || t('common.na') }}</code>
  </div>
</template>

<script setup lang="ts">
import { computed } from 'vue';
import { useI18n } from 'vue-i18n';

import type { ReminderContentType } from '../../types';

const WEB_PROTOCOL_WHITELIST = new Set(['https:', 'http:']);
const IMAGE_PROTOCOL_WHITELIST = new Set(['https:', 'http:', 'data:', 'blob:']);

const props = defineProps<{
  contentType: ReminderContentType;
  title: string;
  content: string;
}>();

const { t } = useI18n();
const markdownHtml = computed(() => renderMarkdown(props.content));
const safeWebUrl = computed(() => sanitizeWebUrl(props.content));
const safeImageUrl = computed(() => sanitizeImageUrl(props.content));

function sanitizeWebUrl(raw: string): string | null {
  const parsed = parseUrl(raw);
  if (!parsed) return null;
  if (!WEB_PROTOCOL_WHITELIST.has(parsed.protocol)) return null;
  if (parsed.protocol === 'http:' && !isLoopbackHost(parsed.hostname)) {
    return null;
  }
  if (isPrivateNetworkHost(parsed.hostname) && !isLoopbackHost(parsed.hostname)) {
    return null;
  }
  return parsed.toString();
}

function sanitizeImageUrl(raw: string): string | null {
  const trimmed = raw.trim();
  if (!trimmed) return null;
  if (/^data:/i.test(trimmed)) {
    return /^data:image\//i.test(trimmed) ? trimmed : null;
  }
  const parsed = parseUrl(trimmed);
  if (!parsed) return null;
  if (!IMAGE_PROTOCOL_WHITELIST.has(parsed.protocol)) return null;
  if (parsed.protocol === 'http:' && !isLoopbackHost(parsed.hostname)) {
    return null;
  }
  return parsed.toString();
}

function parseUrl(raw: string): URL | null {
  const trimmed = raw.trim();
  if (!trimmed || trimmed.length > 4096) return null;
  try {
    return new URL(trimmed);
  } catch {
    return null;
  }
}

function isLoopbackHost(hostname: string): boolean {
  const normalized = hostname.trim().toLowerCase();
  return normalized === 'localhost' || normalized === '127.0.0.1' || normalized === '::1';
}

function isPrivateNetworkHost(hostname: string): boolean {
  const normalized = hostname.trim().toLowerCase();
  if (normalized === 'localhost' || normalized.endsWith('.local')) {
    return true;
  }
  const ipv4 = normalized.match(/^(\d{1,3})\.(\d{1,3})\.(\d{1,3})\.(\d{1,3})$/);
  if (!ipv4) return false;
  const octets = ipv4.slice(1).map(value => Number(value));
  if (octets.some(value => Number.isNaN(value) || value < 0 || value > 255)) return true;
  if (octets[0] === 10 || octets[0] === 127) return true;
  if (octets[0] === 192 && octets[1] === 168) return true;
  if (octets[0] === 169 && octets[1] === 254) return true;
  if (octets[0] === 172 && octets[1] >= 16 && octets[1] <= 31) return true;
  return false;
}

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

.reminder-screen__blocked {
  display: grid;
  gap: 10px;
  padding: 14px;
  border-radius: 12px;
  border: 1px dashed rgba(255, 148, 148, 0.65);
  background: rgba(255, 64, 64, 0.08);
  color: rgba(255, 188, 188, 0.96);
}

.reminder-screen__blocked p {
  margin: 0;
}

.reminder-screen__blocked-url {
  padding: 8px 10px;
  border-radius: 8px;
  border: 1px solid rgba(255, 255, 255, 0.18);
  background: rgba(0, 0, 0, 0.35);
  color: rgba(223, 239, 255, 0.96);
  font-family: 'JetBrains Mono', monospace;
  font-size: 13px;
  line-height: 1.45;
  word-break: break-all;
}
</style>
