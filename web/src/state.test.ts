import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { indexEphemeris, parseEphemeris, type Ephemeris } from './core/ephemeris';
import {
  flipFor, getState, LIVE_ID, neverLitFor, pin, restoreFromAddress, samplesFor, select, selected,
  setData, setGhost, setLiveSite, setLiveTime, setMode, setRange, shiftWindow, skylineFor,
  stateToAddress, subscribe, summaryFor, timelineFor, unpin,
} from './state';

const HOUR = 3_600_000;
const DAY = 24 * HOUR;
const T0 = Date.parse('2027-01-01T00:00:00Z');

// A made-up table: the Sun circles the equator once per 29.53 days; Earth holds still.
function circlingSun(days: number): Ephemeris {
  const rows = days * 24 + 1;
  const buffer = new ArrayBuffer(rows * 24);
  const view = new DataView(buffer);
  for (let r = 0; r < rows; r++) {
    const lon = (-2 * Math.PI * (r / 24)) / 29.53;
    [Math.cos(lon), Math.sin(lon), 0, 384400, 0, 0].forEach((v, c) => view.setFloat32((r * 6 + c) * 4, v, true));
  }
  return parseEphemeris({
    start: '2027-01-01T00:00:00Z', step_s: 3600, rows, frame: 'MOON_ME_DE421',
    columns: [], source: 'made up for a test',
  }, buffer);
}

beforeEach(() => {
  restoreFromAddress('', T0);
  setData({ eph: null, dem: null, sites: [] });
});

describe('start', () => {
  it('opens on the live scenario, nothing pinned, 30 days, 2D', () => {
    const s = getState();
    expect(s.live.id).toBe(LIVE_ID);
    expect(s.live.tMs).toBe(T0);
    expect(s.pinned).toEqual([]);
    expect(s.ghost).toBeNull();
    expect(s.selectedId).toBe(LIVE_ID);
    expect(s.range).toBe('30d');
    expect(s.mode).toBe('2d');
    expect(s.windowStartMs).toBe(T0);
    expect(selected()).toBe(s.live);
  });

  it('starts on the whole hour', () => {
    restoreFromAddress('', T0 + 25 * 60_000);
    expect(getState().live.tMs).toBe(T0);
  });
});

describe('page address (F17)', () => {
  it('pin two scenarios, rebuild state from the page address, both are back', () => {
    setLiveSite({ lat: -88, lon: 45 });
    setLiveTime(T0 + 3 * DAY);
    pin();
    setLiveSite({ lat: -87.67, lon: 45, eye_m: 10 });
    setLiveTime(T0 + 10 * DAY + 90_500);
    pin();
    setLiveSite({ lat: 1, lon: 23 });
    const before = getState();
    expect(before.pinned).toHaveLength(2);

    const address = stateToAddress();
    restoreFromAddress('', T0);                       // a fresh page...
    expect(getState().pinned).toEqual([]);
    restoreFromAddress('#' + address, T0);            // ...opened with the link

    const after = getState();
    expect(after.pinned).toEqual(before.pinned);
    expect(after.pinned.map((p) => p.color)).toEqual(['--scn-a', '--scn-b']);
    expect(after.pinned[1].site).toEqual({ lat: -87.67, lon: 45, eye_m: 10 });
    expect(after.pinned[1].tMs).toBe(T0 + 10 * DAY + 90_500);
    expect(after.live).toEqual(before.live);
  });

  it('keeps the selected scenario, the range and the mode', () => {
    pin();
    pin();
    select('b');
    setRange('90d');
    setMode('3d');
    const address = stateToAddress();
    restoreFromAddress(address, T0 + 99 * DAY);
    const s = getState();
    expect(s.selectedId).toBe('b');
    expect(s.range).toBe('90d');
    expect(s.mode).toBe('3d');
    expect(s.live.tMs).toBe(T0);
  });

  it('keeps a pinned scenario in its own slot when an earlier one was removed', () => {
    pin();
    pin();
    unpin('a');
    restoreFromAddress(stateToAddress(), T0);
    expect(getState().pinned.map((p) => [p.id, p.label, p.color])).toEqual([['b', 'B', '--scn-b']]);
  });

  it('reads like this', () => {
    setLiveSite({ lat: -88, lon: 45 });
    pin();
    expect(stateToAddress()).toBe('live=-88,45,2027-01-01T00:00:00Z&a=-88,45,2027-01-01T00:00:00Z');
  });

  it('ignores the parts of an address that make no sense', () => {
    restoreFromAddress('#live=95,0,2027-01-01T00:00:00Z&a=banana&b=-88,45,not-a-date&c=-89,10,2027-02-01T00:00:00Z&sel=b&range=7d&mode=4d&x=1', T0);
    const s = getState();
    expect(s.live.site).toEqual({ lat: -89.5, lon: 0 });
    expect(s.live.tMs).toBe(T0);
    expect(s.pinned.map((p) => p.id)).toEqual(['c']);
    expect(s.selectedId).toBe(LIVE_ID);
    expect(s.range).toBe('30d');
    expect(s.mode).toBe('2d');
    expect(() => restoreFromAddress('%%%&&&===,,,', T0)).not.toThrow();
  });

  it('keeps loaded data when an address is restored', () => {
    const eph = circlingSun(10);
    setData({ eph });
    restoreFromAddress('a=-88,45,2027-01-02T00:00:00Z', T0);
    expect(getState().eph).toBe(eph);
  });
});

describe('timeline window', () => {
  it('setLiveTime inside the window keeps windowStartMs', () => {
    setLiveTime(T0 + 12 * DAY);
    expect(getState().windowStartMs).toBe(T0);
    setLiveTime(T0 + 30 * DAY);                       // the right edge is still inside
    expect(getState().windowStartMs).toBe(T0);
    setLiveTime(T0);
    expect(getState().windowStartMs).toBe(T0);
    expect(getState().live.tMs).toBe(T0);
  });

  it('setLiveTime outside the window restarts it at the new time', () => {
    setLiveTime(T0 + 31 * DAY);
    expect(getState().windowStartMs).toBe(T0 + 31 * DAY);
    setLiveTime(T0 + 30 * DAY);                       // now before the window
    expect(getState().windowStartMs).toBe(T0 + 30 * DAY);
  });

  it('shiftWindow moves by half the range, and leaves the live time alone', () => {
    shiftWindow(1);
    expect(getState().windowStartMs).toBe(T0 + 15 * DAY);
    shiftWindow(-1);
    shiftWindow(-1);
    expect(getState().windowStartMs).toBe(T0 - 15 * DAY);
    setRange('90d');
    shiftWindow(1);
    expect(getState().windowStartMs).toBe(T0 + 30 * DAY);
    expect(getState().live.tMs).toBe(T0);
  });

  it('setRange keeps the window while the live time is inside the new one', () => {
    setLiveTime(T0 + 20 * DAY);
    setRange('365d');
    expect(getState().windowStartMs).toBe(T0);
    setLiveTime(T0 + 200 * DAY);
    expect(getState().windowStartMs).toBe(T0);
    setRange('30d');                                  // day 200 is no longer inside
    expect(getState().windowStartMs).toBe(T0 + 200 * DAY);
  });
});

describe('selected and live', () => {
  it('pins up to three, coloured A, B, C in order', () => {
    pin(); pin(); pin(); pin();
    const s = getState();
    expect(s.pinned.map((p) => p.id)).toEqual(['a', 'b', 'c']);
    expect(s.pinned.map((p) => p.label)).toEqual(['A', 'B', 'C']);
    expect(s.pinned.map((p) => p.color)).toEqual(['--scn-a', '--scn-b', '--scn-c']);
    expect(s.selectedId).toBe(LIVE_ID);
  });

  it('pinned scenarios never change', () => {
    setLiveSite({ lat: -88, lon: 45 });
    pin();
    const pinnedBefore = getState().pinned[0];
    setLiveSite({ lat: -80, lon: -120 });
    setLiveTime(T0 + 5 * DAY);
    expect(getState().pinned[0]).toEqual(pinnedBefore);
    expect(getState().pinned[0].site).toEqual({ lat: -88, lon: 45 });
    expect(getState().pinned[0].tMs).toBe(T0);
  });

  it('an edit lands on live and selects it, even with a pinned scenario selected', () => {
    pin();
    select('a');
    expect(selected().id).toBe('a');
    setLiveTime(T0 + DAY);
    expect(getState().selectedId).toBe(LIVE_ID);
    select('a');
    setLiveSite({ lat: 10, lon: 20 });
    expect(selected().id).toBe(LIVE_ID);
    expect(selected().site).toEqual({ lat: 10, lon: 20 });
  });

  it('unpinning the selected scenario selects live, and frees the colour', () => {
    pin(); pin();
    select('a');
    unpin('a');
    expect(getState().selectedId).toBe(LIVE_ID);
    expect(getState().pinned.map((p) => p.id)).toEqual(['b']);
    pin();
    expect(getState().pinned.map((p) => p.id)).toEqual(['a', 'b']);
  });

  it('ignores an unknown id, a bad site and a bad time', () => {
    const before = getState();
    select('z');
    unpin('z');
    setLiveSite({ lat: 95, lon: 0 });
    setLiveSite({ lat: Number.NaN, lon: 0 });
    setLiveTime(Number.NaN);
    expect(getState()).toBe(before);
  });

  it('keeps longitude between -180 and 180', () => {
    setLiveSite({ lat: 0, lon: 190 });
    expect(getState().live.site.lon).toBe(-170);
    setLiveSite({ lat: 0, lon: 359 });
    expect(getState().live.site.lon).toBe(-1);
    setLiveSite({ lat: 0, lon: 180 });
    expect(getState().live.site.lon).toBe(180);
  });

  it('sets and clears the ghost without touching live', () => {
    const live = getState().live;
    setGhost({ id: 'ghost', label: 'Ghost', color: '--scn-ghost', site: { lat: -88, lon: 45 }, tMs: T0 });
    expect(getState().ghost?.color).toBe('--scn-ghost');
    expect(getState().live).toBe(live);
    setGhost(null);
    expect(getState().ghost).toBeNull();
  });

  it('tells subscribers about each change until they unsubscribe', () => {
    let calls = 0;
    const stop = subscribe(() => { calls++; });
    setLiveTime(T0 + HOUR);
    pin();
    expect(calls).toBe(2);
    stop();
    setLiveTime(T0 + 2 * HOUR);
    expect(calls).toBe(2);
  });
});

describe('cached accessors', () => {
  it('while eph is null: empty arrays, null flips, a flat skyline and zeros', () => {
    const live = getState().live;
    expect(samplesFor(live, '30d')).toEqual([]);
    expect(timelineFor(live, '30d')).toEqual([]);
    expect(flipFor(live, 'sun')).toBeNull();
    expect(flipFor(live, 'earth')).toBeNull();
    expect(neverLitFor(live)).toBe(false);
    expect(summaryFor(live)).toEqual({ litPct: 0, longestLit_h: 0, longestDark_h: 0, earthPct: 0, longestEarthGap_h: 0 });
    const sky = skylineFor(live);
    expect(sky.terrain).toBe(false);
    expect(Array.from(sky.elev)).toEqual(new Array(360).fill(0));
  });

  it('gives live numbers once the table is in', () => {
    setData({ eph: circlingSun(400) });
    setLiveSite({ lat: 0, lon: 0 });
    const live = getState().live;

    const samples = samplesFor(live, '30d');
    expect(samples).toHaveLength(720);
    expect(samples[0].tMs).toBe(T0);
    expect(samples[0].sun.alt).toBeCloseTo(90, 3);
    expect(samplesFor(live, '90d')).toHaveLength(2160);
    expect(samplesFor(live, '365d')).toHaveLength(8760);

    const sum = summaryFor(live);
    expect(sum.litPct).toBeGreaterThan(45);
    expect(sum.litPct).toBeLessThan(55);
    expect(sum.earthPct).toBe(100);

    expect(flipFor(live, 'sun')?.type).toBe('set');
    expect(flipFor(live, 'earth')).toBeNull();
    expect(neverLitFor(live)).toBe(false);
  });

  it('the Sun altitude changes when the time changes', () => {
    setData({ eph: circlingSun(60) });
    setLiveSite({ lat: 0, lon: 0 });
    const noon = samplesFor(selected(), '30d')[0].sun.alt;
    setLiveTime(T0 + 3 * DAY);
    const later = samplesFor(selected(), '30d')[0].sun.alt;
    expect(noon).toBeCloseTo(90, 3);
    expect(later).toBeCloseTo(90 - (3 / 29.53) * 360, 2);
  });

  it('returns the same array for the same question, and a new one after new data', () => {
    setData({ eph: circlingSun(60) });
    const live = getState().live;
    const first = samplesFor(live, '30d');
    expect(samplesFor(live, '30d')).toBe(first);
    setData({ eph: circlingSun(61) });
    expect(samplesFor(live, '30d')).not.toBe(first);
  });

  it('the timeline starts at the window for live and at its own time for a pinned scenario', () => {
    setData({ eph: circlingSun(400) });
    setLiveTime(T0 + 10 * DAY);                       // inside the window: it stays at T0
    pin();
    const s = getState();
    expect(s.windowStartMs).toBe(T0);
    expect(timelineFor(s.live, '30d')[0].tMs).toBe(T0);
    expect(timelineFor(s.pinned[0], '30d')[0].tMs).toBe(T0 + 10 * DAY);
    shiftWindow(1);
    expect(timelineFor(getState().live, '30d')[0].tMs).toBe(T0 + 15 * DAY);
    expect(timelineFor(getState().pinned[0], '30d')[0].tMs).toBe(T0 + 10 * DAY);
  });

  it('neverLitFor is true where the Sun never clears the skyline to the end of the table', () => {
    // At the south pole this Sun sits exactly on the horizon: half its disc shows.
    setData({ eph: circlingSun(60) });
    setLiveSite({ lat: -90, lon: 0 });
    expect(neverLitFor(getState().live)).toBe(false);
    // With the Sun fixed over the north pole instead, the south pole never sees it. Two rows a
    // day apart: 61 days, past the 60 days needed before the end of the table.
    const buffer = new ArrayBuffer(48);
    const view = new DataView(buffer);
    [0, 0, 1, 384400, 0, 0, 0, 0, 1, 384400, 0, 0].forEach((v, i) => view.setFloat32(i * 4, v, true));
    setData({ eph: parseEphemeris({ start: '2027-01-01T00:00:00Z', step_s: 61 * 86400, rows: 2, frame: 'MOON_ME_DE421', columns: [], source: 'made up for a test' }, buffer) });
    expect(neverLitFor(getState().live)).toBe(true);
  });
});

describe('decades of the table (loaded as needed)', () => {
  // Two 200-day files, the first one home: the same circling Sun, split where the real
  // table splits by decade.
  const DAYS = 200;
  function rows(fromRow: number, count: number): ArrayBuffer {
    const buffer = new ArrayBuffer(count * 24);
    const view = new DataView(buffer);
    for (let k = 0; k < count; k++) {
      const lon = (-2 * Math.PI * ((fromRow + k) / 24)) / 29.53;
      [Math.cos(lon), Math.sin(lon), 0, 384400, 0, 0].forEach((v, c) => view.setFloat32((k * 6 + c) * 4, v, true));
    }
    return buffer;
  }
  const perFile = DAYS * 24 + 1;
  const index = indexEphemeris({
    start: '2027-01-01T00:00:00Z', step_s: 3600, rows: 2 * perFile - 1, frame: 'MOON_ME_DE440_ME421',
    columns: [], source: 'made up for a test', home: 0,
    chunks: [
      { file: 'ephemeris/first.bin', start: '2027-01-01T00:00:00Z', rows: perFile },
      { file: 'ephemeris/second.bin', start: new Date(T0 + DAYS * DAY).toISOString(), rows: perFile },
    ],
  });
  const second = rows(perFile - 1, perFile);
  const later = T0 + (DAYS + 50) * DAY;

  let asked: string[] = [];
  let answer: (url: string) => Promise<Response>;
  beforeEach(() => {
    asked = [];
    answer = async () => new Response(second);
    vi.stubGlobal('fetch', (url: string) => { asked.push(url); return answer(url); });
    setData({ eph: index.withChunk(0, rows(0, perFile)) });
  });
  afterEach(() => { vi.unstubAllGlobals(); });

  const settle = (): Promise<void> => new Promise((r) => setTimeout(r, 0));

  it('needs nothing more while every scenario sits in the home decade', () => {
    expect(getState().eph).not.toBeNull();
    expect(samplesFor(getState().live, '30d')).toHaveLength(30 * 24);
    expect(asked).toEqual([]);
  });

  it('reads "Loading" (eph null) while a needed decade downloads, then fills it in', async () => {
    setLiveTime(later);
    expect(getState().eph).toBeNull();
    await settle();
    expect(asked).toEqual(['/data/ephemeris/second.bin']);
    const s = getState();
    expect(s.eph).not.toBeNull();
    const now = samplesFor(s.live, '30d')[0];
    expect(now.tMs).toBe(later);
    expect(flipFor(s.live, 'sun')).not.toBeNull();
    setLiveTime(later + DAY);          // already in memory: no second download
    expect(getState().eph).not.toBeNull();
    expect(asked).toHaveLength(1);
  });

  it('a pinned scenario in another decade holds the page on "Loading" too', async () => {
    setLiveTime(later);
    pin();
    setLiveTime(T0);
    expect(getState().eph).toBeNull();  // the pin still needs the second file
    await settle();
    expect(getState().eph).not.toBeNull();
    expect(samplesFor(getState().pinned[0], '30d')[0].tMs).toBe(later);
  });

  it('a decade that fails to download reads as outside the table, and is not asked for again', async () => {
    answer = async () => new Response('', { status: 404 });
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    setLiveTime(later);
    await settle();
    expect(getState().eph).not.toBeNull();
    expect(samplesFor(getState().live, '30d')).toEqual([]);
    expect(flipFor(getState().live, 'sun')).toBeNull();
    setLiveTime(later + DAY);
    expect(asked).toHaveLength(1);
    expect(warn).toHaveBeenCalled();
    warn.mockRestore();
  });

  it('"never lit" needs no download where the Sun rises within 60 days', () => {
    expect(neverLitFor(getState().live)).toBe(false);
    expect(asked).toEqual([]);
  });
});

describe('"never lit" from the chosen time to the end of the table', () => {
  // Three 100-day files. The Sun holds still: +z is below the south-pole horizon, -z overhead.
  const DAYS = 100;
  const perFile = DAYS * 24 + 1;
  function steady(z: number): ArrayBuffer {
    const buffer = new ArrayBuffer(perFile * 24);
    const view = new DataView(buffer);
    for (let k = 0; k < perFile; k++) {
      [0, 0, z, 384400, 0, 0].forEach((v, c) => view.setFloat32((k * 6 + c) * 4, v, true));
    }
    return buffer;
  }
  const index = indexEphemeris({
    start: '2027-01-01T00:00:00Z', step_s: 3600, rows: 3 * perFile - 2, frame: 'MOON_ME_DE440_ME421',
    columns: [], source: 'made up for a test', home: 0,
    chunks: [0, 1, 2].map((k) => ({
      file: `ephemeris/${k}.bin`, start: new Date(T0 + k * DAYS * DAY).toISOString(), rows: perFile,
    })),
  });
  const settle = (): Promise<void> => new Promise((r) => setTimeout(r, 0));
  let files: Record<string, ArrayBuffer> = {};
  let asked: string[] = [];
  beforeEach(() => {
    asked = [];
    vi.stubGlobal('fetch', async (url: string) => {
      asked.push(url);
      return new Response(files[url.replace('/data/ephemeris/', '')]);
    });
  });
  afterEach(() => { vi.unstubAllGlobals(); });

  it('stays false while the later decades download, then reads true when none of them has sunlight', async () => {
    files = { '1.bin': steady(1), '2.bin': steady(1) };
    setData({ eph: index.withChunk(0, steady(1)) });
    expect(neverLitFor(getState().live)).toBe(false);   // not all in yet
    await settle();
    expect(asked.sort()).toEqual(['/data/ephemeris/1.bin', '/data/ephemeris/2.bin']);
    expect(neverLitFor(getState().live)).toBe(true);
  });

  it('is false when the Sun comes back before the end, however far ahead', async () => {
    files = { '1.bin': steady(1), '2.bin': steady(-1) };
    setData({ eph: index.withChunk(0, steady(1)) });
    neverLitFor(getState().live);
    await settle();
    expect(neverLitFor(getState().live)).toBe(false);
  });

  it('gives no verdict within 60 days of the end of the table', async () => {
    files = { '1.bin': steady(1), '2.bin': steady(1) };
    setData({ eph: index.withChunk(0, steady(1)) });
    setLiveTime(T0 + 250 * DAY);                         // 50 days before the end
    await settle();
    neverLitFor(getState().live);
    await settle();
    expect(neverLitFor(getState().live)).toBe(false);
  });

  it('looks only from the chosen time on: sunlight earlier does not count', async () => {
    files = { '1.bin': steady(1), '2.bin': steady(1) };
    setData({ eph: index.withChunk(0, steady(-1)) });   // lit in the first 100 days only
    setLiveTime(T0 + 120 * DAY);
    await settle();                                      // the scenario's own decade first
    expect(neverLitFor(getState().live)).toBe(false);   // then this asks for the rest
    await settle();
    expect(neverLitFor(getState().live)).toBe(true);
    setLiveTime(T0 + 50 * DAY);                          // the Sun is up then
    expect(neverLitFor(getState().live)).toBe(false);
  });
});
