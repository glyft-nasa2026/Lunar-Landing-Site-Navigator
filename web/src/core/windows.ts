// Written from the contract's Visibility block and wording table, and proven by the tests in
// windows.test.ts (T06). Names and signatures never change: state.ts and the UI modules call
// them.

import type { Ephemeris } from './ephemeris';
import { earthAltAz, sunAltAz } from './geometry';
import { skylineElev } from './horizon';
import type { Body, Flip, Sample, Site, Skyline, Summary } from './types';

/** Half the Sun's apparent width, in degrees. */
export const SUN_RADIUS = 0.267;

const MIN_MS = 60_000;
const HOUR_MS = 3_600_000;
const DAY_MS = 86_400_000;

function sampleAt(
  eph: Ephemeris, site: Site, groundM: number, skyline: Skyline, tMs: number,
): Sample {
  const sun = sunAltAz(eph, site, groundM, tMs);
  const earth = earthAltAz(eph, site, groundM, tMs);
  const sunAbove = sun.alt - skylineElev(skyline, sun.az);
  const earthAbove = earth.alt - skylineElev(skyline, earth.az);
  const sunFrac = Math.max(0, Math.min(1, (sunAbove + SUN_RADIUS) / (2 * SUN_RADIUS)));
  return { tMs, sun, earth, sunAbove, earthAbove, sunFrac, earthUp: earthAbove > 0 };
}

/**
 * One sample every stepMs from startMs up to, but not including, endMs. Each sample stands
 * for the step that follows it, so 30 days hourly is 720 samples. Times outside the table are
 * left out.
 */
export function series(
  eph: Ephemeris, site: Site, groundM: number, skyline: Skyline,
  startMs: number, endMs: number, stepMs: number,
): Sample[] {
  const out: Sample[] = [];
  if (!(stepMs > 0)) return out;
  const stop = Math.min(endMs, eph.endMs);
  // Before the table starts, skip whole steps so the samples stay on the caller's own grid.
  let t = startMs;
  if (t < eph.startMs) t += Math.ceil((eph.startMs - t) / stepMs) * stepMs;
  for (; t < stop; t += stepMs) out.push(sampleAt(eph, site, groundM, skyline, t));
  return out;
}

/**
 * The next time the body changes between up and hidden after tMs, or null if it doesn't
 * within maxDays (or before the table ends). The Sun counts as up while any of its disc
 * shows. Walks forward hourly, then halves the last interval until it is under one minute.
 */
export function nextFlip(
  eph: Ephemeris, site: Site, groundM: number, skyline: Skyline,
  tMs: number, body: Body, maxDays = 60,
): Flip {
  const up = (t: number): boolean => {
    const s = sampleAt(eph, site, groundM, skyline, t);
    return body === 'sun' ? s.sunFrac > 0 : s.earthUp;
  };
  const upNow = up(tMs);
  const stop = Math.min(tMs + maxDays * DAY_MS, eph.endMs);
  let lo = tMs;
  while (lo < stop) {
    let hi = Math.min(lo + HOUR_MS, stop);
    if (up(hi) !== upNow) {
      while (hi - lo >= MIN_MS) {
        const mid = (lo + hi) / 2;
        if (up(mid) === upNow) lo = mid; else hi = mid;
      }
      return { type: upNow ? 'set' : 'rise', tMs: hi };
    }
    lo = hi;
  }
  return null;
}

/** Percentages and longest runs over a series with an even step. Zeros for an empty series. */
export function summary(samples: Sample[]): Summary {
  const n = samples.length;
  if (n === 0) {
    return { litPct: 0, longestLit_h: 0, longestDark_h: 0, earthPct: 0, longestEarthGap_h: 0 };
  }
  const stepH = n > 1 ? (samples[1].tMs - samples[0].tMs) / HOUR_MS : 1;
  let lit = 0, earth = 0;
  let runLit = 0, runDark = 0, runGap = 0;
  let maxLit = 0, maxDark = 0, maxGap = 0;
  for (const s of samples) {
    if (s.sunFrac > 0) {
      lit++; runLit++; runDark = 0;
      if (runLit > maxLit) maxLit = runLit;
    } else {
      runDark++; runLit = 0;
      if (runDark > maxDark) maxDark = runDark;
    }
    if (s.earthUp) {
      earth++; runGap = 0;
    } else {
      runGap++;
      if (runGap > maxGap) maxGap = runGap;
    }
  }
  return {
    litPct: (100 * lit) / n,
    longestLit_h: maxLit * stepH,
    longestDark_h: maxDark * stepH,
    earthPct: (100 * earth) / n,
    longestEarthGap_h: maxGap * stepH,
  };
}

/** "3 d 4 h", or "5 h 20 min" under one day. */
function durationText(ms: number): string {
  const totalMin = Math.max(0, Math.floor(ms / MIN_MS));
  const totalH = Math.floor(totalMin / 60);
  if (totalH >= 24) return `${Math.floor(totalH / 24)} d ${totalH % 24} h`;
  return `${totalH} h ${totalMin % 60} min`;
}

/** The countdown line for a body, worded exactly as the contract's table (F4). */
export function countdownText(
  body: Body, upNow: boolean, flip: Flip, tMs: number, neverLit = false,
): string {
  if (body === 'sun') {
    if (!upNow && neverLit) return 'Permanently shadowed (2026-2035)';
    if (flip) return `${flip.type === 'set' ? 'Sunset' : 'Sunrise'} in ${durationText(flip.tMs - tMs)}`;
    return upNow ? 'No sunset in the next 60 days' : 'No sunrise in the next 60 days';
  }
  if (flip) return `${flip.type === 'set' ? 'Earthset' : 'Earthrise'} in ${durationText(flip.tMs - tMs)}`;
  return upNow ? 'Earth always visible' : 'Earth never visible';
}
