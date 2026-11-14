import { describe, expect, it } from 'vitest';
import type { Flip, Sample } from '../../core/types';
import { SUN_RADIUS } from '../../core/windows';
import { lineOf, sunTop, throttle, timeAtPx, timelineModel, Y_MIN_SPAN, yMaxOf } from './model';

const H = 3_600_000;

function sample(tMs: number, sunAbove: number, earthAbove: number): Sample {
  return {
    tMs,
    sun: { alt: sunAbove, az: 0 },
    earth: { alt: earthAbove, az: 0 },
    sunAbove,
    earthAbove,
    sunFrac: Math.max(0, Math.min(1, (sunAbove + SUN_RADIUS) / (2 * SUN_RADIUS))),
    earthUp: earthAbove > 0,
  };
}

const noFlip = (): Flip => null;

describe('sunTop', () => {
  it('is above zero exactly when part of the disc is up (sunFrac > 0)', () => {
    for (const a of [-1, -0.3, -SUN_RADIUS - 1e-6, -SUN_RADIUS + 1e-6, 0, 0.5]) {
      const s = sample(0, a, 0);
      expect(sunTop(s) > 0).toBe(s.sunFrac > 0);
    }
  });
});

describe('lineOf', () => {
  it('passes values through and adds nothing without a crossing', () => {
    const ss = [sample(0, 1, 1), sample(H, 2, 2), sample(2 * H, 3, 3)];
    const l = lineOf(ss, (s) => s.earthAbove, noFlip);
    expect(l).toEqual({ x: [0, H, 2 * H], y: [1, 2, 3] });
  });

  it('puts a crossing at the exact flip time when one falls inside the hour', () => {
    const ss = [sample(0, 0, 2), sample(H, 0, -1)];
    const flip = 0.25 * H;
    const l = lineOf(ss, (s) => s.earthAbove, (t) => {
      expect(t).toBe(0);
      return { type: 'set', tMs: flip };
    });
    expect(l.x).toEqual([0, flip, H]);
    expect(l.y).toEqual([2, 0, -1]);
  });

  it('interpolates when the flip is missing or outside the hour', () => {
    const ss = [sample(0, 0, 2), sample(H, 0, -1)];
    const mid = (2 / 3) * H;
    expect(lineOf(ss, (s) => s.earthAbove, noFlip).x[1]).toBeCloseTo(mid);
    expect(lineOf(ss, (s) => s.earthAbove, () => ({ type: 'set', tMs: 5 * H })).x[1]).toBeCloseTo(mid);
  });

  it('adds one point per crossing, rising and setting', () => {
    const ss = [sample(0, 0, -1), sample(H, 0, 1), sample(2 * H, 0, -1)];
    const l = lineOf(ss, (s) => s.earthAbove, noFlip);
    expect(l.y).toEqual([-1, 0, 1, 0, -1]);
  });
});

describe('yMaxOf', () => {
  it('is at least the minimum span', () => {
    expect(yMaxOf([{ x: [0], y: [0.5] }])).toBe(Y_MIN_SPAN);
  });
  it('covers the largest value, rounded up to a gridline', () => {
    expect(yMaxOf([{ x: [0, 1], y: [3, -13.2] }])).toBe(16);
  });
});

describe('timelineModel', () => {
  it('builds both lines and asks for the right body', () => {
    const ss = [sample(0, 1, -1), sample(H, -1, 1)];
    const asked: string[] = [];
    const m = timelineModel(ss, (_t, body) => {
      asked.push(body);
      return null;
    });
    expect(asked.sort()).toEqual(['earth', 'sun']);
    expect(m.sun.y[0]).toBeCloseTo(1 + SUN_RADIUS);
    expect(m.earth.y).toEqual([-1, 0, 1]);
    expect(m.yMax).toBe(Y_MIN_SPAN);
  });
});

describe('timeAtPx', () => {
  it('maps the plot area onto the window and clamps outside it', () => {
    expect(timeAtPx(0, 100, 1000, 2000)).toBe(1000);
    expect(timeAtPx(50, 100, 1000, 2000)).toBe(1500);
    expect(timeAtPx(-20, 100, 1000, 2000)).toBe(1000);
    expect(timeAtPx(150, 100, 1000, 2000)).toBe(2000);
    expect(timeAtPx(10, 0, 1000, 2000)).toBe(1000);
  });
});

describe('throttle', () => {
  it('calls once per frame with the latest value, and flush runs a waiting call', () => {
    const frames: (() => void)[] = [];
    const got: number[] = [];
    const t = throttle<number>((v) => got.push(v), (cb) => frames.push(cb));
    t.push(1);
    t.push(2);
    t.push(3);
    expect(frames).toHaveLength(1);
    frames.shift()!();
    expect(got).toEqual([3]);
    t.push(4);
    t.flush();
    expect(got).toEqual([3, 4]);
    frames.shift()!(); // the frame scheduled for 4 finds nothing left to do
    expect(got).toEqual([3, 4]);
  });
});
