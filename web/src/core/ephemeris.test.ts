import { describe, expect, it } from 'vitest';
import { indexEphemeris, parseEphemeris, type EphemerisChunk, type EphemerisMeta } from './ephemeris';

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

// A table in two files, as the real one is split by decade. Each file ends on the row the
// next one starts with.
describe('a table in decade files', () => {
  const rowsA = [[1, 0, 0, 380000, 0, 0], [0, 1, 0, 381000, 0, 0], [-1, 0, 0, 382000, 0, 0]];
  const rowsB = [[-1, 0, 0, 382000, 0, 0], [0, -1, 0, 383000, 0, 0], [1, 0, 0, 384000, 0, 0]];
  const meta: EphemerisMeta = {
    start: '2027-01-01T00:00:00Z', step_s: 3600, rows: 5, frame: 'MOON_ME_DE440_ME421',
    columns: ['sun_x', 'sun_y', 'sun_z', 'earth_x_km', 'earth_y_km', 'earth_z_km'],
    source: 'made up for a test', home: 1,
    chunks: [
      { file: 'ephemeris/a.bin', start: '2027-01-01T00:00:00Z', rows: 3 },
      { file: 'ephemeris/b.bin', start: '2027-01-01T02:00:00Z', rows: 3 },
    ],
  };
  const a = table(rowsA).buffer;
  const b = table(rowsB).buffer;

  it('knows the whole span and the home decade before any file is in', () => {
    const idx = indexEphemeris(meta);
    expect(idx.startMs).toBe(START);
    expect(idx.endMs).toBe(START + 4 * HOUR);
    expect(idx.homeStartMs).toBe(START + 2 * HOUR);
    expect(idx.homeEndMs).toBe(START + 4 * HOUR);
    expect(idx.missing(idx.startMs, idx.endMs)).toEqual([0, 1]);
  });

  it('lists only the files a span needs; a shared boundary row belongs to the later file', () => {
    const idx = indexEphemeris(meta);
    expect(idx.missing(START, START + HOUR)).toEqual([0]);
    expect(idx.missing(START + 2 * HOUR, START + 3 * HOUR)).toEqual([1]);
    expect(idx.missing(START + HOUR, START + 3 * HOUR)).toEqual([0, 1]);
    expect(idx.missing(START + 4 * HOUR, START + 4 * HOUR)).toEqual([1]);
    expect(idx.missing(START - 10 * HOUR, START - 5 * HOUR)).toEqual([]);   // before the table
    expect(idx.missing(START + 9 * HOUR, START + 10 * HOUR)).toEqual([]);   // after it
  });

  it('adds a file without changing the table it came from', () => {
    const idx = indexEphemeris(meta);
    const one = idx.withChunk(1, b);
    expect(one).not.toBe(idx);
    expect(idx.missing(START, START + 4 * HOUR)).toEqual([0, 1]);
    expect(one.missing(START, START + 4 * HOUR)).toEqual([0]);
    expect(one.withChunk(0, a).missing(START, START + 4 * HOUR)).toEqual([]);
  });

  it('reads each file at its own times and steps across the seam', () => {
    const eph = indexEphemeris(meta).withChunk(0, a).withChunk(1, b);
    expect(eph.vectorsAt(START + HOUR).earthKm[0]).toBe(381000);
    expect(eph.vectorsAt(START + 2 * HOUR).earthKm[0]).toBe(382000);
    expect(eph.vectorsAt(START + 2.5 * HOUR).earthKm[0]).toBeCloseTo(382500, 3);
    expect(eph.vectorsAt(START + 1.5 * HOUR).earthKm[0]).toBeCloseTo(381500, 3);
    expect(eph.vectorsAt(START + 3 * HOUR).sun).toEqual([0, -1, 0]);
  });

  it('falls back to the nearest loaded row in a decade not yet loaded', () => {
    const home = indexEphemeris(meta).withChunk(1, b);
    expect(home.vectorsAt(START).earthKm[0]).toBe(382000);
    expect(Number.isNaN(indexEphemeris(meta).vectorsAt(START).sun[0])).toBe(true);
  });

  it('rejects files that do not join up, or a home that is not a file', () => {
    const chunks = meta.chunks as EphemerisChunk[];
    expect(() => indexEphemeris({ ...meta, chunks: [chunks[0], { ...chunks[1], start: '2027-01-01T03:00:00Z' }] }))
      .toThrow(/should start at/);
    expect(() => indexEphemeris({ ...meta, rows: 6 })).toThrow(/add up/);
    expect(() => indexEphemeris({ ...meta, home: 2 })).toThrow(/home/);
    expect(() => indexEphemeris(meta).withChunk(0, a.slice(0, 24))).toThrow(/a\.bin: 24 bytes, expected 72/);
    expect(() => parseEphemeris(meta, a)).toThrow(/one-file/);
  });
});
