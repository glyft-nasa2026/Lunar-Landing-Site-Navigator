// T03: holds the browser's own maths to JPL Horizons. Builds the real table from
// web/public/data/ephemeris.*, runs sunAltAz and earthAltAz (ground 0, eye 0) on every case in
// __fixtures__/horizons.json, and fails above 0.1 degrees. Skips while the table is mock or a
// file is missing. The difference is the angle on the sky between the two directions, so a
// body near the zenith (where azimuth alone means little) is judged fairly.
import { existsSync, readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import { parseEphemeris, type EphemerisMeta } from './ephemeris';
import { earthAltAz, sunAltAz } from './geometry';
import type { AltAz, Body } from './types';

type HorizonsCase = { lat: number; lon: number; t: string; body: Body; alt: number; az: number };

const path = (rel: string): string => fileURLToPath(new URL(rel, import.meta.url));
const metaFile = path('../../public/data/ephemeris.json');
const binFile = path('../../public/data/ephemeris.bin');
const fixtureFile = path('./__fixtures__/horizons.json');

const present = existsSync(metaFile) && existsSync(binFile) && existsSync(fixtureFile);
const meta: EphemerisMeta | null = present ? JSON.parse(readFileSync(metaFile, 'utf8')) : null;
const real = meta !== null && meta.source !== 'mock';

const TOLERANCE_DEG = 0.1;
const RAD = Math.PI / 180;

function separationDeg(a: AltAz, b: AltAz): number {
  const c = Math.sin(a.alt * RAD) * Math.sin(b.alt * RAD)
    + Math.cos(a.alt * RAD) * Math.cos(b.alt * RAD) * Math.cos((a.az - b.az) * RAD);
  return Math.acos(Math.max(-1, Math.min(1, c))) / RAD;
}

describe.skipIf(!real)('browser maths vs JPL Horizons', () => {
  const cases: HorizonsCase[] = real ? JSON.parse(readFileSync(fixtureFile, 'utf8')) : [];
  const bin = real ? readFileSync(binFile) : Buffer.alloc(0);
  const buffer = bin.buffer.slice(bin.byteOffset, bin.byteOffset + bin.byteLength) as ArrayBuffer;
  const eph = real && meta ? parseEphemeris(meta, buffer) : null;

  it('has 18 cases: 3 sites x 3 times x 2 bodies', () => {
    expect(cases.length).toBe(18);
  });

  it.each(cases.map((c) => [`${c.body} at (${c.lat}, ${c.lon}) ${c.t}`, c] as const))(
    '%s is within 0.1 degrees',
    (_label, c) => {
      const site = { lat: c.lat, lon: c.lon, eye_m: 0 };
      const tMs = Date.parse(c.t);
      const ours = c.body === 'sun' ? sunAltAz(eph!, site, 0, tMs) : earthAltAz(eph!, site, 0, tMs);
      const diff = separationDeg(ours, { alt: c.alt, az: c.az });
      expect(diff, `ours ${ours.alt.toFixed(4)}/${ours.az.toFixed(4)}, `
        + `Horizons ${c.alt}/${c.az}`).toBeLessThan(TOLERANCE_DEG);
    },
  );
});
