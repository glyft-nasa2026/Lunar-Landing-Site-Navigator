// Tests by T06. Every table here is made up in memory with parseEphemeris, so nothing depends
// on which data file is in the repo.
import { describe, expect, it } from 'vitest';
import { parseEphemeris, type Ephemeris } from './ephemeris';
import { earthAltAz, sunAltAz } from './geometry';
import { skylineElev } from './horizon';
import { countdownText, nextFlip, series, summary, SUN_RADIUS } from './windows';
import { DEFAULT_EYE_M, MOON_RADIUS_KM } from './types';
import type { Body, Flip, Sample, Site, Skyline } from './types';

const START = Date.parse('2027-01-01T00:00:00Z');
const SEC = 1000;
const MIN = 60 * SEC;
const HOUR = 60 * MIN;
const DAY = 24 * HOUR;
const MONTH_DAYS = 29.53;     // the Sun circles once
const WOBBLE_DAYS = 27.3;     // Earth swings east and west once
const SEASON_DAYS = 346.62;   // the Sun drifts north and south once
const EARTH_KM = 384_400;
const RAD = Math.PI / 180;

// ---- made-up tables --------------------------------------------------------------------------

// The Sun circles the Moon once per 29.53 days, east to west, and is over longitude 0 at the
// start. Earth sits over the equator. Both latitudes and Earth's longitude are whatever the
// caller asks for, in degrees, as a function of days since the start.
function table(
  days: number,
  sunLat: (d: number) => number = () => 0,
  earthLon: (d: number) => number = () => 0,
): Ephemeris {
  const rows = days * 24 + 1;
  const buffer = new ArrayBuffer(rows * 24);
  const view = new DataView(buffer);
  for (let r = 0; r < rows; r++) {
    const d = r / 24;
    const sLon = ((-360 * d) / MONTH_DAYS) * RAD;
    const sLat = sunLat(d) * RAD;
    const eLon = earthLon(d) * RAD;
    [
      Math.cos(sLat) * Math.cos(sLon), Math.cos(sLat) * Math.sin(sLon), Math.sin(sLat),
      EARTH_KM * Math.cos(eLon), EARTH_KM * Math.sin(eLon), 0,
    ].forEach((v, c) => view.setFloat32((r * 6 + c) * 4, v, true));
  }
  return parseEphemeris({
    start: '2027-01-01T00:00:00Z', step_s: 3600, rows, frame: 'MOON_ME_DE421',
    columns: [], source: 'made up for a test',
  }, buffer);
}

/** Sun on the equator, Earth holding still over longitude 0. */
const eph = table(120);
/** The same Sun, with Earth swinging 7 degrees either way. */
const wobble = table(120, () => 0, (d) => 7 * Math.sin((2 * Math.PI * d) / WOBBLE_DAYS));
/** The Sun drifting 1.5 degrees north and south of the equator, as the real one does. */
const seasons = table(240, (d) => 1.5 * Math.sin((2 * Math.PI * d) / SEASON_DAYS));
/** The Sun held 1 degree south: from the south pole it circles the horizon 1 degree up. */
const lowSun = table(60, () => -1);

// ---- made-up skylines ------------------------------------------------------------------------

const level = (deg: number): Skyline => ({ elev: new Float32Array(360).fill(deg), terrain: deg !== 0 });
const flat = level(0);
/** Rolling hills, 0.5 to 3.5 degrees. */
const bumpy: Skyline = {
  elev: Float32Array.from({ length: 360 }, (_, az) => 2 + 1.5 * Math.sin(3 * az * RAD)),
  terrain: true,
};
/** Level ground with one mountain, 5 degrees tall, from azimuth 100 to 140. */
const peak: Skyline = {
  elev: Float32Array.from({ length: 360 }, (_, az) => (az >= 100 && az <= 140 ? 5 : 0)),
  terrain: true,
};

// ---- sites -----------------------------------------------------------------------------------

const equator: Site = { lat: 0, lon: 0 };
const southPole: Site = { lat: -90, lon: 0 };
const craterFloor: Site = { lat: -88, lon: 45 };
const eastLimb: Site = { lat: 0, lon: 90 };
const hillside: Site = { lat: 35, lon: -88, eye_m: 10 };

// ---- helpers ---------------------------------------------------------------------------------

/** When the Sun of `eph` has moved `deg` degrees west of the meridian of longitude 0. */
const sunAt = (deg: number): number => START + (deg / 360) * MONTH_DAYS * DAY;

const isUp = (s: Sample, body: Body): boolean => (body === 'sun' ? s.sunFrac > 0 : s.earthUp);

const one = (e: Ephemeris, site: Site, sky: Skyline, tMs: number, groundM = 0): Sample =>
  series(e, site, groundM, sky, tMs, tMs + 1, 1)[0];

/**
 * The first whole second after tMs at which the body has changed between up and hidden, found
 * the slow way: an hourly series to find the hour, then every second of that hour.
 */
function crossing(
  e: Ephemeris, site: Site, groundM: number, sky: Skyline, tMs: number, body: Body,
): number {
  const hourly = series(e, site, groundM, sky, tMs, tMs + 60 * DAY, HOUR);
  const was = isUp(hourly[0], body);
  const i = hourly.findIndex((s) => isUp(s, body) !== was);
  if (i < 0) throw new Error('no crossing in 60 days');
  const fine = series(e, site, groundM, sky, hourly[i - 1].tMs, hourly[i].tMs + SEC, SEC);
  return (fine.find((s) => isUp(s, body) !== was) as Sample).tMs;
}

// ---- series ----------------------------------------------------------------------------------

describe('series', () => {
  it('gives one sample per step, not counting the end', () => {
    const s = series(eph, equator, 0, flat, START, START + 30 * DAY, HOUR);
    expect(s).toHaveLength(720);
    expect(s[0].tMs).toBe(START);
    expect(s[719].tMs).toBe(START + 719 * HOUR);
    expect(series(eph, equator, 0, flat, START, START + DAY, 30 * MIN)).toHaveLength(48);
  });

  it('uses 0.267 degrees for the half-width of the Sun', () => {
    expect(SUN_RADIUS).toBe(0.267);
  });

  it("fills every field as the contract's Visibility block says, at every sample", () => {
    const ground = 1200;
    const samples = series(wobble, hillside, ground, bumpy, START, START + 60 * DAY, HOUR);
    expect(samples).toHaveLength(1440);
    const seen = { hidden: 0, part: 0, whole: 0, earthUp: 0, earthDown: 0 };
    for (const s of samples) {
      const sun = sunAltAz(wobble, hillside, ground, s.tMs);
      const earth = earthAltAz(wobble, hillside, ground, s.tMs);
      const sunAbove = sun.alt - skylineElev(bumpy, sun.az);
      const earthAbove = earth.alt - skylineElev(bumpy, earth.az);
      const sunFrac = Math.max(0, Math.min(1, (sunAbove + 0.267) / (2 * 0.267)));
      expect(s.sun).toEqual(sun);
      expect(s.earth).toEqual(earth);
      expect(s.sunAbove).toBeCloseTo(sunAbove, 12);
      expect(s.earthAbove).toBeCloseTo(earthAbove, 12);
      expect(s.sunFrac).toBeCloseTo(sunFrac, 12);
      expect(s.earthUp).toBe(earthAbove > 0);
      if (s.sunFrac === 0) seen.hidden++; else if (s.sunFrac === 1) seen.whole++; else seen.part++;
      if (s.earthUp) seen.earthUp++; else seen.earthDown++;
    }
    // The run must meet every case, or the loop above proves less than it seems to.
    for (const n of Object.values(seen)) expect(n).toBeGreaterThan(0);
  });

  it('has the Sun and Earth overhead at the middle of the near side', () => {
    const noon = one(eph, equator, flat, START);
    expect(noon.sun.alt).toBeCloseTo(90, 3);
    expect(noon.sunAbove).toBeCloseTo(90, 3);
    expect(noon.sunFrac).toBe(1);
    expect(noon.earth.alt).toBeCloseTo(90, 3);
    expect(noon.earthUp).toBe(true);
  });

  it('makes sunFrac the share of the disc above the skyline, by height', () => {
    // From longitude 60 on the equator the Sun stands 30 degrees up at the start.
    const at60: Site = { lat: 0, lon: 60 };
    const frac = (skylineDeg: number): number => one(eph, at60, level(skylineDeg), START).sunFrac;
    expect(one(eph, at60, flat, START).sun.alt).toBeCloseTo(30, 4);
    expect(frac(29)).toBe(1);
    expect(frac(30 - SUN_RADIUS / 2)).toBeCloseTo(0.75, 4);
    expect(frac(30)).toBeCloseTo(0.5, 4);
    expect(frac(30 + SUN_RADIUS / 2)).toBeCloseTo(0.25, 4);
    expect(frac(31)).toBe(0);
  });

  it('counts the Sun as showing until its top edge is gone, and Earth by its centre', () => {
    const at60: Site = { lat: 0, lon: 60 };
    // Sun centre 0.2 degrees below the skyline: a sliver still shows.
    const sliver = one(eph, at60, level(30.2), START);
    expect(sliver.sunAbove).toBeCloseTo(-0.2, 4);
    expect(sliver.sunFrac).toBeGreaterThan(0);
    expect(one(eph, at60, level(30.3), START).sunFrac).toBe(0);

    const earthAlt = one(eph, at60, flat, START).earth.alt;
    const justUp = one(eph, at60, level(earthAlt - 0.01), START);
    const justDown = one(eph, at60, level(earthAlt + 0.01), START);
    expect(justUp.earthAbove).toBeCloseTo(0.01, 4);
    expect(justUp.earthUp).toBe(true);
    expect(justDown.earthAbove).toBeCloseTo(-0.01, 4);
    expect(justDown.earthUp).toBe(false);
  });

  it('reads the skyline at the azimuth of the body, not somewhere else', () => {
    // From the south pole the low Sun is at azimuth 120 a third of a month before it is back
    // at azimuth 0, and the mountain stands from 100 to 140.
    const behind = one(lowSun, southPole, peak, sunAt(240));
    expect(behind.sun.az).toBeCloseTo(120, 3);
    expect(behind.sun.alt).toBeCloseTo(1, 4);
    expect(behind.sunAbove).toBeCloseTo(-4, 4);
    expect(behind.sunFrac).toBe(0);
    const clear = one(lowSun, southPole, peak, sunAt(120));
    expect(clear.sun.az).toBeCloseTo(240, 3);
    expect(clear.sunAbove).toBeCloseTo(1, 4);
    expect(clear.sunFrac).toBe(1);
  });

  it('leaves out times outside the table, and stays on the grid of the caller', () => {
    const tail = series(eph, equator, 0, flat, eph.endMs - 5 * HOUR, eph.endMs + 30 * DAY, HOUR);
    expect(tail).toHaveLength(5);
    const head = series(eph, equator, 0, flat, START - 2.5 * HOUR, START + 2 * HOUR, HOUR);
    expect(head.map((s) => s.tMs)).toEqual([START + 0.5 * HOUR, START + 1.5 * HOUR]);
    expect(series(eph, equator, 0, flat, START - 30 * DAY, START, HOUR)).toEqual([]);
    expect(series(eph, equator, 0, flat, eph.endMs, eph.endMs + DAY, HOUR)).toEqual([]);
  });

  it('gives nothing for a step that is not above zero, or an end before the start', () => {
    expect(series(eph, equator, 0, flat, START, START + DAY, 0)).toEqual([]);
    expect(series(eph, equator, 0, flat, START, START + DAY, -HOUR)).toEqual([]);
    expect(series(eph, equator, 0, flat, START, START + DAY, Number.NaN)).toEqual([]);
    expect(series(eph, equator, 0, flat, START + DAY, START, HOUR)).toEqual([]);
  });
});

// ---- summary ---------------------------------------------------------------------------------

describe('summary', () => {
  // Done when: a skyline of 0 everywhere at the equator, lit 50 % within 2 % over 60 days.
  const lons = [0, 37, 90, -120, 180];
  const startDays = [0, 5.3, 11, 22.4];
  it.each(lons.flatMap((lon) => startDays.map((d) => [lon, d])))(
    'is lit half the time at the equator under a level skyline (longitude %d, from day %d)',
    (lon, d) => {
      const from = START + d * DAY;
      const s = summary(series(eph, { lat: 0, lon }, 0, flat, from, from + 60 * DAY, HOUR));
      expect(s.litPct).toBeGreaterThan(48);
      expect(s.litPct).toBeLessThan(52);
    },
  );

  it('measures a day and a night of half a month each at the equator', () => {
    const s = summary(series(eph, equator, 0, flat, START, START + 60 * DAY, HOUR));
    // The disc adds its own width to the day and takes it from the night.
    const dayH = ((180 + 2 * SUN_RADIUS) / 360) * MONTH_DAYS * 24;
    const nightH = ((180 - 2 * SUN_RADIUS) / 360) * MONTH_DAYS * 24;
    expect(Math.abs(s.longestLit_h - dayH)).toBeLessThanOrEqual(1);
    expect(Math.abs(s.longestDark_h - nightH)).toBeLessThanOrEqual(1);
    expect(s.earthPct).toBe(100);
    expect(s.longestEarthGap_h).toBe(0);
  });

  // Done when: a skyline of 30 degrees everywhere gives lit 0 %. That needs a place where the
  // Sun stays low, so this is the crater floor near the pole, where it never tops 3.5 degrees.
  it('is never lit behind a 30 degree skyline near the pole', () => {
    const samples = series(seasons, craterFloor, -3000, level(30), START, START + 60 * DAY, HOUR);
    expect(Math.max(...samples.map((x) => x.sun.alt))).toBeLessThan(3.5);
    const s = summary(samples);
    expect(s.litPct).toBe(0);
    expect(s.longestLit_h).toBe(0);
    expect(s.longestDark_h).toBe(60 * 24);
  });

  it('gets a shorter day, not none, behind a 30 degree skyline at the equator', () => {
    // There the Sun climbs overhead, so it clears the wall for the middle of the day.
    const hours = Math.floor(2 * MONTH_DAYS * 24);
    const s = summary(series(eph, equator, 0, level(30), START, START + hours * HOUR, HOUR));
    expect(s.litPct).toBeCloseTo((100 * (180 - 2 * (30 - SUN_RADIUS))) / 360, 0);
  });

  it('loses the hours the Sun spends behind a mountain', () => {
    // The ramps up to the mountain are one degree wide, so the 1 degree Sun is fully hidden
    // from azimuth 99.2534 to 140.7466.
    const hiddenDeg = 41 + 1 - 2 * ((1 + SUN_RADIUS) / 5);
    const hours = Math.round(MONTH_DAYS * 24);
    const s = summary(series(lowSun, southPole, 0, peak, START, START + hours * HOUR, HOUR));
    expect(Math.abs(s.litPct - 100 * (1 - hiddenDeg / 360))).toBeLessThan(0.3);
    expect(Math.abs(s.longestDark_h - (hiddenDeg / 360) * MONTH_DAYS * 24)).toBeLessThanOrEqual(1);
  });

  it('counts the hours without Earth at the east limb', () => {
    // Earth is up while it is more than 0.259 degrees east of the mean, see nextFlip below.
    const phase = Math.asin(Math.asin((MOON_RADIUS_KM + DEFAULT_EYE_M / 1000) / EARTH_KM) / RAD / 7);
    const hours = Math.round(2 * WOBBLE_DAYS * 24);
    const s = summary(series(wobble, eastLimb, 0, flat, START, START + hours * HOUR, HOUR));
    expect(Math.abs(s.earthPct - (100 * (Math.PI - 2 * phase)) / (2 * Math.PI))).toBeLessThan(0.3);
    const gapH = ((Math.PI + 2 * phase) / (2 * Math.PI)) * WOBBLE_DAYS * 24;
    expect(Math.abs(s.longestEarthGap_h - gapH)).toBeLessThanOrEqual(1);
  });

  const mk = (tMs: number, lit: boolean, earthUp: boolean): Sample => ({
    tMs, sun: { alt: 0, az: 0 }, earth: { alt: 0, az: 0 },
    sunAbove: 0, earthAbove: 0, sunFrac: lit ? 1 : 0, earthUp,
  });
  const lit = [1, 1, 0, 1, 1, 1, 0, 0, 0, 0];
  const up = [0, 0, 1, 1, 0, 0, 0, 1, 1, 1];

  it('finds the longest runs', () => {
    const s = summary(lit.map((l, i) => mk(i * HOUR, l === 1, up[i] === 1)));
    expect(s).toEqual({ litPct: 50, longestLit_h: 3, longestDark_h: 4, earthPct: 50, longestEarthGap_h: 3 });
  });

  it('gives the runs in hours whatever the step', () => {
    const s = summary(lit.map((l, i) => mk(i * 30 * MIN, l === 1, up[i] === 1)));
    expect(s).toEqual({ litPct: 50, longestLit_h: 1.5, longestDark_h: 2, earthPct: 50, longestEarthGap_h: 1.5 });
  });

  it('counts a sliver of Sun as lit', () => {
    const sliver = { ...mk(0, false, true), sunFrac: 0.01 };
    expect(summary([sliver, { ...sliver, tMs: HOUR }]).litPct).toBe(100);
  });

  it('is all zeros for no samples, and takes a lone sample as one hour', () => {
    expect(summary([])).toEqual({ litPct: 0, longestLit_h: 0, longestDark_h: 0, earthPct: 0, longestEarthGap_h: 0 });
    expect(summary([mk(0, true, false)])).toEqual({ litPct: 100, longestLit_h: 1, longestDark_h: 0, earthPct: 0, longestEarthGap_h: 1 });
  });
});

// ---- nextFlip --------------------------------------------------------------------------------

describe('nextFlip', () => {
  // Done when: nextFlip lands within 1 minute of the moment sunFrac crosses zero in a finely
  // sampled series. The same check runs for Earth.
  const cases: [string, Ephemeris, Site, number, Skyline, number, Body, 'rise' | 'set'][] = [
    ['sunset at the equator', eph, equator, 0, flat, START, 'sun', 'set'],
    ['sunrise at the equator', eph, equator, 0, flat, START + 14 * DAY, 'sun', 'rise'],
    ['sunset over hills, from a time off the hour', wobble, hillside, 1200, bumpy, START + 17 * MIN + 23 * SEC, 'sun', 'set'],
    ['sunrise over hills', wobble, hillside, 1200, bumpy, START + 16 * DAY, 'sun', 'rise'],
    ['the Sun going behind a mountain at the pole', lowSun, southPole, 0, peak, START, 'sun', 'set'],
    ['the Sun coming out from behind it', lowSun, southPole, 0, peak, START + 19 * DAY, 'sun', 'rise'],
    ['polar sunset as the Sun drifts north', seasons, southPole, 0, flat, START, 'sun', 'set'],
    ['earthrise at the east limb', wobble, eastLimb, 0, flat, START, 'earth', 'rise'],
    ['earthset at the east limb', wobble, eastLimb, 0, flat, START + 2 * DAY, 'earth', 'set'],
    ['earthset over hills', wobble, hillside, 1200, bumpy, START + 30 * MIN, 'earth', 'set'],
    ['earthrise over hills', wobble, hillside, 1200, bumpy, START + 3 * DAY, 'earth', 'rise'],
  ];
  it.each(cases)('lands within a minute of the crossing in a one-second series: %s',
    (_name, e, site, ground, sky, tMs, body, type) => {
      const flip = nextFlip(e, site, ground, sky, tMs, body);
      const truth = crossing(e, site, ground, sky, tMs, body);
      expect(flip?.type).toBe(type);
      expect(Math.abs((flip as { tMs: number }).tMs - truth)).toBeLessThan(MIN);
    });

  it('finds sunset a quarter of a month after noon', () => {
    const flip = nextFlip(eph, equator, 0, flat, START, 'sun');
    // The last sliver goes when the centre is SUN_RADIUS below the skyline.
    expect(flip?.type).toBe('set');
    expect(Math.abs((flip?.tMs ?? 0) - sunAt(90 + SUN_RADIUS))).toBeLessThan(MIN);
  });

  it('finds sunrise when it starts in the dark', () => {
    const flip = nextFlip(eph, equator, 0, flat, sunAt(180), 'sun');
    expect(flip?.type).toBe('rise');
    expect(Math.abs((flip?.tMs ?? 0) - sunAt(270 - SUN_RADIUS))).toBeLessThan(MIN);
  });

  it('finds a late sunrise over a wall to the east', () => {
    const wall: Skyline = {
      elev: Float32Array.from({ length: 360 }, (_, az) => (az >= 45 && az <= 135 ? 10 : 0)),
      terrain: true,
    };
    const flip = nextFlip(eph, equator, 0, wall, sunAt(180), 'sun');
    expect(flip?.type).toBe('rise');
    expect(Math.abs((flip?.tMs ?? 0) - sunAt(270 + 10 - SUN_RADIUS))).toBeLessThan(MIN);
  });

  it('times the Sun going behind a mountain and coming out again', () => {
    // From the south pole the low Sun's azimuth falls from 360, so it meets the mountain's far
    // side first. It is fully hidden between azimuth 140.7466 and 99.2534.
    const edge = (1 + SUN_RADIUS) / 5;
    const set = nextFlip(lowSun, southPole, 0, peak, START, 'sun');
    expect(set?.type).toBe('set');
    expect(Math.abs((set?.tMs ?? 0) - sunAt(360 - (141 - edge)))).toBeLessThan(MIN);
    const rise = nextFlip(lowSun, southPole, 0, peak, set?.tMs ?? 0, 'sun');
    expect(rise?.type).toBe('rise');
    expect(Math.abs((rise?.tMs ?? 0) - sunAt(360 - (99 + edge)))).toBeLessThan(MIN);
  });

  it('finds earthrise at the east limb, allowing for where the site stands', () => {
    // Seen from the limb, Earth's centre clears a level skyline once Earth is far enough east
    // to be above the plane through the site: 384400 km * sin(lon) = R + eye.
    const lonDeg = Math.asin((MOON_RADIUS_KM + DEFAULT_EYE_M / 1000) / EARTH_KM) / RAD;
    expect(lonDeg).toBeCloseTo(0.259, 3);
    const expected = START + ((WOBBLE_DAYS * Math.asin(lonDeg / 7)) / (2 * Math.PI)) * DAY;
    const flip = nextFlip(wobble, eastLimb, 0, flat, START, 'earth');
    expect(flip?.type).toBe('rise');
    expect(Math.abs((flip?.tMs ?? 0) - expected)).toBeLessThan(MIN);
  });

  it('returns a time at which the body has already changed, and had not a minute before', () => {
    const set = nextFlip(eph, equator, 0, flat, START, 'sun') as { tMs: number };
    expect(one(eph, equator, flat, set.tMs).sunFrac).toBe(0);
    expect(one(eph, equator, flat, set.tMs - MIN).sunFrac).toBeGreaterThan(0);
    const rise = nextFlip(wobble, eastLimb, 0, flat, START, 'earth') as { tMs: number };
    expect(one(wobble, eastLimb, flat, rise.tMs).earthUp).toBe(true);
    expect(one(wobble, eastLimb, flat, rise.tMs - MIN).earthUp).toBe(false);
    expect(Number.isInteger(set.tMs)).toBe(true);
  });

  it('alternates set and rise when followed from flip to flip, one month per pair', () => {
    const flips: { type: 'rise' | 'set'; tMs: number }[] = [];
    let t = START;
    for (let i = 0; i < 5; i++) {
      const f = nextFlip(eph, equator, 0, flat, t, 'sun');
      if (!f) throw new Error(`no flip after ${new Date(t).toISOString()}`);
      flips.push(f);
      t = f.tMs;
    }
    expect(flips.map((f) => f.type)).toEqual(['set', 'rise', 'set', 'rise', 'set']);
    const nightMs = ((180 - 2 * SUN_RADIUS) / 360) * MONTH_DAYS * DAY;
    expect(Math.abs(flips[1].tMs - flips[0].tMs - nightMs)).toBeLessThan(MIN);
    expect(Math.abs(flips[2].tMs - flips[0].tMs - MONTH_DAYS * DAY)).toBeLessThan(MIN);
    expect(Math.abs(flips[4].tMs - flips[2].tMs - MONTH_DAYS * DAY)).toBeLessThan(MIN);
  });

  it('looks 60 days ahead unless told otherwise', () => {
    // At the south pole the drifting Sun sets about day 10 and is back about day 163.
    const drift = (Math.asin(SUN_RADIUS / 1.5) / (2 * Math.PI)) * SEASON_DAYS;
    const riseMs = START + (SEASON_DAYS / 2 - drift) * DAY;
    const found = nextFlip(seasons, southPole, 0, flat, riseMs - 59.5 * DAY, 'sun');
    expect(found?.type).toBe('rise');
    expect(Math.abs((found?.tMs ?? 0) - riseMs)).toBeLessThan(MIN);
    expect(nextFlip(seasons, southPole, 0, flat, riseMs - 60.5 * DAY, 'sun')).toBeNull();
    expect(nextFlip(seasons, southPole, 0, flat, riseMs - 60.5 * DAY, 'sun', 61)?.type).toBe('rise');
  });

  it('returns null when nothing changes within maxDays', () => {
    // Sunset is 7.4 days after noon.
    expect(nextFlip(eph, equator, 0, flat, START, 'sun', 7)).toBeNull();
    expect(nextFlip(eph, equator, 0, flat, START, 'sun', 8)?.type).toBe('set');
    expect(nextFlip(eph, equator, 0, flat, START, 'sun', 0)).toBeNull();
    // Sunset comes 177.7 hours after noon; a search that ends at 177.5 must not reach past it.
    expect(nextFlip(eph, equator, 0, flat, START, 'sun', 177.5 / 24)).toBeNull();
    expect(nextFlip(eph, equator, 0, flat, START, 'sun', 177.9 / 24)?.type).toBe('set');
    expect(nextFlip(eph, equator, 0, flat, START, 'earth')).toBeNull();      // Earth holds still
  });

  it('stops at the end of the table, and does not crash outside it', () => {
    expect(nextFlip(eph, equator, 0, flat, eph.endMs - HOUR, 'sun')).toBeNull();
    expect(nextFlip(eph, equator, 0, flat, eph.endMs, 'sun')).toBeNull();
    expect(nextFlip(eph, equator, 0, flat, eph.endMs + 400 * DAY, 'sun')).toBeNull();
    // A flip in the last, shortened step before the end is still found.
    const short = table(8);
    const lastSet = nextFlip(short, equator, 0, flat, short.endMs - 15 * HOUR - 20 * MIN, 'sun');
    expect(lastSet?.type).toBe('set');
    expect(Math.abs((lastSet?.tMs ?? 0) - sunAt(90 + SUN_RADIUS))).toBeLessThan(MIN);
    // From before the table it still finds the first flip inside it.
    const early = nextFlip(eph, equator, 0, flat, START - 3 * DAY, 'sun');
    expect(early?.type).toBe('set');
    expect(Math.abs((early?.tMs ?? 0) - sunAt(90 + SUN_RADIUS))).toBeLessThan(MIN);
  });
});

// ---- countdownText ---------------------------------------------------------------------------

describe('countdownText', () => {
  const t = START;
  const after = (d: number, h: number, min = 0, s = 0): number => t + d * DAY + h * HOUR + min * MIN + s * SEC;
  const set: Flip = { type: 'set', tMs: after(3, 4) };
  const rise: Flip = { type: 'rise', tMs: after(3, 4) };

  // One test per row of the contract's wording table. The Earth row with a flip holds two texts.
  const rows: [string, Body, boolean, Flip, boolean, string][] = [
    ['Sun up, a set found', 'sun', true, set, false, 'Sunset in 3 d 4 h'],
    ['Sun down, a rise found', 'sun', false, rise, false, 'Sunrise in 3 d 4 h'],
    ['Sun up, no set found', 'sun', true, null, false, 'No sunset in the next 60 days'],
    ['Sun down, no rise found', 'sun', false, null, false, 'No sunrise in the next 60 days'],
    ['Sun down, neverLit true', 'sun', false, null, true, 'Permanently shadowed (2020-2029)'],
    ['Earth up, a flip found', 'earth', true, set, false, 'Earthset in 3 d 4 h'],
    ['Earth down, a flip found', 'earth', false, rise, false, 'Earthrise in 3 d 4 h'],
    ['Earth up, no flip found', 'earth', true, null, false, 'Earth always visible'],
    ['Earth down, no flip found', 'earth', false, null, false, 'Earth never visible'],
  ];
  it.each(rows)('%s', (_row, body, upNow, flip, neverLit, text) => {
    expect(countdownText(body, upNow, flip, t, neverLit)).toBe(text);
    // neverLit is false unless given.
    if (!neverLit) expect(countdownText(body, upNow, flip, t)).toBe(text);
  });

  it('reads days and hours from one day up, hours and minutes under it', () => {
    const sunset = (tMs: number): string => countdownText('sun', true, { type: 'set', tMs }, t);
    expect(sunset(after(0, 5, 20))).toBe('Sunset in 5 h 20 min');
    expect(sunset(after(0, 23, 59, 59))).toBe('Sunset in 23 h 59 min');
    expect(sunset(after(1, 0))).toBe('Sunset in 1 d 0 h');
    expect(sunset(after(3, 4, 59, 59))).toBe('Sunset in 3 d 4 h');
    expect(sunset(after(59, 23, 30))).toBe('Sunset in 59 d 23 h');
    expect(sunset(after(0, 5, 20, 59))).toBe('Sunset in 5 h 20 min');
    expect(sunset(after(0, 0, 20))).toBe('Sunset in 0 h 20 min');
    expect(sunset(after(0, 0, 0, 30))).toBe('Sunset in 0 h 0 min');
  });

  it('says permanently shadowed only while the Sun is down, and never for Earth', () => {
    expect(countdownText('sun', true, set, t, true)).toBe('Sunset in 3 d 4 h');
    expect(countdownText('sun', false, rise, t, true)).toBe('Permanently shadowed (2020-2029)');
    expect(countdownText('earth', false, null, t, true)).toBe('Earth never visible');
  });

  // The same wording, reached from a table through series and nextFlip as the readout does.
  const line = (e: Ephemeris, site: Site, ground: number, sky: Skyline, tMs: number, body: Body, neverLit = false): string =>
    countdownText(body, isUp(one(e, site, sky, tMs, ground), body), nextFlip(e, site, ground, sky, tMs, body), tMs, neverLit);

  // Done when: a skyline of 30 degrees everywhere, and countdownText with neverLit true.
  it('reads "Permanently shadowed (2020-2029)" on a floor that no sunlight reaches', () => {
    const wall = level(30);
    const whole = series(seasons, craterFloor, -3000, wall, seasons.startMs, seasons.endMs, HOUR);
    const neverLit = whole.every((s) => s.sunFrac === 0);
    expect(whole).toHaveLength(240 * 24);
    expect(neverLit).toBe(true);
    expect(summary(whole).litPct).toBe(0);
    expect(nextFlip(seasons, craterFloor, -3000, wall, START, 'sun')).toBeNull();
    expect(line(seasons, craterFloor, -3000, wall, START, 'sun', neverLit)).toBe('Permanently shadowed (2020-2029)');
  });

  it('counts down to a sunset found by nextFlip', () => {
    // From noon the Sun has 90.267 degrees to go: 7.40 days. From midnight to the first
    // sliver it has 89.733: 7.36 days.
    expect(line(eph, equator, 0, flat, START, 'sun')).toBe('Sunset in 7 d 9 h');
    expect(line(eph, equator, 0, flat, sunAt(180), 'sun')).toBe('Sunrise in 7 d 8 h');
    expect(line(eph, equator, 0, flat, sunAt(90), 'sun')).toBe('Sunset in 0 h 31 min');
  });

  it('reads the polar night and the polar day off the drifting Sun', () => {
    expect(line(seasons, southPole, 0, flat, START + 20 * DAY, 'sun')).toBe('No sunrise in the next 60 days');
    expect(line(seasons, southPole, 0, flat, START + 170 * DAY, 'sun')).toBe('No sunset in the next 60 days');
  });

  it('reads Earth by where the site is', () => {
    expect(line(wobble, equator, 0, flat, START, 'earth')).toBe('Earth always visible');
    expect(line(wobble, { lat: 0, lon: 180 }, 0, flat, START, 'earth')).toBe('Earth never visible');
    expect(line(wobble, eastLimb, 0, flat, START, 'earth')).toBe('Earthrise in 3 h 51 min');
    expect(line(wobble, eastLimb, 0, flat, START + 2 * DAY, 'earth')).toMatch(/^Earthset in 11 d \d+ h$/);
  });
});
