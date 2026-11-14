// Tests by T15. Samples are made up here, so nothing depends on which data file is in the repo.
import { describe, expect, it } from 'vitest';
import { panelAverage, panelPower } from './panel';

const at = (alt: number, sunFrac = 1) => ({ sun: { alt, az: 120 }, sunFrac });

describe('panelPower', () => {
  it('at a polar site with the Sun 1 degree up: flat about 2 %, upright about 100 %', () => {
    const p = panelPower(at(1));
    expect(p.flat).toBeCloseTo(Math.sin(Math.PI / 180), 6);
    expect(Math.round(p.flat * 100)).toBe(2);
    expect(p.upright).toBeCloseTo(Math.cos(Math.PI / 180), 6);
    expect(Math.round(p.upright * 100)).toBe(100);
  });

  it('with the Sun overhead: flat is full power, upright gets nothing', () => {
    const p = panelPower(at(90));
    expect(p.flat).toBeCloseTo(1, 9);
    expect(p.upright).toBeCloseTo(0, 9);
  });

  it('at 30 degrees: flat half power, upright cos 30', () => {
    const p = panelPower(at(30));
    expect(p.flat).toBeCloseTo(0.5, 9);
    expect(p.upright).toBeCloseTo(Math.sqrt(3) / 2, 9);
  });

  it('scales with the fraction of the disc above the skyline', () => {
    const full = panelPower(at(1));
    const half = panelPower(at(1, 0.5));
    expect(half.flat).toBeCloseTo(full.flat / 2, 12);
    expect(half.upright).toBeCloseTo(full.upright / 2, 12);
  });

  it('gives nothing when the Sun is hidden behind the skyline', () => {
    expect(panelPower(at(5, 0))).toEqual({ flat: 0, upright: 0 });
  });

  it('gives a flat panel nothing when the Sun is visible but below the horizontal', () => {
    // A site on a peak can see the Sun just under 0 degrees; it lights a flat panel's underside.
    const p = panelPower(at(-0.2, 0.8));
    expect(p.flat).toBe(0);
    expect(p.upright).toBeCloseTo(0.8 * Math.cos(0.2 * Math.PI / 180), 9);
  });

  it('clamps a sunFrac outside 0..1 and survives NaN', () => {
    expect(panelPower(at(30, 2)).flat).toBeCloseTo(0.5, 9);
    expect(panelPower(at(30, Number.NaN))).toEqual({ flat: 0, upright: 0 });
  });
});

describe('panelAverage', () => {
  it('is zero with no samples', () => {
    expect(panelAverage([])).toEqual({ flat: 0, upright: 0 });
  });

  it('counts dark hours as zero', () => {
    const avg = panelAverage([at(30), at(30, 0), at(30), at(-10, 0)]);
    expect(avg.flat).toBeCloseTo(0.25, 9);
    expect(avg.upright).toBeCloseTo(Math.sqrt(3) / 4, 9);
  });
});
