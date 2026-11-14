import { describe, expect, it } from 'vitest';
import type { Sample } from '../../core/types';
import { best, countdownScore, daysCovered, discPctText, hoursText, pctText, runs } from './model';

const H = 3_600_000;
const D = 86_400_000;
const T0 = Date.parse('2027-01-01T00:00:00Z');

/** Hourly samples from T0; lit[i] says whether hour i is lit. */
function samples(lit: boolean[]): Sample[] {
  return lit.map((on, i) => ({
    tMs: T0 + i * H,
    sun: { alt: 0, az: 0 }, earth: { alt: 0, az: 0 },
    sunAbove: on ? 1 : -1, earthAbove: 0, sunFrac: on ? 1 : 0, earthUp: on,
  }));
}
const sunUp = (s: Sample): boolean => s.sunFrac > 0;

describe('runs', () => {
  it('merges neighbouring hours into one run, in days', () => {
    const r = runs(samples([true, true, false, false, true]), sunUp, T0, null);
    expect(r).toEqual([{ from: 0, to: 2 / 24 }, { from: 4 / 24, to: 5 / 24 }]);
  });

  it('is empty when never up, or with no samples', () => {
    expect(runs(samples([false, false]), sunUp, T0, null)).toEqual([]);
    expect(runs([], sunUp, T0, null)).toEqual([]);
  });

  it('ends the first run exactly at the sunset time', () => {
    // Up for hours 0-2, sets 2 h 20 min in: the run ends at the flip, not at 3 h.
    const flip = { type: 'set' as const, tMs: T0 + 2 * H + 20 * 60_000 };
    const r = runs(samples([true, true, true, false]), sunUp, T0, flip);
    expect(r[0].from).toBe(0);
    expect(r[0].to * D).toBeCloseTo(flip.tMs - T0, 3);
  });

  it('starts the first run exactly at the sunrise time', () => {
    const flip = { type: 'rise' as const, tMs: T0 + 1 * H + 40 * 60_000 };
    const r = runs(samples([false, true, true]), sunUp, T0, flip);
    expect(r[0].from * D).toBeCloseTo(flip.tMs - T0, 3);
    expect(r[0].to).toBeCloseTo(3 / 24, 9);
  });

  it('ignores a flip that is beyond the strip', () => {
    const flip = { type: 'set' as const, tMs: T0 + 40 * D };
    expect(runs(samples([true, true]), sunUp, T0, flip)).toEqual([{ from: 0, to: 2 / 24 }]);
  });

  it('keeps every run inside 0 to 30 days', () => {
    // The sample's hour starts half an hour before day 30 and would end half an hour after it.
    // (Starting a whole hour before, it ended exactly on day 30 and never met the limit.)
    const start = T0 + 30 * D - H / 2;
    const s = samples([true]).map((x) => ({ ...x, tMs: start }));
    expect(runs(s, sunUp, T0, null)).toEqual([{ from: 30 - 0.5 / 24, to: 30 }]);
    // And at the other end: an hour that began before the strip starts.
    const early = samples([true]).map((x) => ({ ...x, tMs: T0 - H / 2 }));
    expect(runs(early, sunUp, T0, null)).toEqual([{ from: 0, to: 0.5 / 24 }]);
  });
});

describe('best', () => {
  it('marks the highest or lowest value', () => {
    expect([...best([10, 30, 20], true)]).toEqual([1]);
    expect([...best([10, 30, 20], false)]).toEqual([0]);
  });
  it('marks every tie', () => {
    expect([...best([30, 10, 30], true)]).toEqual([0, 2]);
  });
  it('marks nothing with one column, or when all are equal', () => {
    expect(best([5], true).size).toBe(0);
    expect(best([5, 5, 5], true).size).toBe(0);
  });
  it('skips columns with no value', () => {
    expect([...best([null, 4, 2], true)]).toEqual([1]);
    expect(best([null, null], true).size).toBe(0);
    // One value beside a dash is not "best": there is nothing to compare it with.
    expect(best([null, 5], true).size).toBe(0);
  });
  it('handles never-sets and never-rises', () => {
    expect([...best([Infinity, 5, -Infinity], true)]).toEqual([0]);
  });
});

describe('countdownScore', () => {
  it('prefers long light, then a quick sunrise, then never rising', () => {
    const set10 = countdownScore(true, { type: 'set', tMs: T0 + 10 * H }, T0);
    const set2 = countdownScore(true, { type: 'set', tMs: T0 + 2 * H }, T0);
    const rise3 = countdownScore(false, { type: 'rise', tMs: T0 + 3 * H }, T0);
    const rise9 = countdownScore(false, { type: 'rise', tMs: T0 + 9 * H }, T0);
    const never = countdownScore(false, null, T0);
    const always = countdownScore(true, null, T0);
    expect([always, set10, set2, rise3, rise9, never]).toEqual(
      [always, set10, set2, rise3, rise9, never].slice().sort((a, b) => b - a));
  });
});

describe('text', () => {
  it('writes hours and percentages', () => {
    expect(hoursText(0)).toBe('0 h');
    expect(hoursText(5.4)).toBe('5 h');
    expect(hoursText(76)).toBe('3 d 4 h');
    expect(pctText(73.44)).toBe('73.4 %');
  });

  it('the Sun\'s disc: a sliver is never 0 % and a nicked disc never 100 %, as in the readout', () => {
    expect(discPctText(0)).toBe('0 %');
    expect(discPctText(0.002)).toBe('1 %');
    expect(discPctText(0.734)).toBe('73 %');
    expect(discPctText(0.998)).toBe('99 %');
    expect(discPctText(1)).toBe('100 %');
  });

  it('days covered: 720 hourly samples are 30 days, 168 are 7', () => {
    expect(daysCovered([])).toBe(0);
    expect(daysCovered(samples(new Array<boolean>(720).fill(true)))).toBe(30);
    expect(daysCovered(samples(new Array<boolean>(168).fill(false)))).toBe(7);
    expect(daysCovered(samples([true]))).toBeCloseTo(1 / 24, 12);
  });
});
