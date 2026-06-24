<template>
  <UiToast channel="toolkit" />

  <UiCollapsiblePanel
    class="toolkit-card"
    :title="t('steamMarket.sessionTitle')"
    :collapsible="false"
    title-class="toolkit-section-title">
    <p class="toolkit-steam-market-note">{{ t('steamMarket.sessionHint') }}</p>

    <div class="toolkit-steam-market-summary">
      <div class="toolkit-steam-market-stat">
        <span class="overlay-config-label">{{ t('steamMarket.loginStatus') }}</span>
        <span class="toolkit-steam-market-value">{{ loginStatusText }}</span>
      </div>
      <div class="toolkit-steam-market-stat">
        <span class="overlay-config-label">{{ t('steamMarket.steamAccount') }}</span>
        <span class="toolkit-steam-market-value">{{ session.steamId ?? t('steamMarket.notLoggedIn') }}</span>
      </div>
      <div class="toolkit-steam-market-stat">
        <span class="overlay-config-label">{{ t('steamMarket.currency') }}</span>
        <span class="toolkit-steam-market-value">{{ session.currencyLabel ?? '--' }}</span>
      </div>
    </div>

    <div class="toolkit-steam-market-actions">
      <UiButton
        native-type="button"
        preset="overlay-primary"
        :disabled="busy || !runtimeSupported"
        @click="startLogin">
        {{ t('steamMarket.loginBtn') }}
      </UiButton>
      <UiButton
        native-type="button"
        preset="overlay-primary"
        :disabled="busy || !runtimeSupported || !session.loginWindowOpen"
        @click="captureLogin">
        {{ t('steamMarket.captureLoginBtn') }}
      </UiButton>
      <UiButton
        native-type="button"
        preset="overlay-primary"
        :disabled="busy || !runtimeSupported"
        @click="refreshSession">
        {{ t('steamMarket.refreshSessionBtn') }}
      </UiButton>
      <UiButton
        native-type="button"
        preset="overlay-primary"
        :disabled="busy || !session.loggedIn"
        @click="clearSession">
        {{ t('steamMarket.logoutBtn') }}
      </UiButton>
    </div>

    <UiCollapsiblePanel
      class="toolkit-card toolkit-steam-market-advanced"
      :title="t('steamMarket.advancedTitle')"
      :default-open="false"
      title-class="toolkit-section-title">
      <p class="toolkit-profile-hint">{{ t('steamMarket.advancedHint') }}</p>
      <textarea
        v-model="cookieRaw"
        class="overlay-config-input toolkit-steam-market-cookie-input"
        :placeholder="t('steamMarket.cookiePlaceholder')" />
      <UiButton
        native-type="button"
        preset="overlay-primary"
        :disabled="busy || !runtimeSupported || !cookieRaw.trim()"
        @click="saveCookieFallback">
        {{ t('steamMarket.saveCookieBtn') }}
      </UiButton>
    </UiCollapsiblePanel>

    <p v-if="!runtimeSupported" class="toolkit-error">{{ t('steamMarket.requireDesktop') }}</p>
  </UiCollapsiblePanel>

  <UiCollapsiblePanel
    class="toolkit-card"
    :title="t('steamMarket.inventoryTitle')"
    :collapsible="false"
    title-class="toolkit-section-title">
    <div class="toolkit-steam-market-actions">
      <UiButton
        native-type="button"
        preset="overlay-primary"
        :disabled="busy || !session.loggedIn"
        @click="scanInventory">
        {{ t('steamMarket.scanInventoryBtn') }}
      </UiButton>
      <UiButton
        native-type="button"
        preset="overlay-primary"
        :disabled="busy || !selectedItemIds.length"
        @click="refreshPrices">
        {{ t('steamMarket.refreshPricesBtn') }}
      </UiButton>
      <UiButton
        native-type="button"
        preset="overlay-primary"
        :disabled="busy || !syncableItemIds.length"
        @click="selectAllItems">
        {{ t('steamMarket.selectAllBtn') }}
      </UiButton>
      <UiButton
        native-type="button"
        preset="overlay-primary"
        :disabled="busy || !selectedItemIds.length"
        @click="clearSelection">
        {{ t('steamMarket.clearSelectionBtn') }}
      </UiButton>
    </div>

    <div v-if="inventoryWarnings.length" class="toolkit-game-sync-warning-list">
      <div v-for="warning in inventoryWarnings" :key="warning" class="toolkit-game-sync-warning">
        {{ warning }}
      </div>
    </div>

    <div v-if="!inventoryItems.length" class="toolkit-steam-market-empty">
      {{ t('steamMarket.inventoryEmpty') }}
    </div>

    <div v-else class="toolkit-steam-market-list">
      <UiCheckbox
        v-for="item in inventoryItems"
        :key="item.id"
        v-model="selectedItemIds"
        class="toolkit-steam-market-item"
        :value="item.id"
        :disabled="busy">
        <div class="toolkit-steam-market-card">
          <div class="toolkit-steam-market-card-head">
            <span class="toolkit-steam-market-name">{{ item.name }}</span>
            <span class="toolkit-steam-market-meta">{{ item.appId }}/{{ item.contextId }}</span>
          </div>
          <div class="toolkit-steam-market-meta">{{ item.marketHashName }}</div>
          <div v-if="priceText(item.id)" class="toolkit-steam-market-price">
            {{ priceText(item.id) }}
          </div>
        </div>
      </UiCheckbox>
    </div>
  </UiCollapsiblePanel>

  <UiCollapsiblePanel
    class="toolkit-card"
    :title="t('steamMarket.strategyTitle')"
    :collapsible="false"
    title-class="toolkit-section-title">
    <div class="toolkit-steam-market-strategy">
      <div class="toolkit-steam-market-strategy-row">
        <span class="overlay-config-label">{{ t('steamMarket.strategyMode') }}</span>
        <UiSelect v-model="strategyMode" :options="strategyOptions" />
      </div>
      <div v-if="strategyMode === 'fixedDiscount'" class="toolkit-steam-market-strategy-row">
        <span class="overlay-config-label">{{ t('steamMarket.discountCents') }}</span>
        <input
          v-model.number="discountCents"
          type="number"
          min="0"
          step="1"
          class="overlay-config-input" />
      </div>
      <div v-if="strategyMode === 'percentDiscount'" class="toolkit-steam-market-strategy-row">
        <span class="overlay-config-label">{{ t('steamMarket.discountPercent') }}</span>
        <input
          v-model.number="discountPercent"
          type="number"
          min="0"
          max="95"
          step="0.1"
          class="overlay-config-input" />
      </div>
    </div>

    <div class="toolkit-steam-market-actions">
      <UiButton
        native-type="button"
        preset="overlay-primary"
        :disabled="busy || !selectedItemIds.length"
        @click="previewPlan">
        {{ t('steamMarket.previewBtn') }}
      </UiButton>
      <UiButton
        native-type="button"
        preset="overlay-primary"
        :disabled="busy || !canSell"
        @click="sellSelected">
        {{ sellButtonText }}
      </UiButton>
    </div>

    <div v-if="planItems.length" class="toolkit-steam-market-list">
      <div v-for="plan in planItems" :key="plan.item.id" class="toolkit-steam-market-item">
        <div class="toolkit-steam-market-card">
          <div class="toolkit-steam-market-name">{{ plan.item.name }}</div>
          <div v-if="plan.skipped" class="toolkit-game-sync-warning">
            {{ plan.skipReason ?? t('steamMarket.planSkipped') }}
          </div>
          <div v-else class="toolkit-steam-market-price">
            {{ t('steamMarket.planPrice', {
              seller: formatMoney(plan.sellerReceivesCents),
              buyer: plan.buyerPaysCents ? formatMoney(plan.buyerPaysCents) : '--'
            }) }}
          </div>
        </div>
      </div>
    </div>
  </UiCollapsiblePanel>
</template>

<script setup lang="ts">
import { computed, nextTick, onMounted, onUnmounted, ref, watch } from 'vue';
import { useI18n } from 'vue-i18n';

import UiButton from '@/components/ui/Button';
import UiCheckbox from '@/components/ui/Checkbox';
import UiCollapsiblePanel from '@/components/ui/CollapsiblePanel';
import UiSelect from '@/components/ui/Select';
import UiToast from '@/components/ui/Toast';
import { useToastService } from '@/composables/useToastService';
import { api, inTauri, listenEvent } from '@/services/tauri';
import type {
  SteamMarketItem,
  SteamMarketPriceQuote,
  SteamMarketSellPlanItem,
  SteamMarketSellStrategy,
  SteamMarketSessionStatus
} from '@/types';

const emit = defineEmits<{
  (event: 'contentChange'): void;
}>();

const { t } = useI18n();
const { showToast } = useToastService('toolkit');
const runtimeSupported = computed(() => inTauri());
const busy = ref(false);
const cookieRaw = ref('');
const session = ref<SteamMarketSessionStatus>({
  loggedIn: false,
  steamId: null,
  personaName: null,
  currencyLabel: null,
  savedAt: null,
  loginWindowOpen: false,
  message: null
});
const inventoryItems = ref<SteamMarketItem[]>([]);
const inventoryWarnings = ref<string[]>([]);
const selectedItemIds = ref<string[]>([]);
const priceQuotes = ref<Record<string, SteamMarketPriceQuote>>({});
const planItems = ref<SteamMarketSellPlanItem[]>([]);
const strategyMode = ref<SteamMarketSellStrategy['mode']>('lowestSell');
const discountCents = ref(10);
const discountPercent = ref(5);
let unlistenLoginSuccess: (() => void) | null = null;

const strategyOptions = computed(() => [
  { value: 'lowestSell', label: t('steamMarket.modeLowestSell') },
  { value: 'highestBuy', label: t('steamMarket.modeHighestBuy') },
  { value: 'fixedDiscount', label: t('steamMarket.modeFixedDiscount') },
  { value: 'percentDiscount', label: t('steamMarket.modePercentDiscount') }
]);

const syncableItemIds = computed(() => inventoryItems.value.map(item => item.id));
const loginStatusText = computed(() => {
  if (session.value.loginWindowOpen) return t('steamMarket.statusLoginWindow');
  if (session.value.loggedIn) return t('steamMarket.statusLoggedIn');
  return session.value.message ?? t('steamMarket.notLoggedIn');
});
const canSell = computed(
  () =>
    session.value.loggedIn &&
    planItems.value.some(plan => !plan.skipped) &&
    selectedItemIds.value.length > 0
);
const sellButtonText = computed(() => (busy.value ? t('steamMarket.selling') : t('steamMarket.sellBtn')));

onMounted(async () => {
  if (!runtimeSupported.value) return;
  await refreshSession();
  unlistenLoginSuccess = await listenEvent<SteamMarketSessionStatus>('steam-market-login-success', payload => {
    session.value = payload;
    showToast(t('steamMarket.loginSuccess'), { variant: 'success' });
  });
});

onUnmounted(() => {
  unlistenLoginSuccess?.();
});

watch(
  [busy, selectedItemIds, inventoryItems, planItems, strategyMode, discountCents, discountPercent],
  () => {
    nextTick(() => emit('contentChange'));
  },
  { deep: true }
);

async function refreshSession() {
  if (!runtimeSupported.value) return;
  try {
    session.value = await api.getSteamMarketSessionStatus();
  } catch (error) {
    showToast(normalizeErrorMessage(error), { variant: 'error' });
  }
}

async function startLogin() {
  busy.value = true;
  try {
    await api.startSteamMarketLogin();
    await refreshSession();
    showToast(t('steamMarket.loginWindowOpened'), { variant: 'info' });
  } catch (error) {
    showToast(normalizeErrorMessage(error), { variant: 'error' });
  } finally {
    busy.value = false;
  }
}

async function captureLogin() {
  busy.value = true;
  try {
    session.value = await api.captureSteamMarketLogin();
    showToast(t('steamMarket.loginSuccess'), { variant: 'success' });
  } catch (error) {
    showToast(normalizeErrorMessage(error), { variant: 'error' });
  } finally {
    busy.value = false;
  }
}

async function clearSession() {
  busy.value = true;
  try {
    await api.clearSteamMarketSession();
    session.value = {
      loggedIn: false,
      steamId: null,
      personaName: null,
      currencyLabel: null,
      savedAt: null,
      loginWindowOpen: false,
      message: t('steamMarket.notLoggedIn')
    };
    inventoryItems.value = [];
    inventoryWarnings.value = [];
    selectedItemIds.value = [];
    priceQuotes.value = {};
    planItems.value = [];
  } catch (error) {
    showToast(normalizeErrorMessage(error), { variant: 'error' });
  } finally {
    busy.value = false;
  }
}

async function saveCookieFallback() {
  const parsed = parseCookieRaw(cookieRaw.value);
  if (!parsed.sessionId || !parsed.steamLoginSecure) {
    showToast(t('steamMarket.cookieInvalid'), { variant: 'warning' });
    return;
  }
  busy.value = true;
  try {
    session.value = await api.saveSteamMarketSession({
      sessionId: parsed.sessionId,
      steamLoginSecure: parsed.steamLoginSecure,
      steamCountry: parsed.steamCountry
    });
    showToast(t('steamMarket.loginSuccess'), { variant: 'success' });
  } catch (error) {
    showToast(normalizeErrorMessage(error), { variant: 'error' });
  } finally {
    busy.value = false;
  }
}

async function scanInventory() {
  busy.value = true;
  const previous = new Set(selectedItemIds.value);
  try {
    const result = await api.scanSteamMarketInventory();
    inventoryItems.value = result.groups.flatMap(group => group.items);
    inventoryWarnings.value = result.warnings;
    selectedItemIds.value = inventoryItems.value
      .map(item => item.id)
      .filter(id => previous.has(id));
    priceQuotes.value = {};
    planItems.value = [];
    showToast(
      result.totalMarketable
        ? t('steamMarket.scanSuccess', { count: result.totalMarketable })
        : t('steamMarket.scanEmpty'),
      { variant: result.totalMarketable ? 'success' : 'warning' }
    );
  } catch (error) {
    showToast(t('steamMarket.scanFailed', { message: normalizeErrorMessage(error) }), { variant: 'error' });
  } finally {
    busy.value = false;
  }
}

async function refreshPrices() {
  busy.value = true;
  try {
    const quotes = await api.refreshSteamMarketPrices(selectedItemIds.value);
    const next = { ...priceQuotes.value };
    quotes.forEach(quote => {
      next[quote.itemId] = quote;
    });
    priceQuotes.value = next;
  } catch (error) {
    showToast(normalizeErrorMessage(error), { variant: 'error' });
  } finally {
    busy.value = false;
  }
}

async function previewPlan() {
  busy.value = true;
  try {
    const result = await api.previewSteamMarketSellPlan(selectedItemIds.value, buildStrategy());
    planItems.value = result.items;
    if (result.warnings.length) {
      showToast(result.warnings[0], { variant: 'warning' });
    }
  } catch (error) {
    showToast(normalizeErrorMessage(error), { variant: 'error' });
  } finally {
    busy.value = false;
  }
}

async function sellSelected() {
  if (!planItems.value.length) {
    await previewPlan();
  }
  const sellable = planItems.value.filter(plan => !plan.skipped);
  if (!sellable.length) {
    showToast(t('steamMarket.noSellableItems'), { variant: 'warning' });
    return;
  }

  busy.value = true;
  try {
    const result = await api.sellSteamMarketItems({
      items: sellable.map(plan => ({
        assetId: plan.item.assetId,
        appId: plan.item.appId,
        contextId: plan.item.contextId,
        amount: plan.item.amount,
        sellerReceivesCents: plan.sellerReceivesCents
      }))
    });
    showToast(
      t('steamMarket.sellSuccess', {
        success: result.successCount,
        failed: result.failureCount,
        confirm: result.confirmationCount
      }),
      { variant: result.failureCount ? 'warning' : 'success' }
    );
    if (result.confirmationCount > 0) {
      showToast(t('steamMarket.confirmOnPhone'), { variant: 'info' });
    }
    await scanInventory();
  } catch (error) {
    showToast(t('steamMarket.sellFailed', { message: normalizeErrorMessage(error) }), { variant: 'error' });
  } finally {
    busy.value = false;
  }
}

function buildStrategy(): SteamMarketSellStrategy {
  return {
    mode: strategyMode.value,
    discountCents: strategyMode.value === 'fixedDiscount' ? discountCents.value : null,
    discountPercent: strategyMode.value === 'percentDiscount' ? discountPercent.value : null
  };
}

function selectAllItems() {
  selectedItemIds.value = [...syncableItemIds.value];
}

function clearSelection() {
  selectedItemIds.value = [];
}

function priceText(itemId: string) {
  const quote = priceQuotes.value[itemId];
  if (!quote) return '';
  const lowest = quote.lowestSellCents != null ? formatMoney(quote.lowestSellCents) : '--';
  const highest = quote.highestBuyCents != null ? formatMoney(quote.highestBuyCents) : '--';
  return t('steamMarket.priceSummary', { lowest, highest, currency: quote.currencyLabel });
}

function formatMoney(cents: number) {
  return (cents / 100).toFixed(2);
}

function parseCookieRaw(raw: string) {
  const parts = raw
    .split(';')
    .map(part => part.trim())
    .filter(Boolean);
  const map = new Map<string, string>();
  parts.forEach(part => {
    const index = part.indexOf('=');
    if (index <= 0) return;
    map.set(part.slice(0, index).trim(), part.slice(index + 1).trim());
  });
  return {
    sessionId: map.get('sessionid') ?? '',
    steamLoginSecure: map.get('steamLoginSecure') ?? '',
    steamCountry: map.get('steamCountry') ?? null
  };
}

function normalizeErrorMessage(error: unknown) {
  if (typeof error === 'string') return error;
  if (error && typeof error === 'object' && 'message' in error && typeof error.message === 'string') {
    return error.message;
  }
  return t('toolkit.aiUnknownError');
}
</script>
