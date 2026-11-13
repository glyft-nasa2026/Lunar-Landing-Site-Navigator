// Checks web/public/data/sites.json against the contract (section 2). Skips while the file
// isn't there yet: T20 adds the mock list, T07 the real one.
import { existsSync, readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import type { CuratedSite } from './types';

const file = fileURLToPath(new URL('../../public/data/sites.json', import.meta.url));
const present = existsSync(file);

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
