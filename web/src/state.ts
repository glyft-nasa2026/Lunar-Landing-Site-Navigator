// App state, as docs/data-contract.md section 4. Only P1 edits this file.
// UI modules read state and call actions. They never call each other.

import type { Dem } from './core/dem';
import { loadEphemerisChunk, type Ephemeris } from './core/ephemeris';
import { sunAltAz } from './core/geometry';
import { skylineAt, skylineElev } from './core/horizon';
import type { Body, CuratedSite, Flip, Sample, Site, Skyline, Summary } from './core/types';
import { nextFlip, series, summary, SUN_RADIUS } from './core/windows';

export type Scenario = { id: string; label: string; color: string; site: Site; tMs: number };
// color is the name of a theme variable, for example '--scn-a'. Never a colour code.
export type Range = '30d' | '90d' | '365d';
export type AppState = {
  live: Scenario; pinned: Scenario[]; ghost: Scenario | null;
  selectedId: string; range: Range; mode: '2d' | '3d';
  windowStartMs: number;                 // left edge of the timeline for the live scenario
  // eph is null until the table has loaded, and again while a decade that the live or a pinned
  // scenario needs is still downloading, so every module shows "Loading" by itself.
  eph: Ephemeris | null; dem: Dem | null; sites: CuratedSite[];
};

export const LIVE_ID = 'live';
/** The three pin slots (F5). A scenario keeps its slot's colour until it is unpinned. */
export const PIN_SLOTS: readonly { id: string; label: string; color: string }[] = [
  { id: 'a', label: 'A', color: '--scn-a' },
  { id: 'b', label: 'B', color: '--scn-b' },
  { id: 'c', label: 'C', color: '--scn-c' },
];
export const MAX_PINNED = PIN_SLOTS.length;

const HOUR_MS = 3_600_000;
const DAY_MS = 86_400_000;
const RANGE_DAYS: Record<Range, number> = { '30d': 30, '90d': 90, '365d': 365 };
const rangeMs = (r: Range): number => RANGE_DAYS[r] * DAY_MS;

// Where the page opens when the address names no site: near the south pole, where the
// terrain skyline applies. The time is the current hour.
const DEFAULT_SITE: Site = { lat: -89.5, lon: 0 };

// ---------------------------------------------------------------------------------------------
// The page address (F17). Everything a shared link must reopen is kept after the '#':
//   #live=-89.5,0,2026-11-14T10:00:00Z&a=-88,45,2027-01-01T00:00:00Z&sel=a&range=90d&mode=3d
// A scenario is lat,lon,time and, only if it was set, eye height in metres.
// ---------------------------------------------------------------------------------------------

const round6 = (v: number): number => Number(v.toFixed(6));
const wrapLon = (lon: number): number => {
  const w = ((((lon + 180) % 360) + 360) % 360) - 180;
  return w === -180 && lon > 0 ? 180 : w;
};
const validSite = (s: Site): boolean =>
  Number.isFinite(s.lat) && Number.isFinite(s.lon) && s.lat >= -90 && s.lat <= 90;

// Coordinates are kept to 6 decimal places (3 cm on the Moon), so the address stays short and
// a scenario restored from it is identical to the one that was saved.
function cleanSite(s: Site): Site {
  const out: Site = { lat: round6(s.lat), lon: round6(wrapLon(s.lon)) };
  if (s.eye_m !== undefined && Number.isFinite(s.eye_m)) out.eye_m = s.eye_m;
  return out;
}

function scenarioToText(sc: Scenario): string {
  const iso = new Date(sc.tMs).toISOString().replace('.000Z', 'Z');
  const parts = [String(sc.site.lat), String(sc.site.lon), iso];
  if (sc.site.eye_m !== undefined) parts.push(String(sc.site.eye_m));
  return parts.join(',');
}

function textToSiteTime(text: string | null): { site: Site; tMs: number } | null {
  if (!text) return null;
  const parts = text.split(',');
  if (parts.length < 3 || parts.length > 4) return null;
  const site: Site = { lat: Number(parts[0]), lon: Number(parts[1]) };
  const tMs = Date.parse(parts[2]);
  if (parts[0].trim() === '' || parts[1].trim() === '') return null;
  if (!validSite(site) || !Number.isFinite(tMs)) return null;
  if (parts.length === 4) {
    const eye = Number(parts[3]);
    if (parts[3].trim() === '' || !Number.isFinite(eye)) return null;
    site.eye_m = eye;
  }
  return { site: cleanSite(site), tMs };
}

function stateFromAddress(hash: string, nowMs: number): AppState {
  const q = new URLSearchParams(hash.replace(/^#/, ''));

  const liveAt = textToSiteTime(q.get('live'));
  const live: Scenario = {
    id: LIVE_ID, label: 'Live', color: '--accent',
    site: liveAt?.site ?? { ...DEFAULT_SITE },
    tMs: liveAt?.tMs ?? Math.floor(nowMs / HOUR_MS) * HOUR_MS,
  };

  const pinned: Scenario[] = [];
  for (const slot of PIN_SLOTS) {
    const at = textToSiteTime(q.get(slot.id));
    if (at) pinned.push({ ...slot, site: at.site, tMs: at.tMs });
  }

  const sel = q.get('sel');
  const range = q.get('range');
  return {
    live, pinned, ghost: null,
    selectedId: pinned.some((p) => p.id === sel) ? (sel as string) : LIVE_ID,
    range: range === '90d' || range === '365d' ? range : '30d',
    mode: q.get('mode') === '3d' ? '3d' : '2d',
    windowStartMs: live.tMs,
    eph: null, dem: null, sites: [],
  };
}

/**
 * The part of the page address after '#' that reopens the current scenarios. The page keeps
 * the address up to date by itself; T08's share button only needs to copy location.href.
 */
export function stateToAddress(): string {
  const parts = [`live=${scenarioToText(state.live)}`];
  for (const p of state.pinned) parts.push(`${p.id}=${scenarioToText(p)}`);
  if (state.selectedId !== LIVE_ID) parts.push(`sel=${state.selectedId}`);
  if (state.range !== '30d') parts.push(`range=${state.range}`);
  if (state.mode !== '2d') parts.push(`mode=${state.mode}`);
  return parts.join('&');
}

/**
 * Rebuilds the scenarios from a page address (with or without the leading '#'). Loaded data
 * is kept. Parts of the address that don't parse are ignored. Called once on load; also by
 * tests, and when someone pastes a link into a tab that is already open.
 */
export function restoreFromAddress(hash: string, nowMs: number = Date.now()): void {
  const next = stateFromAddress(hash, nowMs);
  if (state) {
    next.eph = state.eph;
    next.dem = state.dem;
    next.sites = state.sites;
  }
  state = next;
  notify(false);
}

// ---------------------------------------------------------------------------------------------
// State and actions
// ---------------------------------------------------------------------------------------------

const hasPage = typeof window !== 'undefined' && typeof history !== 'undefined';

let state: AppState = stateFromAddress(hasPage ? window.location.hash : '', Date.now());
const listeners = new Set<(s: AppState) => void>();

let addressTimer: ReturnType<typeof setTimeout> | undefined;

function writeAddress(): void {
  addressTimer = undefined;
  try {
    history.replaceState(null, '', '#' + stateToAddress());
  } catch {
    // Some browsers limit how often the address may change. The next change writes it again.
  }
}

function notify(saveAddress = true): void {
  refreshEph();
  if (saveAddress && hasPage) {
    // One write a short moment after the last change, not one per step of a drag.
    if (addressTimer !== undefined) clearTimeout(addressTimer);
    addressTimer = setTimeout(writeAddress, 150);
  }
  for (const fn of [...listeners]) fn(state);
}

if (hasPage) {
  // Fires when the address is edited or a link is pasted, not for our own replaceState calls.
  window.addEventListener('hashchange', () => restoreFromAddress(window.location.hash));
  // Don't lose the last change if the page is closed within the short delay above.
  window.addEventListener('pagehide', () => {
    if (addressTimer !== undefined) {
      clearTimeout(addressTimer);
      writeAddress();
    }
  });
}

export function getState(): AppState {
  return state;
}

/** Calls fn after every change. Returns the function that stops it. */
export function subscribe(fn: (s: AppState) => void): () => void {
  listeners.add(fn);
  return () => { listeners.delete(fn); };
}

/** Called by main.ts as each data file arrives. Not for UI modules. */
export function setData(patch: { eph?: Ephemeris | null; dem?: Dem | null; sites?: CuratedSite[] }): void {
  if ('eph' in patch) {
    table = patch.eph ?? null;
    pending.clear();
    failed.clear();
  }
  const { eph: _ignored, ...rest } = patch;
  state = { ...state, ...rest };
  clearCaches();
  notify(false);
}

// ---------------------------------------------------------------------------------------------
// Decades of the Sun and Earth table (core/ephemeris.ts). main.ts hands over the table with its
// home decade (the 2020s) loaded; any other decade is fetched here the first time a scenario
// needs it. A decade that fails to download is not asked for again; its times then read as
// outside the table.
// ---------------------------------------------------------------------------------------------

let table: Ephemeris | null = null;   // every decade loaded so far
const pending = new Set<number>();
const failed = new Set<number>();
const FLIP_DAYS = 60;                 // nextFlip's default look-ahead

/**
 * True when every decade from fromMs to toMs is in memory; asks for the ones that aren't.
 * settled: also true when the only ones missing failed to download, since waiting won't help.
 */
function covered(fromMs: number, toMs: number, settled = false): boolean {
  if (!table) return false;
  const need = table.missing(fromMs, toMs);
  for (const i of need) if (!failed.has(i)) fetchChunk(i);
  return settled ? need.every((i) => failed.has(i)) : need.length === 0;
}

function fetchChunk(i: number): void {
  if (!table || pending.has(i)) return;
  pending.add(i);
  const asked = table;
  loadEphemerisChunk(asked, i).then(
    (buffer) => {
      if (table?.meta !== asked.meta || !pending.delete(i)) return; // a new table came meanwhile
      table = table.withChunk(i, buffer);
      notify(false);
    },
    (err: unknown) => {
      if (table?.meta !== asked.meta || !pending.delete(i)) return;
      failed.add(i);
      console.warn(`Data not loaded (Sun and Earth table, decade ${i}):`, err instanceof Error ? err.message : err);
      notify(false);
    },
  );
}

/** What each scenario on screen reads: its own hours, its countdowns and the timeline. */
function scenariosCovered(): boolean {
  const s = state;
  const range = rangeMs(s.range);
  let ok = covered(s.live.tMs, s.live.tMs + FLIP_DAYS * DAY_MS, true);
  ok = covered(s.windowStartMs, s.windowStartMs + range, true) && ok;
  for (const p of s.pinned) ok = covered(p.tMs, p.tMs + Math.max(FLIP_DAYS * DAY_MS, range), true) && ok;
  return ok;
}

function refreshEph(): void {
  const eph = table && scenariosCovered() ? table : null;
  if (eph !== state.eph) state = { ...state, eph };
}

/** Moves the live scenario and selects it. Ignores a latitude outside -90..90 or a non-number. */
export function setLiveSite(site: Site): void {
  if (!validSite(site)) return;
  state = { ...state, live: { ...state.live, site: cleanSite(site) }, selectedId: LIVE_ID };
  notify();
}

/**
 * Sets the live scenario's time and selects it. The timeline window stays put while the new
 * time is inside it, and restarts at the new time otherwise.
 */
export function setLiveTime(tMs: number): void {
  if (!Number.isFinite(tMs)) return;
  const inside = tMs >= state.windowStartMs && tMs <= state.windowStartMs + rangeMs(state.range);
  state = {
    ...state,
    live: { ...state.live, tMs },
    selectedId: LIVE_ID,
    windowStartMs: inside ? state.windowStartMs : tMs,
  };
  notify();
}

/** Copies the live scenario into the first free slot (A, B, C). Does nothing when all are used. */
export function pin(): void {
  const slot = PIN_SLOTS.find((s) => !state.pinned.some((p) => p.id === s.id));
  if (!slot) return;
  const copy: Scenario = { ...slot, site: { ...state.live.site }, tMs: state.live.tMs };
  const order = (sc: Scenario): number => PIN_SLOTS.findIndex((s) => s.id === sc.id);
  const pinned = [...state.pinned, copy].sort((x, y) => order(x) - order(y));
  state = { ...state, pinned };
  notify();
}

export function unpin(id: string): void {
  if (!state.pinned.some((p) => p.id === id)) return;
  state = {
    ...state,
    pinned: state.pinned.filter((p) => p.id !== id),
    selectedId: state.selectedId === id ? LIVE_ID : state.selectedId,
  };
  notify();
}

export function select(id: string): void {
  if (id !== LIVE_ID && !state.pinned.some((p) => p.id === id)) return;
  if (id === state.selectedId) return;
  state = { ...state, selectedId: id };
  notify();
}

/** Changes the timeline length. The window restarts at the live time if that would fall outside. */
export function setRange(r: Range): void {
  if (r === state.range) return;
  const t = state.live.tMs;
  const inside = t >= state.windowStartMs && t <= state.windowStartMs + rangeMs(r);
  state = { ...state, range: r, windowStartMs: inside ? state.windowStartMs : t };
  notify();
}

/** Moves the live timeline window earlier (-1) or later (1) by half the range. */
export function shiftWindow(dir: -1 | 1): void {
  state = { ...state, windowStartMs: state.windowStartMs + (dir * rangeMs(state.range)) / 2 };
  notify(false);
}

export function setGhost(s: Scenario | null): void {
  state = { ...state, ghost: s };
  notify(false);
}

export function setMode(m: '2d' | '3d'): void {
  if (m === state.mode) return;
  state = { ...state, mode: m };
  notify();
}

/** The live or pinned scenario named by selectedId. */
export function selected(): Scenario {
  return state.pinned.find((p) => p.id === state.selectedId) ?? state.live;
}

// ---------------------------------------------------------------------------------------------
// Computed once and cached here, so modules don't repeat the work.
// While eph is null: empty arrays, null flips, a flat skyline and zeros.
// ---------------------------------------------------------------------------------------------

const CACHE_LIMIT = 64;
const skylineCache = new Map<string, Skyline>();
const seriesCache = new Map<string, Sample[]>();
const summaryCache = new Map<string, Summary>();
const flipCache = new Map<string, Flip>();
const neverLitCache = new Map<string, boolean>();

function clearCaches(): void {
  skylineCache.clear();
  seriesCache.clear();
  summaryCache.clear();
  flipCache.clear();
  neverLitCache.clear();
}

function cached<T>(cache: Map<string, T>, key: string, make: () => T): T {
  if (cache.has(key)) return cache.get(key) as T;
  // A drag makes a new key at every step; dropping everything now and then keeps this small.
  if (cache.size >= CACHE_LIMIT) cache.clear();
  const value = make();
  cache.set(key, value);
  return value;
}

const siteKey = (s: Site): string => `${s.lat},${s.lon},${s.eye_m ?? ''}`;

function groundFor(site: Site): number {
  const dem = state.dem;
  return dem && dem.covers(site.lat, site.lon) ? dem.heightAt(site.lat, site.lon) : 0;
}

function hourly(sc: Scenario, startMs: number, range: Range): Sample[] {
  const eph = state.eph;
  if (!eph || !covered(startMs, startMs + rangeMs(range))) return [];
  return cached(seriesCache, `${siteKey(sc.site)}|${startMs}|${range}`, () =>
    series(eph, sc.site, groundFor(sc.site), skylineFor(sc), startMs, startMs + rangeMs(range), HOUR_MS));
}

export function skylineFor(sc: Scenario): Skyline {
  return cached(skylineCache, siteKey(sc.site), () => skylineAt(state.dem, sc.site));
}

/** Hourly from sc.tMs: strips, sky paths. */
export function samplesFor(sc: Scenario, range: Range): Sample[] {
  return hourly(sc, sc.tMs, range);
}

/** Hourly from the window start for the live scenario, from its own time for any other. */
export function timelineFor(sc: Scenario, range: Range): Sample[] {
  return hourly(sc, sc.id === LIVE_ID ? state.windowStartMs : sc.tMs, range);
}

/** Over 30 days from sc.tMs. */
export function summaryFor(sc: Scenario): Summary {
  if (!state.eph) return summary([]);
  return cached(summaryCache, `${siteKey(sc.site)}|${sc.tMs}`, () => summary(samplesFor(sc, '30d')));
}

/** Next rise or set after sc.tMs. */
export function flipFor(sc: Scenario, body: Body): Flip {
  const eph = state.eph;
  if (!eph || !covered(sc.tMs, sc.tMs + FLIP_DAYS * DAY_MS)) return null;
  return cached(flipCache, `${siteKey(sc.site)}|${sc.tMs}|${body}`, () =>
    nextFlip(eph, sc.site, groundFor(sc.site), skylineFor(sc), sc.tMs, body));
}

/**
 * No sunlight there in the home decade (2020-2029, always loaded): no part of the Sun's disc
 * clears the skyline. Judged on one fixed decade so the answer doesn't change as more load.
 */
export function neverLitFor(sc: Scenario): boolean {
  const eph = state.eph;
  if (!eph) return false;
  return cached(neverLitCache, siteKey(sc.site), () => {
    const skyline = skylineFor(sc);
    const ground = groundFor(sc.site);
    const stepMs = eph.meta.step_s * 1000;
    for (let t = eph.homeStartMs; t <= eph.homeEndMs; t += stepMs) {
      const sun = sunAltAz(eph, sc.site, ground, t);
      if (sun.alt - skylineElev(skyline, sun.az) + SUN_RADIUS > 0) return false;
    }
    return true;
  });
}
