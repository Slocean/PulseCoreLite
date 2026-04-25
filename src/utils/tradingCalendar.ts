/**
 * A-share Trading Calendar
 *
 * Data source: https://timor.tech/api/holiday  (free, no auth required)
 *   GET /year/{year}  →  { code: 0, holiday: Record<"YYYY-MM-DD", HolidayEntry> }
 *
 * The API returns only "special" days:
 *   rest = 0  →  makeup workday 补班 (weekend → trading day)
 *   rest = 1  →  holiday / rest day  (weekday → non-trading day)
 *
 * All other days follow the standard rule: weekday = trading, weekend = non-trading.
 *
 * Caching strategy
 * ────────────────
 * Each year's data is stored in localStorage with a 30-day TTL.
 * An in-memory map avoids repeated JSON.parse calls within a session.
 */

const API_BASE = 'https://timor.tech/api/holiday';
const CACHE_PREFIX = 'pcl.trading_cal.';
const CACHE_TTL_MS = 30 * 24 * 60 * 60 * 1000; // 30 days

// ── Types ─────────────────────────────────────────────────────────────────────

interface HolidayEntry {
  holiday: boolean;
  name?: string;
  wage?: number;
  date: string;
  /** 0 = makeup workday (补班), 1 = rest / holiday day */
  rest: number;
}

interface CachedYear {
  fetchedAt: number;
  data: Record<string, HolidayEntry>;
}

// ── In-memory cache (avoids JSON.parse on every call) ────────────────────────

const memCache = new Map<number, Record<string, HolidayEntry>>();

// ── Core fetch with cache ─────────────────────────────────────────────────────

async function loadYear(year: number): Promise<Record<string, HolidayEntry>> {
  if (memCache.has(year)) return memCache.get(year)!;

  const key = `${CACHE_PREFIX}${year}`;

  // Try localStorage first
  try {
    const raw = localStorage.getItem(key);
    if (raw) {
      const parsed: CachedYear = JSON.parse(raw);
      if (Date.now() - parsed.fetchedAt < CACHE_TTL_MS) {
        memCache.set(year, parsed.data);
        return parsed.data;
      }
    }
  } catch {
    // corrupted cache — ignore and re-fetch
  }

  // Fetch from API
  const res = await fetch(`${API_BASE}/year/${year}`, {
    signal: AbortSignal.timeout(8000)
  });
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  const json = await res.json();
  if (json.code !== 0) throw new Error(`API code ${json.code}`);

  const data: Record<string, HolidayEntry> = json.holiday ?? {};

  // Persist to localStorage (best-effort)
  try {
    const entry: CachedYear = { fetchedAt: Date.now(), data };
    localStorage.setItem(key, JSON.stringify(entry));
  } catch {
    // storage quota exceeded — skip
  }

  memCache.set(year, data);
  return data;
}

/** Pre-load all years in [startIso, endIso] in parallel. */
async function ensureYearsLoaded(
  startIso: string,
  endIso: string
): Promise<Record<number, Record<string, HolidayEntry>>> {
  const sy = yearOf(startIso);
  const ey = yearOf(endIso);
  const years: number[] = [];
  for (let y = sy; y <= ey; y++) years.push(y);
  const results = await Promise.all(years.map(loadYear));
  return Object.fromEntries(years.map((y, i) => [y, results[i]]));
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function yearOf(iso: string): number {
  return parseInt(iso.slice(0, 4), 10);
}

function dowOf(iso: string): number {
  const [y, m, d] = iso.split('-').map(Number);
  return new Date(y, m - 1, d).getDay(); // 0=Sun … 6=Sat
}

function isoFromDate(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

function isWeekend(iso: string): boolean {
  const dow = dowOf(iso);
  return dow === 0 || dow === 6;
}

/** Core decision using pre-loaded year data. */
function checkTrading(iso: string, yearData: Record<string, HolidayEntry>): boolean {
  const entry = yearData[iso];
  if (entry !== undefined) {
    return entry.rest === 0; // rest=0 → makeup workday; rest=1 → holiday
  }
  return !isWeekend(iso); // normal weekday = trading, weekend = non-trading
}

// ── Public API ────────────────────────────────────────────────────────────────

export interface TradingDayResult {
  isTrading: boolean;
}

/**
 * Checks whether a single date is an A-share trading day.
 * Fetches (and caches) holiday data for the relevant year automatically.
 */
export async function isTradingDay(iso: string): Promise<TradingDayResult> {
  const yearData = await loadYear(yearOf(iso));
  return { isTrading: checkTrading(iso, yearData) };
}

export interface CountResult {
  count: number;
  totalDays: number;
}

/**
 * Counts trading days in [startIso, endIso] inclusive.
 * Fetches all required years in parallel.
 */
export async function countTradingDays(
  startIso: string,
  endIso: string
): Promise<CountResult> {
  const [sy, sm, sd] = startIso.split('-').map(Number);
  const [ey, em, ed] = endIso.split('-').map(Number);
  const start = new Date(sy, sm - 1, sd);
  const end = new Date(ey, em - 1, ed);
  if (start > end) return { count: 0, totalDays: 0 };

  const totalDays = Math.round((end.getTime() - start.getTime()) / 86400000) + 1;
  const yearMap = await ensureYearsLoaded(startIso, endIso);

  let count = 0;
  const cur = new Date(start);
  while (cur <= end) {
    const iso = isoFromDate(cur);
    const yData = yearMap[cur.getFullYear()] ?? {};
    if (checkTrading(iso, yData)) count++;
    cur.setDate(cur.getDate() + 1);
  }
  return { count, totalDays };
}

export interface NearbyResult {
  prevIso: string;
  prevDow: number;
  todayIsTrading: boolean;
  nextIso: string;
  nextDow: number;
}

/**
 * Finds the nearest trading days before and after `iso`,
 * and reports whether `iso` itself is a trading day.
 */
export async function findNearbyTradingDays(iso: string): Promise<NearbyResult> {
  // Load a window of ±14 days to cover even the longest holiday streaks
  const d = new Date(iso.replace(/-/g, '/'));
  const windowStart = new Date(d);
  windowStart.setDate(windowStart.getDate() - 14);
  const windowEnd = new Date(d);
  windowEnd.setDate(windowEnd.getDate() + 14);

  const ws = isoFromDate(windowStart);
  const we = isoFromDate(windowEnd);
  const yearMap = await ensureYearsLoaded(ws, we);

  function isTrading(candidate: string): boolean {
    return checkTrading(candidate, yearMap[yearOf(candidate)] ?? {});
  }

  // today
  const todayIsTrading = isTrading(iso);

  // search backward
  let prev = new Date(d);
  prev.setDate(prev.getDate() - 1);
  for (let i = 0; i < 14; i++) {
    if (isTrading(isoFromDate(prev))) break;
    prev.setDate(prev.getDate() - 1);
  }
  const prevIso = isoFromDate(prev);

  // search forward
  let next = new Date(d);
  next.setDate(next.getDate() + 1);
  for (let i = 0; i < 14; i++) {
    if (isTrading(isoFromDate(next))) break;
    next.setDate(next.getDate() + 1);
  }
  const nextIso = isoFromDate(next);

  return {
    prevIso,
    prevDow: dowOf(prevIso),
    todayIsTrading,
    nextIso,
    nextDow: dowOf(nextIso)
  };
}

/** Chinese weekday names indexed by getDay() value (0=Sun … 6=Sat) */
export const WEEKDAY_ZH = ['日', '一', '二', '三', '四', '五', '六'] as const;

export function dowOf2(iso: string): number {
  return dowOf(iso);
}
