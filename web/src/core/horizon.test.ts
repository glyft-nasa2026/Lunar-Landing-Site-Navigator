// Sanity tests by T00 for the flat skyline. T05 owns this file next.
import { describe, expect, it } from 'vitest';
import { skylineAt, skylineElev } from './horizon';
import type { Skyline } from './types';

describe('skylineAt', () => {
  it('is flat, with terrain false, when there is no height map', () => {
    const s = skylineAt(null, { lat: -89, lon: 0 });
    expect(s.terrain).toBe(false);
    expect(s.elev).toHaveLength(360);
    expect(Array.from(s.elev).every((v) => v === 0)).toBe(true);
  });
});

describe('skylineElev', () => {
  const s: Skyline = { elev: new Float32Array(360), terrain: true };
  s.elev[10] = 2;
  s.elev[11] = 4;
  s.elev[359] = 6;
  s.elev[0] = 2;

  it('returns the stored value at a whole degree', () => {
    expect(skylineElev(s, 10)).toBe(2);
    expect(skylineElev(s, 11)).toBe(4);
  });

  it('steps in a straight line between whole degrees', () => {
    expect(skylineElev(s, 10.5)).toBeCloseTo(3, 6);
    expect(skylineElev(s, 10.25)).toBeCloseTo(2.5, 6);
  });

  it('wraps from 359 back to 0', () => {
    expect(skylineElev(s, 359.5)).toBeCloseTo(4, 6);
    expect(skylineElev(s, 360)).toBe(2);
    expect(skylineElev(s, -1)).toBe(6);
    expect(skylineElev(s, 370)).toBe(2);
  });
});
