import { describe, expect, it } from 'vitest';
import { allSettled, loadFraction, showHero, type LoadProgress } from './model';

const start: LoadProgress = { eph: 'loading', sites: 'loading', dem: 'loading', demFraction: 0 };

describe('loadFraction', () => {
  it('is empty at the start and full when everything has loaded', () => {
    expect(loadFraction(start)).toBe(0);
    expect(loadFraction({ eph: 'ok', sites: 'ok', dem: 'ok', demFraction: 1 })).toBeCloseTo(1, 12);
  });

  it('follows the height map download, which carries most of the bar', () => {
    const half = loadFraction({ ...start, demFraction: 0.5 });
    expect(half).toBeCloseTo(0.4, 12);
    const tables = loadFraction({ ...start, eph: 'ok', sites: 'ok' });
    expect(tables).toBeCloseTo(0.2, 12);
  });

  it('counts a missing file as finished, so the bar still reaches the end', () => {
    expect(loadFraction({ eph: 'missing', sites: 'ok', dem: 'missing', demFraction: 0.3 })).toBeCloseTo(1, 12);
  });

  it('stays between 0 and 1 for odd download fractions', () => {
    expect(loadFraction({ ...start, demFraction: 7 })).toBeCloseTo(0.8, 12);
    expect(loadFraction({ ...start, demFraction: -1 })).toBe(0);
  });
});

describe('allSettled', () => {
  it('waits for every file, loaded or failed', () => {
    expect(allSettled(start)).toBe(false);
    expect(allSettled({ ...start, eph: 'ok', sites: 'ok' })).toBe(false);
    expect(allSettled({ eph: 'ok', sites: 'missing', dem: 'ok', demFraction: 1 })).toBe(true);
  });
});

describe('showHero', () => {
  it('shows for a plain link, once per tab', () => {
    expect(showHero('', false)).toBe(true);
    expect(showHero('#', false)).toBe(true);
    expect(showHero('', true)).toBe(false);
  });

  it('never covers a shared link', () => {
    expect(showHero('#lat=-89.4&lon=136.9', false)).toBe(false);
  });
});
