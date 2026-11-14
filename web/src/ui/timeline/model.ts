// Timeline chart data (F8), kept apart from Plotly and the page so it can be tested.
// Every number comes from core/ through state.ts: this file only arranges it for the chart.

import type { Flip, Sample } from '../../core/types';
import { SUN_RADIUS } from '../../core/windows';

/** The y axis never shows less than this either side of zero, degrees. */
export const Y_MIN_SPAN = 8;
/** Gridline step on the y axis, degrees; the axis ends on a multiple of it. */
export const Y_STEP = 4;

export type Line = { x: number[]; y: number[] };

export type TimelineModel = {
  /** Height of the top of the Sun's disc above the skyline: above zero means "Sun up". */
  sun: Line;
  /** Height of Earth's centre above the skyline: above zero means "Earth up". */
  earth: Line;
  /** The y axis runs from -yMax to yMax. */
  yMax: number;
};

/**
 * The Sun line shows the top of the disc, not its centre. The readout calls the Sun up while any
 * part of the disc clears the skyline (sunFrac > 0), so this line crosses zero exactly when the
 * countdown says sunrise or sunset.
 */
export const sunTop = (s: Sample): number => s.sunAbove + SUN_RADIUS;
export const earthTop = (s: Sample): number => s.earthAbove;

/**
 * One body's line, with the exact time of every crossing of zero added between the hourly
 * samples. `flipAfter(tMs)` returns the next rise or set after tMs (from core's nextFlip, via
 * state.ts); when it can't, the crossing is placed by straight-line interpolation instead.
 */
export function lineOf(
  samples: Sample[],
  value: (s: Sample) => number,
  flipAfter: (tMs: number) => Flip,
): Line {
  const x: number[] = [];
  const y: number[] = [];
  for (let i = 0; i < samples.length; i++) {
    const s = samples[i];
    const v = value(s);
    if (i > 0) {
      const p = samples[i - 1];
      const pv = value(p);
      if (pv > 0 !== v > 0) {
        const flip = flipAfter(p.tMs);
        const exact = flip && flip.tMs > p.tMs && flip.tMs <= s.tMs ? flip.tMs : null;
        x.push(exact ?? p.tMs + ((s.tMs - p.tMs) * pv) / (pv - v));
        y.push(0);
      }
    }
    x.push(s.tMs);
    y.push(v);
  }
  return { x, y };
}

/** Half-height of the y axis: covers every value, at least Y_MIN_SPAN, on a gridline. */
export function yMaxOf(lines: Line[]): number {
  let m = 0;
  for (const l of lines) for (const v of l.y) if (Number.isFinite(v)) m = Math.max(m, Math.abs(v));
  return Math.max(Y_MIN_SPAN, Math.ceil(m / Y_STEP) * Y_STEP);
}

export function timelineModel(
  samples: Sample[],
  flipAfter: (tMs: number, body: 'sun' | 'earth') => Flip,
): TimelineModel {
  const sun = lineOf(samples, sunTop, (t) => flipAfter(t, 'sun'));
  const earth = lineOf(samples, earthTop, (t) => flipAfter(t, 'earth'));
  return { sun, earth, yMax: yMaxOf([sun, earth]) };
}

/**
 * The time under a pointer: `px` from the left of the plot area, `lengthPx` its width, the axis
 * from startMs to endMs. Clamped to the window, so a drag never moves the window itself.
 */
export function timeAtPx(px: number, lengthPx: number, startMs: number, endMs: number): number {
  if (!(lengthPx > 0)) return startMs;
  const f = Math.min(1, Math.max(0, px / lengthPx));
  return Math.round(startMs + f * (endMs - startMs));
}

/**
 * Calls `fn` with the latest value at most once per frame. `schedule` is requestAnimationFrame
 * in the page; tests pass their own. `flush` runs a waiting call at once (end of a drag).
 */
export function throttle<T>(
  fn: (v: T) => void,
  schedule: (cb: () => void) => unknown,
): { push: (v: T) => void; flush: () => void } {
  let waiting = false;
  let latest: T | undefined;
  let has = false;
  const run = (): void => {
    waiting = false;
    if (!has) return;
    has = false;
    fn(latest as T);
  };
  return {
    push(v: T) {
      latest = v;
      has = true;
      if (!waiting) {
        waiting = true;
        schedule(run);
      }
    },
    flush: run,
  };
}
