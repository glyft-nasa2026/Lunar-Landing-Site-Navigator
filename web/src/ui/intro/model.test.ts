import { describe, expect, it } from 'vitest';
import { loadFraction, readyToOpen, type LoadProgress } from './model';

const start: LoadProgress = { eph: 'loading', sites: 'loading', dem: 'loading', demFraction: 0 };

describe('loadFraction', () => {
  it('is empty at the start and full when the table and the site list are in', () => {
    expect(loadFraction(start)).toBe(0);
    expect(loadFraction({ ...start, eph: 'ok', sites: 'ok' })).toBeCloseTo(1, 12);
  });

  it('gives the Sun and Earth table most of the bar', () => {
    expect(loadFraction({ ...start, sites: 'ok' })).toBeCloseTo(0.2, 12);
    expect(loadFraction({ ...start, eph: 'ok' })).toBeCloseTo(0.8, 12);
  });

  it('ignores the height map', () => {
    expect(loadFraction({ ...start, demFraction: 0.9 })).toBe(0);
    expect(loadFraction({ eph: 'ok', sites: 'ok', dem: 'loading', demFraction: 0.1 })).toBeCloseTo(1, 12);
  });

  it('counts a missing file as finished, so the bar still reaches the end', () => {
    expect(loadFraction({ ...start, eph: 'missing', sites: 'ok' })).toBeCloseTo(1, 12);
  });
});

describe('readyToOpen', () => {
  it('waits for the Sun and Earth table and the site list', () => {
    expect(readyToOpen(start)).toBe(false);
    expect(readyToOpen({ ...start, eph: 'ok' })).toBe(false);
    expect(readyToOpen({ ...start, sites: 'ok' })).toBe(false);
    expect(readyToOpen({ ...start, eph: 'ok', sites: 'ok' })).toBe(true);
  });

  it('does not wait for the height map', () => {
    expect(readyToOpen({ eph: 'ok', sites: 'ok', dem: 'loading', demFraction: 0 })).toBe(true);
  });

  it('opens when a file failed, since the status line says which', () => {
    expect(readyToOpen({ ...start, eph: 'missing', sites: 'ok' })).toBe(true);
    expect(readyToOpen({ ...start, eph: 'ok', sites: 'missing' })).toBe(true);
  });
});
