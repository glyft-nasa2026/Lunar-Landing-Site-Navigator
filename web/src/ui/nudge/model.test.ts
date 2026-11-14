import { describe, expect, it } from 'vitest';
import {
  ACROSS_EDGE, amountText, asCorner, clampKm, compare, freeCorner, kmText, NUDGE_KM, NUDGES, stepLabel, stepText,
  WINDOW_H, type Corner, type Facts,
} from './model';

const H = 3_600_000;
const T = Date.UTC(2027, 2, 1);

function facts(p: Partial<Facts> = {}): Facts {
  return {
    tMs: T, litPct: 50, earthPct: 50, sunUp: true, earthUp: true,
    sunFlip: { type: 'set', tMs: T + 50 * H }, earthFlip: { type: 'set', tMs: T + 100 * H },
    terrain: true, ...p,
  };
}
const pct = (hours: number): number => (100 * hours) / WINDOW_H;
const texts = (live: Facts, ghost: Facts): string[] => compare(live, ghost).map((l) => l.text);

describe('NUDGES', () => {
  it('has the six steps of F11', () => {
    expect(NUDGES.map((n) => stepText(n, 1))).toEqual(['1.0 km N', '1.0 km W', '1.0 km S', '1.0 km E', '−1 day', '+1 day']);
  });

  it('uses the chosen distance for the four directions only', () => {
    expect(NUDGES.map((n) => stepText(n, 2.5))).toEqual(['2.5 km N', '2.5 km W', '2.5 km S', '2.5 km E', '−1 day', '+1 day']);
  });

  it('spells every step out for a screen reader', () => {
    expect(NUDGES.map((n) => stepLabel(n, 2.5))).toEqual([
      'Move the live site 2.5 km north', 'Move the live site 2.5 km west',
      'Move the live site 2.5 km south', 'Move the live site 2.5 km east',
      'Move the live time back 1 day', 'Move the live time forward 1 day',
    ]);
  });
});

describe('distance', () => {
  it('runs from 0.1 km to 10 km in 0.1 km steps and starts at 1 km', () => {
    expect(NUDGE_KM).toEqual({ min: 0.1, max: 10, step: 0.1, start: 1 });
  });

  it('keeps a value inside the range and on a step', () => {
    expect(clampKm(2.5)).toBe(2.5);
    expect(clampKm(2.54)).toBe(2.5);
    expect(clampKm(0.3)).toBe(0.3); // 0.1 * 3 in floating point is 0.30000000000000004
    expect(clampKm(0)).toBe(0.1);
    expect(clampKm(-4)).toBe(0.1);
    expect(clampKm(25)).toBe(10);
    expect(clampKm(Number.NaN)).toBe(1);
  });

  it('always shows one decimal, so the width stays the same', () => {
    expect(kmText(1)).toBe('1.0 km');
    expect(kmText(0.1)).toBe('0.1 km');
    expect(kmText(10)).toBe('10.0 km');
  });
});

describe('freeCorner', () => {
  const none = new Set<Corner>();
  it('gives the wanted corner when it is free', () => {
    expect(freeCorner('bl', none)).toBe('bl');
    expect(freeCorner('tr', none)).toBe('tr');
  });

  it('goes clockwise to the next free corner when the wanted one is taken', () => {
    expect(freeCorner('bl', new Set<Corner>(['bl']))).toBe('tl');
    expect(freeCorner('tl', new Set<Corner>(['tl', 'tr']))).toBe('br');
    expect(freeCorner('br', new Set<Corner>(['br', 'bl', 'tl']))).toBe('tr');
  });

  it('gives null when every corner is taken', () => {
    expect(freeCorner('bl', new Set<Corner>(['tl', 'tr', 'bl', 'br']))).toBeNull();
  });
});

describe('asCorner', () => {
  it('reads the four corner names and nothing else', () => {
    expect(asCorner('tr')).toBe('tr');
    expect(asCorner('top')).toBeNull();
    expect(asCorner(null)).toBeNull();
    expect(asCorner(undefined)).toBeNull();
  });
});

describe('amountText', () => {
  it('uses hours under two days and half days above', () => {
    expect(amountText(31.4)).toBe('31 h');
    expect(amountText(-31.6)).toBe('32 h');
    expect(amountText(50)).toBe('2 days');
    expect(amountText(61)).toBe('2.5 days');
  });
});

describe('compare', () => {
  it('says "no meaningful change" when everything is within 6 h', () => {
    const l = compare(facts(), facts({
      litPct: 50 + pct(5), earthPct: 50 - pct(3), sunFlip: { type: 'set', tMs: T + 55 * H },
    }));
    expect(l).toEqual([{ text: 'No meaningful change (under 6 h)', tone: 'muted' }]);
  });

  it('reports lost sunlight in hours over 30 days, in the bad colour', () => {
    const l = compare(facts(), facts({ litPct: 50 - pct(31) }));
    expect(l[0]).toEqual({ text: '−31 h of sunlight in 30 days', tone: 'bad' });
  });

  it('reports gained sunlight and Earth contact as good', () => {
    expect(texts(facts(), facts({ litPct: 50 + pct(10), earthPct: 50 + pct(72) })))
      .toEqual(['+10 h of sunlight in 30 days', '+3 days of Earth contact in 30 days']);
  });

  it('words an earlier or later sunset and Earthset', () => {
    expect(compare(facts(), facts({ sunFlip: { type: 'set', tMs: T + 42 * H } }))[0])
      .toEqual({ text: 'sunset 8 h earlier', tone: 'bad' });
    expect(compare(facts(), facts({ earthFlip: { type: 'set', tMs: T + 148 * H } }))[0])
      .toEqual({ text: 'keeps Earth 2 days longer', tone: 'ok' });
    expect(compare(facts(), facts({ earthFlip: { type: 'set', tMs: T + 52 * H } }))[0])
      .toEqual({ text: 'loses Earth 2 days earlier', tone: 'bad' });
  });

  it('words a sooner or later sunrise while the Sun is down', () => {
    const down = { sunUp: false, sunFlip: { type: 'rise' as const, tMs: T + 20 * H } };
    expect(compare(facts(down), facts({ ...down, sunFlip: { type: 'rise', tMs: T + 10 * H } }))[0])
      .toEqual({ text: 'sunrise 10 h sooner', tone: 'ok' });
    expect(compare(facts(down), facts({ ...down, sunFlip: null }))[0])
      .toEqual({ text: 'no sunrise there in the next 60 days', tone: 'bad' });
  });

  it('says when the Sun is up at one and not the other now', () => {
    expect(compare(facts(), facts({ sunUp: false, sunFlip: { type: 'rise', tMs: T + H } }))[0])
      .toEqual({ text: 'Sun hidden there now (up here)', tone: 'bad' });
  });

  it('handles no sunset at one of the two', () => {
    expect(compare(facts(), facts({ sunFlip: null }))[0]).toEqual({ text: 'no sunset there in the next 60 days', tone: 'ok' });
    expect(compare(facts({ sunFlip: null }), facts())[0]).toEqual({ text: 'sunset there within 60 days (none here)', tone: 'bad' });
  });

  it('compares events as moments, so the same sunset seen a day later is no change', () => {
    // +1 day: the same flips, a different start, nearly the same 30-day share.
    expect(texts(facts(), facts({ tMs: T + 24 * H, litPct: 50 + pct(0.5) })))
      .toEqual(['No meaningful change (under 6 h)']);
  });

  it('adds the terrain note when neither site has terrain', () => {
    const l = texts(facts({ terrain: false }), facts({ terrain: false }));
    expect(l[0]).toBe('No meaningful change (under 6 h)');
    expect(l[1]).toMatch(/Terrain isn't modelled north of 85° S/);
    expect(texts(facts(), facts())).toHaveLength(1);
  });

  it('says the height map is missing, not that the site is north of 85 S, while it isn\'t loaded', () => {
    const smooth = facts({ terrain: false });
    const l = compare(smooth, facts({ terrain: false, litPct: 50 - pct(7) }), false).map((x) => x.text);
    expect(l).toEqual(['−7 h of sunlight in 30 days', 'The height map isn\'t loaded, so the ground here is a smooth Moon.']);
  });

  it('claims no gain or loss across the edge of the terrain model', () => {
    // 1 km north from 85.01 S: real terrain here, a smooth Moon there. The engine's two answers
    // differ by days, and none of it is the ground.
    const here = facts({ terrain: true, litPct: 40 });
    const there = facts({ terrain: false, litPct: 40 + pct(276), sunFlip: null });
    for (const l of [compare(here, there), compare(there, here)]) {
      expect(l).toEqual([{ text: ACROSS_EDGE, tone: 'muted' }]);
    }
  });
});
