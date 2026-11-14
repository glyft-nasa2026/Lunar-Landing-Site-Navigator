import { describe, expect, it } from 'vitest';
import { amountText, compare, NUDGES, WINDOW_H, type Facts } from './model';

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
    expect(NUDGES.map((n) => n.text)).toEqual(['1 km N', '1 km W', '1 km S', '1 km E', '−1 day', '+1 day']);
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

  it('adds the terrain note when either site has no terrain', () => {
    const l = texts(facts({ terrain: false }), facts({ terrain: false }));
    expect(l[0]).toBe('No meaningful change (under 6 h)');
    expect(l[1]).toMatch(/Terrain isn't modelled north of 85° S/);
    expect(texts(facts(), facts())).toHaveLength(1);
  });
});
