// Checks web/public/data/sites.json against the contract (section 2). Skips while the file
// isn't there yet: T20 adds the mock list, T07 the real one.
import { existsSync, readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import { parseDem, type Dem, type DemMeta } from './dem';
import { skylineAt } from './horizon';
import { readRealTable } from './realTable.testutil';
import type { CuratedSite } from './types';
import { series, summary } from './windows';

const dataFile = (name: string): string => fileURLToPath(new URL(`../../public/data/${name}`, import.meta.url));
const file = dataFile('sites.json');
const present = existsSync(file);

/** The real height map from web/public/data/, or null while it is missing or T20's mock. */
function readRealDem(): Dem | null {
  if (!existsSync(dataFile('dem.json')) || !existsSync(dataFile('dem.bin'))) return null;
  const meta = JSON.parse(readFileSync(dataFile('dem.json'), 'utf8')) as DemMeta;
  if (meta.source === 'mock') return null;
  const bytes = readFileSync(dataFile('dem.bin'));
  return parseDem(meta, bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength) as ArrayBuffer);
}

const STRINGS = ['id', 'name', 'agency', 'status', 'group', 'note', 'source'] as const;
const NUMBERS = ['lat', 'lon', 'year'] as const;
const STATUSES = ['landed', 'planned', 'candidate', 'reference'];
const GROUPS = ['apollo', 'lander', 'south-pole'];

describe.skipIf(!present)('sites.json', () => {
  const sites: CuratedSite[] = present ? JSON.parse(readFileSync(file, 'utf8')) : [];

  it('is a list with at least one site', () => {
    expect(Array.isArray(sites)).toBe(true);
    expect(sites.length).toBeGreaterThan(0);
  });

  it('gives every site the contract\'s fields, with the right types', () => {
    for (const site of sites) {
      for (const key of STRINGS) expect(typeof site[key], `${site.id}: ${key}`).toBe('string');
      for (const key of NUMBERS) expect(Number.isFinite(site[key]), `${site.id}: ${key}`).toBe(true);
      expect(site.id, 'id is not empty').not.toBe('');
      expect(site.name, `${site.id}: name is not empty`).not.toBe('');
    }
  });

  it('keeps latitude within -90..90 and longitude within -180..180, never 0 to 360', () => {
    for (const site of sites) {
      expect(site.lat, `${site.id}: lat`).toBeGreaterThanOrEqual(-90);
      expect(site.lat, `${site.id}: lat`).toBeLessThanOrEqual(90);
      expect(site.lon, `${site.id}: lon`).toBeGreaterThanOrEqual(-180);
      expect(site.lon, `${site.id}: lon`).toBeLessThanOrEqual(180);
    }
  });

  it('uses only the contract\'s status and group words', () => {
    for (const site of sites) {
      expect(STATUSES, `${site.id}: status`).toContain(site.status);
      expect(GROUPS, `${site.id}: group`).toContain(site.group);
    }
  });

  it('has no repeated id', () => {
    const ids = sites.map((s) => s.id);
    expect(new Set(ids).size).toBe(ids.length);
  });
});

// The real list against the real height map and Sun table. A south-pole point named as sunlit
// has to sit on sunlit ground of this project's own map. A coordinate rounded to 0.01 degrees,
// or found on another mission's map, can land a few hundred metres off a crest, on a slope
// that is dark half the time: the first rim point (46.7 % lit) and four ridge points (42 to
// 65 %) did. Skips on mock data.
const realSites: CuratedSite[] = present ? JSON.parse(readFileSync(file, 'utf8')) : [];
const realList = realSites.length > 0 && !realSites.some((s) => s.id.startsWith('mock-'));
const dem = realList ? readRealDem() : null;
const eph = dem ? readRealTable() : null;

describe.skipIf(!dem || !eph)('sites.json on the real height map', () => {
  const SUNLIT = ['shackleton-rim', 'connecting-ridge', 'shackleton-ridge-120e', 'de-gerlache-rim', 'malapert-massif'];
  const HOUR_MS = 3_600_000;

  /** Share of 2027 with any of the Sun's disc above the skyline, hourly, eye height 2 m. */
  function litPct(id: string): number {
    const site = realSites.find((s) => s.id === id);
    if (!site || !dem || !eph) throw new Error(`${id}: not in sites.json`);
    const at = { lat: site.lat, lon: site.lon };
    const samples = series(eph, at, dem.heightAt(at.lat, at.lon), skylineAt(dem, at),
      Date.parse('2027-01-01T00:00:00Z'), Date.parse('2028-01-01T00:00:00Z'), HOUR_MS);
    expect(samples.length, `${id}: hours of 2027 in the table`).toBe(8760);
    return summary(samples).litPct;
  }

  it('has the two reference points the checks and the demo use', () => {
    for (const id of ['shackleton-floor', 'shackleton-rim']) {
      expect(realSites.find((s) => s.id === id)?.status, id).toBe('reference');
    }
  });

  it('puts every sunlit south-pole point on ground that is lit most of the year', () => {
    for (const id of SUNLIT) expect(litPct(id), `${id}: % of 2027 lit`).toBeGreaterThan(70);
  }, 60_000);

  it('keeps the crater floor point in the dark all year', () => {
    expect(litPct('shackleton-floor')).toBe(0);
  }, 60_000);
});
