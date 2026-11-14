// What the compare table and strips draw, worked out from core/ results (F6, F7). Pure
// functions, tested in node. Nothing here computes an angle: it groups samples into runs,
// picks the best value in a row, and writes numbers for reading.
import type { Flip, Sample } from '../../core/types';

const HOUR_MS = 3_600_000;
const DAY_MS = 86_400_000;

/** A filled part of a strip, in days since the scenario's own time. */
export type Run = { from: number; to: number };

/**
 * The parts of [0, spanDays] where up(sample) is true. Each sample stands for the step after
 * it, as in core/windows.ts. The edge nearest the start is moved to the exact time of the next
 * rise or set (`flip`, found to the minute by nextFlip), so the strip ends where the countdown
 * says; the later edges keep the samples' one-hour step.
 */
export function runs(
  samples: Sample[], up: (s: Sample) => boolean, startMs: number, flip: Flip, spanDays = 30,
): Run[] {
  const out: Run[] = [];
  if (samples.length === 0) return out;
  const stepMs = samples.length > 1 ? samples[1].tMs - samples[0].tMs : HOUR_MS;
  const day = (t: number): number => Math.min(spanDays, Math.max(0, (t - startMs) / DAY_MS));
  for (const s of samples) {
    if (!up(s)) continue;
    const from = day(s.tMs);
    const to = day(s.tMs + stepMs);
    const last = out[out.length - 1];
    if (last && Math.abs(last.to - from) < 1e-9) last.to = to;
    else out.push({ from, to });
  }

  if (flip) {
    const f = day(flip.tMs);
    const stepDays = stepMs / DAY_MS;
    const first = out[0];
    if (flip.type === 'set' && first && first.from === 0 && Math.abs(first.to - f) <= stepDays) {
      first.to = f;
    } else if (flip.type === 'rise' && first && Math.abs(first.from - f) <= stepDays) {
      first.from = f;
    }
  }
  return out.filter((r) => r.to > r.from);
}

/**
 * The columns holding the best value in a row. Empty when there is nothing to compare: fewer
 * than two columns with a value, or every column the same.
 */
export function best(values: (number | null)[], higherIsBetter: boolean): Set<number> {
  const real = values.filter((v): v is number => v !== null && !Number.isNaN(v));
  if (real.length < 2) return new Set();
  const top = higherIsBetter ? Math.max(...real) : Math.min(...real);
  if (real.length === values.length && real.every((v) => v === top)) return new Set();
  const out = new Set<number>();
  values.forEach((v, i) => { if (v === top) out.add(i); });
  return out;
}

/**
 * How good a countdown is, for picking the best one in a row: while up, longer until it sets
 * is better (never sets = best); while down, sooner until it rises is better (never rises =
 * worst). In hours, so up always beats down.
 */
export function countdownScore(upNow: boolean, flip: Flip, tMs: number): number {
  if (!flip) return upNow ? Infinity : -Infinity;
  const h = (flip.tMs - tMs) / HOUR_MS;
  return upNow ? h : -h;
}

/** A length of time in hours, rounded to the hour: "3 d 4 h", "5 h", "0 h". */
export function hoursText(h: number): string {
  const whole = Math.max(0, Math.round(h));
  if (whole >= 24) return `${Math.floor(whole / 24)} d ${whole % 24} h`;
  return `${whole} h`;
}

/** A percentage to one decimal: "73.4 %". */
export function pctText(p: number): string {
  return `${p.toFixed(1)} %`;
}

/**
 * The share of the Sun's disc in view, 0 to 1, as a whole percentage: "73 %". Rounded as the
 * readout rounds it, so the two agree: a sliver is never "0 %" and a disc with a nick out of
 * it is never "100 %".
 */
export function discPctText(frac: number): string {
  const f = Math.min(1, Math.max(0, frac));
  let p = Math.round(f * 100);
  if (p === 0 && f > 0) p = 1;
  if (p === 100 && f < 1) p = 99;
  return `${p} %`;
}

/**
 * How many days from the first sample an evenly stepped series covers: 720 hourly samples are
 * 30 days. Fewer than the span asked for means the table ran out (its end, or a decade that
 * failed to download).
 */
export function daysCovered(samples: Sample[]): number {
  if (samples.length === 0) return 0;
  const stepMs = samples.length > 1 ? samples[1].tMs - samples[0].tMs : HOUR_MS;
  return (samples.length * stepMs) / DAY_MS;
}
