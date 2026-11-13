// Sanity tests by T00. T06 owns this file next and adds the real ones.
import { describe, expect, it } from 'vitest';
import { parseEphemeris, type Ephemeris } from './ephemeris';
import { countdownText, nextFlip, series, summary, SUN_RADIUS } from './windows';
import type { Sample, Skyline } from './types';

const START = Date.parse('2027-01-01T00:00:00Z');
const HOUR = 3_600_000;
const DAY = 24 * HOUR;
const MONTH_DAYS = 29.53;

// A made-up table: the Sun circles the Moon's equator once per 29.53 days, east to west, and is
// over longitude 0 at the start. Earth holds still over longitude 0.
function circlingSun(days: number): Ephemeris {
  const rows = days * 24 + 1;
  const buffer = new ArrayBuffer(rows * 24);
  const view = new DataView(buffer);
  for (let r = 0; r < rows; r++) {
    const lon = (-2 * Math.PI * (r / 24)) / MONTH_DAYS;
    [Math.cos(lon), Math.sin(lon), 0, 384400, 0, 0].forEach((v, c) => view.setFloat32((r * 6 + c) * 4, v, true));
  }
  return parseEphemeris({
    start: '2027-01-01T00:00:00Z', step_s: 3600, rows, frame: 'MOON_ME_DE421',
    columns: [], source: 'made up for a test',
  }, buffer);
}

const flat: Skyline = { elev: new Float32Array(360), terrain: false };
const eph = circlingSun(120);
const equator = { lat: 0, lon: 0 };

describe('series', () => {
  it('gives one sample per step, not counting the end', () => {
    const s = series(eph, equator, 0, flat, START, START + 30 * DAY, HOUR);
    expect(s).toHaveLength(720);
    expect(s[0].tMs).toBe(START);
    expect(s[719].tMs).toBe(START + 719 * HOUR);
  });

  it('fills every field from the contract formulas', () => {
    const [noon] = series(eph, equator, 0, flat, START, START + HOUR, HOUR);
    expect(noon.sun.alt).toBeCloseTo(90, 3);
    expect(noon.sunAbove).toBeCloseTo(90, 3);
    expect(noon.sunFrac).toBe(1);
    expect(noon.earth.alt).toBeCloseTo(90, 3);
    expect(noon.earthUp).toBe(true);
  });

  it('measures against the skyline, and sunFrac is the share of the disc above it', () => {
    const wall: Skyline = { elev: new Float32Array(360).fill(89.9), terrain: true };
    const [s] = series(eph, { lat: 0, lon: -0.1 }, 0, wall, START, START + HOUR, HOUR);
    expect(s.sunAbove).toBeCloseTo(0, 2);
    expect(s.sunFrac).toBeCloseTo(0.5, 1);
    const [hidden] = series(eph, { lat: 0, lon: 0 }, 0, { elev: new Float32Array(360).fill(91), terrain: true }, START, START + HOUR, HOUR);
    expect(hidden.sunFrac).toBe(0);
    expect(hidden.earthUp).toBe(false);
  });

  it('leaves out times outside the table, and stays on the hour grid', () => {
    const tail = series(eph, equator, 0, flat, eph.endMs - 5 * HOUR, eph.endMs + 30 * DAY, HOUR);
    expect(tail).toHaveLength(5);
    const head = series(eph, equator, 0, flat, START - 2.5 * HOUR, START + 2 * HOUR, HOUR);
    expect(head.map((s) => s.tMs)).toEqual([START + 0.5 * HOUR, START + 1.5 * HOUR]);
    expect(series(eph, equator, 0, flat, START, START + DAY, 0)).toEqual([]);
  });
});

describe('summary', () => {
  it('is lit half the time at the equator under a flat skyline', () => {
    const s = summary(series(eph, equator, 0, flat, START, START + 60 * DAY, HOUR));
    expect(s.litPct).toBeGreaterThan(48);
    expect(s.litPct).toBeLessThan(52);
    expect(s.longestLit_h).toBeCloseTo((MONTH_DAYS * 24) / 2, -1);
    expect(s.longestDark_h).toBeCloseTo((MONTH_DAYS * 24) / 2, -1);
    expect(s.earthPct).toBe(100);
    expect(s.longestEarthGap_h).toBe(0);
  });

  it('finds the longest runs', () => {
    const mk = (i: number, lit: boolean, earthUp: boolean): Sample => ({
      tMs: i * HOUR, sun: { alt: 0, az: 0 }, earth: { alt: 0, az: 0 },
      sunAbove: 0, earthAbove: 0, sunFrac: lit ? 1 : 0, earthUp,
    });
    const lit = [1, 1, 0, 1, 1, 1, 0, 0, 0, 0];
    const up = [0, 0, 1, 1, 0, 0, 0, 1, 1, 1];
    const s = summary(lit.map((l, i) => mk(i, l === 1, up[i] === 1)));
    expect(s).toEqual({ litPct: 50, longestLit_h: 3, longestDark_h: 4, earthPct: 50, longestEarthGap_h: 3 });
  });

  it('is all zeros for no samples', () => {
    expect(summary([])).toEqual({ litPct: 0, longestLit_h: 0, longestDark_h: 0, earthPct: 0, longestEarthGap_h: 0 });
  });
});

describe('nextFlip', () => {
  it('finds sunset a quarter of a month after noon, to the minute', () => {
    const flip = nextFlip(eph, equator, 0, flat, START, 'sun');
    // The last sliver goes when the centre is SUN_RADIUS below the skyline.
    const expected = START + ((90 + SUN_RADIUS) / 360) * MONTH_DAYS * DAY;
    expect(flip?.type).toBe('set');
    expect(Math.abs((flip?.tMs ?? 0) - expected)).toBeLessThan(2 * 60_000);
  });

  it('finds sunrise when it starts in the dark', () => {
    const midnight = START + (MONTH_DAYS / 2) * DAY;
    const flip = nextFlip(eph, equator, 0, flat, midnight, 'sun');
    const expected = START + ((270 - SUN_RADIUS) / 360) * MONTH_DAYS * DAY;
    expect(flip?.type).toBe('rise');
    expect(Math.abs((flip?.tMs ?? 0) - expected)).toBeLessThan(2 * 60_000);
  });

  it('returns null when nothing changes within maxDays, or before the table ends', () => {
    expect(nextFlip(eph, equator, 0, flat, START, 'sun', 5)).toBeNull();
    expect(nextFlip(eph, equator, 0, flat, START, 'earth')).toBeNull();      // Earth holds still
    expect(nextFlip(eph, equator, 0, flat, eph.endMs - HOUR, 'sun')).toBeNull();
  });
});

describe('countdownText', () => {
  const t = START;
  const after = (d: number, h: number, min = 0): number => t + d * DAY + h * HOUR + min * 60_000;

  it('words every row of the contract table', () => {
    expect(countdownText('sun', true, { type: 'set', tMs: after(3, 4) }, t)).toBe('Sunset in 3 d 4 h');
    expect(countdownText('sun', false, { type: 'rise', tMs: after(3, 4) }, t)).toBe('Sunrise in 3 d 4 h');
    expect(countdownText('sun', true, null, t)).toBe('No sunset in the next 60 days');
    expect(countdownText('sun', false, null, t)).toBe('No sunrise in the next 60 days');
    expect(countdownText('sun', false, null, t, true)).toBe('Permanently shadowed (2026-2035)');
    expect(countdownText('earth', true, { type: 'set', tMs: after(3, 4) }, t)).toBe('Earthset in 3 d 4 h');
    expect(countdownText('earth', false, { type: 'rise', tMs: after(3, 4) }, t)).toBe('Earthrise in 3 d 4 h');
    expect(countdownText('earth', true, null, t)).toBe('Earth always visible');
    expect(countdownText('earth', false, null, t)).toBe('Earth never visible');
  });

  it('reads hours and minutes under one day', () => {
    expect(countdownText('sun', true, { type: 'set', tMs: after(0, 5, 20) }, t)).toBe('Sunset in 5 h 20 min');
    expect(countdownText('sun', true, { type: 'set', tMs: after(0, 23, 59) }, t)).toBe('Sunset in 23 h 59 min');
    expect(countdownText('sun', true, { type: 'set', tMs: after(1, 0) }, t)).toBe('Sunset in 1 d 0 h');
  });
});
