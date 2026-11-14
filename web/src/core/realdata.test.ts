// T24: the terrain checks of spec section 7, on the real Sun and Earth table and the real height
// map in web/public/data/. Skips, saying why, while either file is T20's mock.
//
// The table is split into decade files (contract section 2), so it is built with
// readRealTable() (indexEphemeris + withChunk, every decade) rather than one parseEphemeris call.
// "The whole table" is 1900-01-01 to 2101-01-01, sampled hourly; that includes 2026-2035.
import { existsSync, readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import { parseDem, type Dem, type DemMeta } from './dem';
import type { Ephemeris } from './ephemeris';
import { skylineAt } from './horizon';
import { readRealTable } from './realTable.testutil';
import type { CuratedSite, Site } from './types';
import { series } from './windows';

const dataFile = (rel: string): string => fileURLToPath(new URL(`../../public/data/${rel}`, import.meta.url));

function readJson<T>(rel: string): T | null {
  const f = dataFile(rel);
  return existsSync(f) ? (JSON.parse(readFileSync(f, 'utf8')) as T) : null;
}

const ephMeta = readJson<{ source?: string }>('ephemeris.json');
const demMeta = readJson<DemMeta>('dem.json');

function whySkip(): string | null {
  if (!ephMeta) return 'web/public/data/ephemeris.json is missing';
  if (!demMeta) return 'web/public/data/dem.json is missing';
  if (!existsSync(dataFile('dem.bin'))) return 'web/public/data/dem.bin is missing';
  const mock = [ephMeta.source === 'mock' && 'ephemeris.json', demMeta.source === 'mock' && 'dem.json']
    .filter(Boolean);
  if (mock.length > 0) return `${mock.join(' and ')} ${mock.length > 1 ? 'say' : 'says'} "source": "mock"`;
  return null;
}

const skipReason = whySkip();
if (skipReason) console.log(`realdata.test.ts skipped: ${skipReason}. These checks need the real files.`);

const HOUR_MS = 3_600_000;
const YEAR_MS = 365 * 24 * HOUR_MS;

function readDem(meta: DemMeta): Dem {
  const bytes = readFileSync(dataFile('dem.bin'));
  return parseDem(meta, bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength) as ArrayBuffer);
}

function siteById(sites: CuratedSite[], id: string): Site {
  const s = sites.find((x) => x.id === id);
  if (!s) throw new Error(`sites.json has no "${id}" (T07 must provide it)`);
  return { lat: s.lat, lon: s.lon };
}

/** Hourly over the whole table, a year at a time so the samples never all sit in memory. */
function sunOverTable(eph: Ephemeris, dem: Dem, site: Site) {
  const ground = dem.heightAt(site.lat, site.lon);
  const sky = skylineAt(dem, site);
  let hours = 0, lit = 0, maxFrac = 0, maxAbove = -Infinity, maxAboveMs = 0;
  for (let t = eph.startMs; t < eph.endMs; t += YEAR_MS) {
    for (const s of series(eph, site, ground, sky, t, Math.min(t + YEAR_MS, eph.endMs), HOUR_MS)) {
      hours++;
      if (s.sunFrac > 0) lit++;
      if (s.sunFrac > maxFrac) maxFrac = s.sunFrac;
      if (s.sunAbove > maxAbove) { maxAbove = s.sunAbove; maxAboveMs = s.tMs; }
    }
  }
  return { ground, hours, lit, litPct: (100 * lit) / hours, maxFrac, maxAbove, maxAboveAt: new Date(maxAboveMs).toISOString() };
}

describe.skipIf(skipReason !== null)('real data: terrain checks (spec section 7)', () => {
  const eph = skipReason ? null : readRealTable();
  const dem = skipReason ? null : readDem(demMeta as DemMeta);
  const sites = readJson<CuratedSite[]>('sites.json') ?? [];
  const floor = skipReason ? { lat: 0, lon: 0 } : siteById(sites, 'shackleton-floor');
  const rim = skipReason ? { lat: 0, lon: 0 } : siteById(sites, 'shackleton-rim');
  const span = eph ? `${new Date(eph.startMs).toISOString()} to ${new Date(eph.endMs).toISOString()}` : '';

  it('floor: the lowest of the 360 skyline values is above 5 degrees', () => {
    const sky = skylineAt(dem, floor);
    const v = Array.from(sky.elev);
    const low = Math.min(...v);
    console.log(`shackleton-floor (${floor.lat}, ${floor.lon}), ground ${dem!.heightAt(floor.lat, floor.lon).toFixed(0)} m: ` +
      `skyline lowest ${low.toFixed(2)} deg at az ${v.indexOf(low)}, highest ${Math.max(...v).toFixed(2)} deg`);
    expect(sky.terrain).toBe(true);
    expect(low).toBeGreaterThan(5);
  });

  // Runs before the two full-table checks below: they build millions of hourly samples, and a
  // skyline timed straight after them also measured the clean-up of that memory (fastest of five
  // was 105.5 ms after them, about 40 ms on its own). Limit and method are unchanged.
  it('one real skyline takes under 100 ms', () => {
    let t = performance.now();
    skylineAt(dem, rim);
    const cold = performance.now() - t;
    const times: number[] = [];
    for (let i = 0; i < 5; i++) {
      t = performance.now();
      skylineAt(dem, rim);
      times.push(performance.now() - t);
    }
    times.sort((a, b) => a - b);
    console.log(`real skyline timing (shackleton-rim): first call ${cold.toFixed(1)} ms; next 5 ` +
      `${times.map((x) => x.toFixed(1)).join(', ')} ms (fastest ${times[0].toFixed(1)} ms)`);
    // The fastest of five, as in horizon.test.ts: a busy machine only ever adds time.
    expect(times[0]).toBeLessThan(100);
  });

  it('floor: never lit in the whole table (sunFrac 0 every hour)', () => {
    const r = sunOverTable(eph!, dem!, floor);
    console.log(`shackleton-floor, ${span}: ${r.hours} hourly samples, ${r.lit} lit; largest sunFrac ${r.maxFrac}; ` +
      `Sun centre came closest at ${r.maxAbove.toFixed(2)} deg relative to the skyline (${r.maxAboveAt})`);
    expect(r.lit).toBe(0);
  }, 300_000);

  it('rim: lit more than half of the whole table', () => {
    const r = sunOverTable(eph!, dem!, rim);
    console.log(`shackleton-rim (${rim.lat}, ${rim.lon}), ground ${r.ground.toFixed(0)} m, ${span}: ` +
      `lit ${r.lit} of ${r.hours} hours = ${r.litPct.toFixed(1)} %`);
    expect(r.litPct).toBeGreaterThan(50);
  }, 300_000);
});
