// T11 tests for the sky panorama's data. No Plotly and no page: model.ts is plain data.
import { describe, expect, it } from 'vitest';
import type { Sample, Skyline } from '../../core/types';
import { SUN_RADIUS } from '../../core/windows';
import {
  groundOf, pathOf, skyModel, sunMarkerPx, sunStateOf, yTopOf, Y_BOTTOM, Y_TOP_DEFAULT,
} from './model';

const T0 = Date.UTC(2027, 0, 1);
const HOUR = 3_600_000;

function sample(i: number, sunAz: number, sunAlt: number, earthAz = 0, earthAlt = 5,
  sunFrac = 1, earthUp = true): Sample {
  return {
    tMs: T0 + i * HOUR,
    sun: { az: sunAz, alt: sunAlt }, earth: { az: earthAz, alt: earthAlt },
    sunAbove: 0, earthAbove: 0, sunFrac, earthUp,
  };
}

function skylineOf(f: (az: number) => number, terrain = true): Skyline {
  const elev = new Float32Array(360);
  for (let az = 0; az < 360; az++) elev[az] = f(az);
  return { elev, terrain };
}

describe('pathOf', () => {
  it('breaks the line where azimuth wraps from 360 to 0, and nowhere else', () => {
    const s = [sample(0, 350, 1), sample(1, 355, 1.1), sample(2, 2, 1.2), sample(3, 7, 1.3)];
    const p = pathOf(s, 'sun');
    expect(p.x).toEqual([350, 355, null, 2, 7]);
    expect(p.y).toEqual([1, 1.1, null, 1.2, 1.3]);
  });

  it('breaks the other way too (0 back to 360)', () => {
    const p = pathOf([sample(0, 3, 0, 3), sample(1, 357, 0, 357)], 'earth');
    expect(p.x).toEqual([3, null, 357]);
  });

  it('is empty with no samples', () => {
    expect(pathOf([], 'sun')).toEqual({ x: [], y: [] });
  });
});

describe('groundOf', () => {
  it('runs 0..360 along the skyline, closes below the axis, and repeats azimuth 0 at 360', () => {
    const g = groundOf(skylineOf((az) => az / 100));
    expect(g.x).toHaveLength(363);
    expect(g.x[0]).toBe(0);
    expect(g.y[0]).toBeLessThan(Y_BOTTOM);
    expect(g.x[1]).toBe(0);
    expect(g.y[1]).toBe(0);
    expect(g.y[1 + 90]).toBeCloseTo(0.9, 6);
    expect(g.x[361]).toBe(360);
    expect(g.y[361]).toBe(g.y[1]);
    expect(g.x[362]).toBe(360);
    expect(g.y[362]).toBeLessThan(Y_BOTTOM);
  });
});

describe('sunStateOf: same rule as the readout (hidden when sunFrac is 0)', () => {
  it('names the three states', () => {
    expect(sunStateOf(0)).toBe('hidden');
    expect(sunStateOf(0.01)).toBe('partly');
    expect(sunStateOf(0.99)).toBe('partly');
    expect(sunStateOf(1)).toBe('up');
  });
});

describe('yTopOf', () => {
  it('stays at 15 degrees near the pole', () => {
    expect(yTopOf([1.5, -1.5, 3, 12.9])).toBe(Y_TOP_DEFAULT);
  });

  it('rises to a whole 5 degrees above anything higher than 15, at most 90', () => {
    expect(yTopOf([16.4])).toBe(20);
    expect(yTopOf([66])).toBe(70);
    expect(yTopOf([89.9])).toBe(90);
  });

  it('ignores values that are not numbers', () => {
    expect(yTopOf([NaN, Infinity, 2])).toBe(Y_TOP_DEFAULT);
  });
});

describe('skyModel', () => {
  it('gives "now" from the first sample when its time is the scenario time', () => {
    const sky = skylineOf((az) => (az >= 80 && az <= 100 ? 4 : 0));
    const s = [sample(0, 90, 1, 200, 3, 0, true), sample(1, 91, 1.1)];
    const m = skyModel(s, sky, T0);
    expect(m.now).not.toBeNull();
    expect(m.now?.sun).toEqual({ az: 90, alt: 1 });
    expect(m.now?.sunState).toBe('hidden');
    expect(m.now?.skylineAtSun).toBe(4);
    expect(m.now?.skylineAtEarth).toBe(0);
    expect(m.now?.earthUp).toBe(true);
  });

  it('has no "now" when the scenario time is outside the table', () => {
    expect(skyModel([], skylineOf(() => 0), T0).now).toBeNull();
    expect(skyModel([sample(0, 0, 0)], skylineOf(() => 0), T0 + HOUR).now).toBeNull();
  });

  it('crater floor: a skyline of 16 degrees all round raises the axis so it shows', () => {
    const m = skyModel([sample(0, 10, 1)], skylineOf(() => 16), T0);
    expect(m.yTop).toBe(20);
  });

  it('Apollo-like site: Earth high in the sky raises the axis above it', () => {
    const s = [0, 1, 2].map((i) => sample(i, 100 + i, -30, 250, 66 + i));
    const m = skyModel(s, skylineOf(() => 0, false), T0);
    expect(m.yTop).toBeGreaterThanOrEqual(70);
    expect(m.now?.earth.alt).toBe(66);
  });
});

describe('sunMarkerPx', () => {
  it("is the Sun's true diameter on the elevation axis", () => {
    // 20 degrees over 200 px: 10 px per degree, and the disc is 2 * 0.267 degrees.
    expect(sunMarkerPx(200, 15, 1)).toBeCloseTo(2 * SUN_RADIUS * 10, 6);
  });

  it('never goes under the minimum, and falls back to it with no height', () => {
    expect(sunMarkerPx(200, 90, 8)).toBe(8);
    expect(sunMarkerPx(0, 15, 8)).toBe(8);
  });
});
