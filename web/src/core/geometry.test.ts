// geometry.ts tests. The sanity tests at the top are T00's, on made-up tables. The checks
// against Skyfield (T02) need the real table and skip while web/public/data/ holds T20's mock.
import { existsSync, readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import { parseEphemeris, type Ephemeris, type EphemerisMeta } from './ephemeris';
import { destination, earthAltAz, sunAltAz } from './geometry';
import type { AltAz, Site } from './types';

const START = Date.parse('2027-01-01T00:00:00Z');

// A two-row table that holds still: the Sun at `sun`, Earth at `earthKm`.
function still(sun: number[], earthKm: number[]): Ephemeris {
  const buffer = new ArrayBuffer(48);
  const view = new DataView(buffer);
  [...sun, ...earthKm, ...sun, ...earthKm].forEach((v, i) => view.setFloat32(i * 4, v, true));
  return parseEphemeris({
    start: '2027-01-01T00:00:00Z', step_s: 3600, rows: 2, frame: 'MOON_ME_DE421',
    columns: [], source: 'made up for a test',
  }, buffer);
}

describe('sunAltAz', () => {
  const eph = still([1, 0, 0], [384400, 0, 0]);   // Sun over latitude 0, longitude 0

  it('is overhead at the point under the Sun', () => {
    expect(sunAltAz(eph, { lat: 0, lon: 0 }, 0, START).alt).toBeCloseTo(90, 4);
  });

  it('is on the horizon due west, seen from 90 degrees further east', () => {
    const a = sunAltAz(eph, { lat: 0, lon: 90 }, 0, START);
    expect(a.alt).toBeCloseTo(0, 6);
    expect(a.az).toBeCloseTo(270, 6);
  });

  it('is on the horizon due east, seen from 90 degrees further west', () => {
    const a = sunAltAz(eph, { lat: 0, lon: -90 }, 0, START);
    expect(a.alt).toBeCloseTo(0, 6);
    expect(a.az).toBeCloseTo(90, 6);
  });

  it('is due south at 45 degrees from latitude 45 N, and due north from 45 S', () => {
    const north = sunAltAz(eph, { lat: 45, lon: 0 }, 0, START);
    expect(north.alt).toBeCloseTo(45, 6);
    expect(north.az).toBeCloseTo(180, 6);
    const south = sunAltAz(eph, { lat: -45, lon: 0 }, 0, START);
    expect(south.alt).toBeCloseTo(45, 6);
    expect(south.az % 360).toBeCloseTo(0, 6);
  });

  it('sits on the horizon at the south pole when the Sun is over the equator', () => {
    expect(sunAltAz(eph, { lat: -90, lon: 0 }, 0, START).alt).toBeCloseTo(0, 6);
  });

  it('keeps azimuth within 0..360', () => {
    for (let lon = -180; lon <= 180; lon += 15) {
      const { az } = sunAltAz(eph, { lat: -60, lon }, 0, START);
      expect(az).toBeGreaterThanOrEqual(0);
      expect(az).toBeLessThan(360);
    }
  });
});

describe('earthAltAz', () => {
  const eph = still([0, 1, 0], [384400, 0, 0]);

  it('is overhead at the middle of the near side', () => {
    expect(earthAltAz(eph, { lat: 0, lon: 0 }, 0, START).alt).toBeCloseTo(90, 4);
  });

  it('is about 0.26 degrees below the horizon at the edge of the near side', () => {
    // Earth is close: standing 1,737 km to the side lowers it by atan(R / distance).
    const a = earthAltAz(eph, { lat: 0, lon: 90 }, 0, START);
    expect(a.alt).toBeCloseTo(-0.259, 2);
    expect(a.az).toBeCloseTo(270, 6);
  });

  it('sits a little lower when the site is higher', () => {
    const low = earthAltAz(eph, { lat: 0, lon: 60, eye_m: 0 }, 0, START).alt;
    const high = earthAltAz(eph, { lat: 0, lon: 60, eye_m: 0 }, 5000, START).alt;
    expect(high).toBeLessThan(low);                 // parallax grows with the site's radius
    expect(low - high).toBeLessThan(0.001);
  });
});

describe('destination', () => {
  it('moves 1 km north: latitude up by 0.03298 degrees, longitude unchanged', () => {
    const p = destination(-88, 45, 0, 1000);
    expect(p.lat - -88).toBeCloseTo(0.03298, 4);
    expect(p.lon).toBeCloseTo(45, 9);
  });

  it('moves 1 km east along the equator', () => {
    const p = destination(0, 10, 90, 1000);
    expect(p.lat).toBeCloseTo(0, 9);
    expect(p.lon - 10).toBeCloseTo(0.03298, 4);
  });

  it('keeps longitude between -180 and 180', () => {
    const p = destination(0, 179.99, 90, 1000);
    expect(p.lon).toBeLessThan(-179.9);
    expect(p.lon).toBeGreaterThanOrEqual(-180);
  });

  it('reaches the north pole after a quarter of the way round', () => {
    const quarter = (Math.PI / 2) * 1737.4 * 1000;
    expect(destination(0, 30, 0, quarter).lat).toBeCloseTo(90, 6);
  });

  it('moves 1 km north from anywhere south of 89.9 N: +0.03298 degrees within 0.0001', () => {
    for (const lat of [-90, -89.5, -88, -45, 0, 1, 26.3, 60, 89.9]) {
      for (const lon of [-180, -120, -46.8, 0, 23, 45, 120, 179.5]) {
        const p = destination(lat, lon, 0, 1000);
        expect(Math.abs(p.lat - lat - 0.03298), `from (${lat}, ${lon})`).toBeLessThanOrEqual(0.0001);
        // At the pole every direction is north, so longitude stays at the start value.
        expect(p.lon, `from (${lat}, ${lon})`).toBeCloseTo(lon === 180 ? -180 : lon, 9);
      }
    }
  });

  it('agrees with a rotation of the site vector for 500 random starts, bearings and distances', () => {
    // Independent of the formula in geometry.ts: walk the angle g = dist / R from the site's
    // "up" vector towards the starting direction, cos(b) north + sin(b) east.
    const RAD = Math.PI / 180;
    const random = seededRandom(1737);
    for (let i = 0; i < 500; i++) {
      const lat = -89.9 + random() * 179.8, lon = -180 + random() * 360;
      const bearing = random() * 360, distM = random() * 200_000;
      const cl = Math.cos(lat * RAD), sl = Math.sin(lat * RAD);
      const co = Math.cos(lon * RAD), so = Math.sin(lon * RAD);
      const cb = Math.cos(bearing * RAD), sb = Math.sin(bearing * RAD);
      const g = distM / (1737.4 * 1000);
      const n = [cl * co, cl * so, sl];
      const dir = [-sl * co * cb - so * sb, -sl * so * cb + co * sb, cl * cb];
      const q = n.map((v, k) => Math.cos(g) * v + Math.sin(g) * dir[k]);
      const wantLat = Math.asin(q[2]) / RAD, wantLon = Math.atan2(q[1], q[0]) / RAD;

      const got = destination(lat, lon, bearing, distM);
      const label = `(${lat}, ${lon}) bearing ${bearing} for ${distM} m`;
      expect(got.lat, label).toBeCloseTo(wantLat, 8);
      expect(azGap(got.lon, wantLon), label).toBeLessThan(1e-8);
      expect(got.lon, label).toBeGreaterThanOrEqual(-180);
      expect(got.lon, label).toBeLessThan(180);
    }
  });

  it('stays put for a distance of 0', () => {
    expect(destination(-87.67, 45, 123, 0)).toEqual({ lat: expect.closeTo(-87.67, 9), lon: expect.closeTo(45, 9) });
  });
});

// ---------------------------------------------------------------------------------------------
// T02: against Skyfield, with the real table built by parseEphemeris.

const DATA = '../../public/data/';
const metaFile = fileURLToPath(new URL(DATA + 'ephemeris.json', import.meta.url));
const binFile = fileURLToPath(new URL(DATA + 'ephemeris.bin', import.meta.url));
const fixtureFile = fileURLToPath(new URL('./__fixtures__/altaz.json', import.meta.url));

const realMeta: EphemerisMeta | null = existsSync(metaFile) && existsSync(binFile)
  ? JSON.parse(readFileSync(metaFile, 'utf8')) : null;
const real = realMeta !== null && realMeta.source !== 'mock' && existsSync(fixtureFile);

function realTable(): Ephemeris {
  const bytes = readFileSync(binFile);
  // Copy into an ArrayBuffer of its own: Node's Buffer may sit inside a larger shared pool.
  const buffer = bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength);
  return parseEphemeris(realMeta as EphemerisMeta, buffer as ArrayBuffer);
}

type Case = { lat: number; lon: number; t: string; sun: AltAz; earth: AltAz };

const TOL_DEG = 0.02;
const AZ_UNTIL_ALT = 89;   // near the zenith azimuth is ill-defined, so it isn't compared there

/** Smallest angle between two azimuths, 0..180. */
function azGap(a: number, b: number): number {
  const d = Math.abs(a - b) % 360;
  return d > 180 ? 360 - d : d;
}

/** Same numbers on every run, so a failure can be repeated. mulberry32. */
function seededRandom(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

describe.skipIf(!real)('against Skyfield (altaz.json, real table)', () => {
  const eph = real ? realTable() : (null as unknown as Ephemeris);
  const cases: Case[] = real ? JSON.parse(readFileSync(fixtureFile, 'utf8')) : [];

  it('has at least 20 cases, all inside the table', () => {
    expect(cases.length).toBeGreaterThanOrEqual(20);
    for (const c of cases) {
      const tMs = Date.parse(c.t);
      expect(tMs, c.t).toBeGreaterThanOrEqual(eph.startMs);
      expect(tMs, c.t).toBeLessThanOrEqual(eph.endMs);
    }
  });

  // Skyfield's fixture point is on the sphere itself: ground 0, eye 0.
  const site = (c: Case): Site => ({ lat: c.lat, lon: c.lon, eye_m: 0 });

  for (const [body, altAz] of [['sun', sunAltAz], ['earth', earthAltAz]] as const) {
    it(`matches every ${body} case within ${TOL_DEG} degrees`, () => {
      let worstAlt = 0, worstAz = 0;
      for (const c of cases) {
        const want = c[body];
        const got = altAz(eph, site(c), 0, Date.parse(c.t));
        const label = `${body} at (${c.lat}, ${c.lon}) ${c.t}`;
        const dAlt = Math.abs(got.alt - want.alt);
        worstAlt = Math.max(worstAlt, dAlt);
        expect(dAlt, `${label}: alt ${got.alt} vs ${want.alt}`).toBeLessThan(TOL_DEG);
        if (want.alt < AZ_UNTIL_ALT) {
          const dAz = azGap(got.az, want.az);
          worstAz = Math.max(worstAz, dAz);
          expect(dAz, `${label}: az ${got.az} vs ${want.az}`).toBeLessThan(TOL_DEG);
        }
      }
      console.info(`${body}: ${cases.length} cases, worst alt ${worstAlt.toFixed(5)} deg, `
        + `worst az ${worstAz.toFixed(5)} deg`);
    });
  }

  it('keeps the Sun within 1.6 degrees of the horizon at the south pole, 1,000 random times', () => {
    const random = seededRandom(20261114);
    const pole: Site = { lat: -90, lon: 0 };
    let lowest = Infinity, highest = -Infinity;
    for (let i = 0; i < 1000; i++) {
      const tMs = eph.startMs + random() * (eph.endMs - eph.startMs);
      const { alt } = sunAltAz(eph, pole, 0, tMs);
      lowest = Math.min(lowest, alt);
      highest = Math.max(highest, alt);
      expect(Math.abs(alt), new Date(tMs).toISOString()).toBeLessThanOrEqual(1.6);
    }
    console.info(`south pole Sun altitude over 1,000 times: ${lowest.toFixed(3)} to `
      + `${highest.toFixed(3)} deg`);
  });
});
