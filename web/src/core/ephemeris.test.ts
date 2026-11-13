import { describe, expect, it } from 'vitest';
import { parseEphemeris, type EphemerisMeta } from './ephemeris';

// A made-up table, built in memory: the tests never need a data file.
function table(rows: number[][], step_s = 3600): { meta: EphemerisMeta; buffer: ArrayBuffer } {
  const meta: EphemerisMeta = {
    start: '2027-01-01T00:00:00Z', step_s, rows: rows.length, frame: 'MOON_ME_DE421',
    columns: ['sun_x', 'sun_y', 'sun_z', 'earth_x_km', 'earth_y_km', 'earth_z_km'],
    source: 'made up for a test',
  };
  const buffer = new ArrayBuffer(rows.length * 24);
  const view = new DataView(buffer);
  rows.forEach((row, r) => row.forEach((v, c) => view.setFloat32((r * 6 + c) * 4, v, true)));
  return { meta, buffer };
}

const START = Date.parse('2027-01-01T00:00:00Z');
const HOUR = 3_600_000;

describe('parseEphemeris', () => {
  const { meta, buffer } = table([
    [1, 0, 0, 384400, 0, 0],
    [0, 1, 0, 384400, 1000, 0],
    [0, 0, 1, 384400, 2000, 500],
  ]);
  const eph = parseEphemeris(meta, buffer);

  it('reads the start, the end and the meta', () => {
    expect(eph.startMs).toBe(START);
    expect(eph.endMs).toBe(START + 2 * HOUR);
    expect(eph.meta).toBe(meta);
  });

  it('returns a row unchanged at that row\'s time', () => {
    const v = eph.vectorsAt(START + HOUR);
    expect(v.sun).toEqual([0, 1, 0]);
    expect(v.earthKm).toEqual([384400, 1000, 0]);
  });

  it('steps in a straight line between rows and re-normalises the Sun', () => {
    const v = eph.vectorsAt(START + HOUR / 2);
    expect(Math.hypot(...v.sun)).toBeCloseTo(1, 6);
    expect(v.sun[0]).toBeCloseTo(Math.SQRT1_2, 6);
    expect(v.sun[1]).toBeCloseTo(Math.SQRT1_2, 6);
    expect(v.earthKm).toEqual([384400, 500, 0]);

    const late = eph.vectorsAt(START + 1.25 * HOUR);
    expect(late.earthKm[1]).toBeCloseTo(1250, 3);
    expect(late.earthKm[2]).toBeCloseTo(125, 3);
  });

  it('returns the nearest end row for a time outside the table, without crashing', () => {
    expect(eph.vectorsAt(START - 10 * HOUR).sun).toEqual([1, 0, 0]);
    expect(eph.vectorsAt(START + 10 * HOUR).earthKm).toEqual([384400, 2000, 500]);
    expect(eph.vectorsAt(Number.NaN).sun).toEqual([1, 0, 0]);
  });

  it('respects step_s', () => {
    const fast = table([[1, 0, 0, 1, 0, 0], [1, 0, 0, 3, 0, 0]], 60);
    const e = parseEphemeris(fast.meta, fast.buffer);
    expect(e.endMs).toBe(START + 60_000);
    expect(e.vectorsAt(START + 30_000).earthKm[0]).toBeCloseTo(2, 6);
  });

  it('rejects a file that is too short or a meta that makes no sense', () => {
    expect(() => parseEphemeris(meta, buffer.slice(0, 40))).toThrow(/expected 72/);
    expect(() => parseEphemeris({ ...meta, start: 'soon' }, buffer)).toThrow(/start/);
    expect(() => parseEphemeris({ ...meta, step_s: 0 }, buffer)).toThrow(/step_s/);
    expect(() => parseEphemeris({ ...meta, rows: 1 }, buffer)).toThrow(/rows/);
  });
});
