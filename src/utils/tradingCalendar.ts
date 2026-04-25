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

/** Core decision: is this an A-share trading day?
 *
 * API keys are MM-DD (not YYYY-MM-DD).
 *
 * Any day present in the API data → market CLOSED:
 *   holiday=true  → public holiday (weekday turned rest day)
 *   holiday=false → makeup workday 补班 (weekend turned work day, but stock
 *                   exchanges do NOT open on weekends regardless)
 *
 * Days absent from the API follow the standard rule:
 *   weekday → market OPEN, weekend → market CLOSED
 */
function checkTrading(iso: string, yearData: Record<string, HolidayEntry>): boolean {
  const mmdd = iso.slice(5); // "2026-05-01" → "05-01"
  if (mmdd in yearData) return false; // any special day → market closed
  return !isWeekend(iso);
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
  /** A-share trading days (weekdays minus public holidays) */
  tradingDays: number;
  /** Human workdays = trading days + makeup weekend workdays (补班) */
  workdays: number;
  totalDays: number;
}

/**
 * Counts trading days AND workdays in [startIso, endIso] inclusive.
 *
 * - tradingDays: days when the A-share market is open
 * - workdays   : days employees must work (trading days + 补班 makeup days)
 */
export async function countTradingDays(
  startIso: string,
  endIso: string
): Promise<CountResult> {
  const [sy, sm, sd] = startIso.split('-').map(Number);
  const [ey, em, ed] = endIso.split('-').map(Number);
  const start = new Date(sy, sm - 1, sd);
  const end = new Date(ey, em - 1, ed);
  if (start > end) return { tradingDays: 0, workdays: 0, totalDays: 0 };

  const totalDays = Math.round((end.getTime() - start.getTime()) / 86400000) + 1;
  const yearMap = await ensureYearsLoaded(startIso, endIso);

  let tradingDays = 0;
  let workdays = 0;
  const cur = new Date(start);

  while (cur <= end) {
    const iso = isoFromDate(cur);
    const yData = yearMap[cur.getFullYear()] ?? {};
    const mmdd = iso.slice(5);
    const entry = yData[mmdd];
    const weekend = cur.getDay() === 0 || cur.getDay() === 6;

    if (entry !== undefined) {
      if (!entry.holiday) {
        // Makeup workday (补班): employees work but market is closed
        workdays++;
      }
      // holiday=true: neither a trading day nor a workday
    } else if (!weekend) {
      // Regular weekday: both a trading day and a workday
      tradingDays++;
      workdays++;
    }
    // Regular weekend: neither

    cur.setDate(cur.getDate() + 1);
  }
  return { tradingDays, workdays, totalDays };
}

// ── Day type classification ───────────────────────────────────────────────────

/** How a specific date is classified */
export type DayType =
  | 'trading'   // normal weekday, not a holiday → market OPEN, workday
  | 'makeup'    // weekend makeup workday (补班) → market CLOSED, but workday
  | 'holiday'   // public holiday on weekday → market CLOSED, not a workday
  | 'weekend';  // regular weekend → market CLOSED, not a workday

export interface DayDetail {
  iso: string;
  dow: number;       // 0=Sun … 6=Sat
  isTrading: boolean; // A-share market open?
  isWorkday: boolean; // Employees must work (trading day OR makeup day)?
  type: DayType;
  /** Holiday / makeup name from API, e.g. "劳动节", "劳动节后补班" */
  name?: string;
}

/**
 * Returns a day-by-day breakdown for [startIso, endIso] inclusive.
 * Useful for rendering a detailed calendar view.
 */
export async function getDailyDetails(
  startIso: string,
  endIso: string
): Promise<DayDetail[]> {
  const [sy, sm, sd] = startIso.split('-').map(Number);
  const [ey, em, ed] = endIso.split('-').map(Number);
  const start = new Date(sy, sm - 1, sd);
  const end = new Date(ey, em - 1, ed);
  if (start > end) return [];

  const yearMap = await ensureYearsLoaded(startIso, endIso);
  const details: DayDetail[] = [];
  const cur = new Date(start);

  while (cur <= end) {
    const iso = isoFromDate(cur);
    const dow = cur.getDay();
    const yData = yearMap[cur.getFullYear()] ?? {};
    const mmdd = iso.slice(5);
    const entry = yData[mmdd];
    const weekend = dow === 0 || dow === 6;

    let type: DayType;
    let isTrading: boolean;
    let isWorkday: boolean;

    if (entry !== undefined) {
      if (entry.holiday) {
        // Public holiday — market closed, not a regular workday
        type = 'holiday';
        isTrading = false;
        isWorkday = false;
      } else {
        // Makeup workday (补班) — employees work, but stock market is CLOSED on weekends
        type = 'makeup';
        isTrading = false;
        isWorkday = true;
      }
    } else if (weekend) {
      type = 'weekend';
      isTrading = false;
      isWorkday = false;
    } else {
      type = 'trading';
      isTrading = true;
      isWorkday = true;
    }

    details.push({ iso, dow, isTrading, isWorkday, type, name: entry?.name });
    cur.setDate(cur.getDate() + 1);
  }

  return details;
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
