import { describe, expect, it } from 'vitest';
import type { Flip, Sample } from '../../core/types';
import { SUN_RADIUS } from '../../core/windows';
import {
  emptyNote, lineOf, plotTime, sunTop, throttle, timeAtPx, timelineModel, Y_MIN_SPAN, yMaxOf,
} from './model';

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

describe('plotTime', () => {
  const T = Date.UTC(2026, 10, 14, 10, 0, 0);   // 2026-11-14 10:00 UTC

  it('writes the UTC time with no zone, so Plotly shows it as written', () => {
    expect(plotTime(T)).toBe('2026-11-14 10:00:00.000');
    expect(plotTime(T + 90_500)).toBe('2026-11-14 10:01:30.500');
    expect(plotTime(Date.UTC(1900, 0, 1))).toBe('1900-01-01 00:00:00.000');
    expect(plotTime(Date.UTC(2100, 11, 31, 23))).toBe('2100-12-31 23:00:00.000');
  });

  it('gives the same string whatever time zone the machine is in', () => {
    const before = process.env.TZ;
    try {
      for (const tz of ['Asia/Kuala_Lumpur', 'America/Los_Angeles', 'UTC']) {
        process.env.TZ = tz;
        // The zone change is real: local hours differ, the string does not.
        expect(new Date(T).getHours()).toBe(tz === 'Asia/Kuala_Lumpur' ? 18 : tz === 'UTC' ? 10 : 2);
        expect(plotTime(T)).toBe('2026-11-14 10:00:00.000');
      }
    } finally {
      if (before === undefined) delete process.env.TZ; else process.env.TZ = before;
    }
  });

  it('keeps a crossing between two whole milliseconds in order with its neighbours', () => {
    expect(plotTime(T + 0.75) >= plotTime(T)).toBe(true);
    expect(plotTime(T + 0.75) <= plotTime(T + 1)).toBe(true);
  });

  it('gives no value, without throwing, for a time that is not a date', () => {
    expect(plotTime(Number.NaN)).toBe('');
    expect(plotTime(Number.POSITIVE_INFINITY)).toBe('');
  });
});

describe('emptyNote', () => {
  const START = Date.UTC(1900, 0, 1);
  const END = Date.UTC(2101, 0, 1);

  it('says the window is outside 1900 to 2100 when it starts before or at the end of the table', () => {
    for (const from of [START - H, END, END + 24 * H, Number.NaN]) {
      expect(emptyNote(0, from, START, END)).toBe('This window is outside the Sun and Earth table (1900 to 2100).');
    }
  });

  it('inside the table with no samples (a decade that did not download): outside the table, no years', () => {
    expect(emptyNote(0, Date.UTC(2055, 5, 1), START, END)).toBe('This window is outside the Sun and Earth table.');
  });

  it('one sample: the table ends before a second one', () => {
    expect(emptyNote(1, END - H, START, END)).toMatch(/ends less than two hours from here/);
    expect(emptyNote(1, END - H / 2, START, END)).toMatch(/ends less than two hours from here/);
  });

  it('never says "Loading": none of these is a wait', () => {
    for (const [n, from] of [[0, START - H], [0, START + H], [1, END - H], [0, END]] as const) {
      expect(emptyNote(n, from, START, END)).not.toMatch(/Loading/);
    }
  });
});
