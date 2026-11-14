// Nudge (F11): the difference between the live scenario and a ghost one step away, in words.
// Kept apart from the page so it can be tested. Every number comes from core/ through state.ts;
// this file only compares and words them.

import type { Flip } from '../../core/types';

const HOUR_MS = 3_600_000;
/** Hours in the 30 days that summaryFor covers. */
export const WINDOW_H = 30 * 24;
/**
 * Below this a difference isn't worth reporting, hours: under 1 % of the 30 days. On a smooth
 * Moon a 1 km move tilts the horizon by 0.03 degrees, and Earth, which creeps across the horizon
 * at about half a degree a day, then rises an hour or two sooner or later. That is real but
 * tiny next to what terrain does; the countdown table still shows the exact times.
 */
export const MEANINGFUL_H = 6;

/** One step. Bearings are clockwise from north, as for destination(). */
export type Nudge = { id: string; text: string; bearing?: number; days?: number };
export const NUDGES: readonly Nudge[] = [
  { id: 'n', text: '1 km N', bearing: 0 },
  { id: 'w', text: '1 km W', bearing: 270 },
  { id: 's', text: '1 km S', bearing: 180 },
  { id: 'e', text: '1 km E', bearing: 90 },
  { id: 'minus-day', text: '−1 day', days: -1 },
  { id: 'plus-day', text: '+1 day', days: 1 },
];
export const NUDGE_M = 1000;
export const DAY_MS = 24 * HOUR_MS;

/** What the comparison needs from one scenario. */
export type Facts = {
  tMs: number;
  litPct: number;      // summaryFor: share of the next 30 days with any of the Sun up
  earthPct: number;    // summaryFor: share with Earth up
  sunUp: boolean;      // at tMs
  earthUp: boolean;
  sunFlip: Flip;       // flipFor: next rise or set within 60 days, or null
  earthFlip: Flip;
  terrain: boolean;    // skylineFor(...).terrain
};

export type Tone = 'ok' | 'bad' | 'muted';
export type Line = { text: string; tone: Tone };

const sign = (v: number): string => (v > 0 ? '+' : '−');

/** "31 h" under two days, otherwise "2 days" or "2.5 days". */
export function amountText(hours: number): string {
  const h = Math.abs(hours);
  if (h < 48) return `${Math.round(h)} h`;
  const d = Math.round((h / 24) * 2) / 2;
  return `${d} days`;
}

function pctLine(liveP: number, ghostP: number, what: string): Line | null {
  const dh = ((ghostP - liveP) / 100) * WINDOW_H;
  if (Math.abs(dh) < MEANINGFUL_H) return null;
  return { text: `${sign(dh)}${amountText(dh)} of ${what} in 30 days`, tone: dh > 0 ? 'ok' : 'bad' };
}

type Words = { set: [string, string]; rise: [string, string]; upNow: string; downNow: string; noSet: string; noRise: string;
  setSoon: string; riseSoon: string };
// [better, worse], each with {t} for the amount.
const SUN: Words = {
  set: ['sunset {t} later', 'sunset {t} earlier'],
  rise: ['sunrise {t} sooner', 'sunrise {t} later'],
  upNow: 'Sun up there now (hidden here)',
  downNow: 'Sun hidden there now (up here)',
  noSet: 'no sunset there in the next 60 days',
  noRise: 'no sunrise there in the next 60 days',
  setSoon: 'sunset there within 60 days (none here)',
  riseSoon: 'sunrise there within 60 days (none here)',
};
const EARTH: Words = {
  set: ['keeps Earth {t} longer', 'loses Earth {t} earlier'],
  rise: ['sees Earth {t} sooner', 'sees Earth {t} later'],
  upNow: 'Earth in view there now (hidden here)',
  downNow: 'Earth hidden there now (in view here)',
  noSet: 'keeps Earth for the next 60 days',
  noRise: 'no Earth there in the next 60 days',
  setSoon: 'loses Earth there within 60 days (keeps it here)',
  riseSoon: 'sees Earth there within 60 days (not here)',
};

/**
 * The next rise or set at the ghost against the one here. The events are compared as moments in
 * time, so a ±1 day nudge, which sees the same sunset from a day nearer or further, reports no
 * change here; the countdown lines show the day.
 */
function flipLine(upL: boolean, upG: boolean, fL: Flip, fG: Flip, w: Words): Line | null {
  if (upL !== upG) return { text: upG ? w.upNow : w.downNow, tone: upG ? 'ok' : 'bad' };
  if (!fL && !fG) return null;
  if (upL) {
    // Waiting for a set: later is better; no set within 60 days is best.
    if (!fG) return { text: w.noSet, tone: 'ok' };
    if (!fL) return { text: w.setSoon, tone: 'bad' };
    const dh = (fG.tMs - fL.tMs) / HOUR_MS;
    if (Math.abs(dh) < MEANINGFUL_H) return null;
    return { text: w.set[dh > 0 ? 0 : 1].replace('{t}', amountText(dh)), tone: dh > 0 ? 'ok' : 'bad' };
  }
  // Waiting for a rise: sooner is better; none within 60 days is worst.
  if (!fG) return { text: w.noRise, tone: 'bad' };
  if (!fL) return { text: w.riseSoon, tone: 'ok' };
  const dh = (fG.tMs - fL.tMs) / HOUR_MS;
  if (Math.abs(dh) < MEANINGFUL_H) return null;
  return { text: w.rise[dh < 0 ? 0 : 1].replace('{t}', amountText(dh)), tone: dh < 0 ? 'ok' : 'bad' };
}

/** The difference in plain words, the most important first. */
export function compare(live: Facts, ghost: Facts): Line[] {
  const lines: Line[] = [];
  const add = (l: Line | null): void => {
    if (l) lines.push(l);
  };
  add(pctLine(live.litPct, ghost.litPct, 'sunlight'));
  add(flipLine(live.sunUp, ghost.sunUp, live.sunFlip, ghost.sunFlip, SUN));
  add(pctLine(live.earthPct, ghost.earthPct, 'Earth contact'));
  add(flipLine(live.earthUp, ghost.earthUp, live.earthFlip, ghost.earthFlip, EARTH));
  if (lines.length === 0) {
    lines.push({ text: `No meaningful change (under ${MEANINGFUL_H} h)`, tone: 'muted' });
  }
  if (!live.terrain || !ghost.terrain) {
    lines.push({
      text: 'Terrain isn\'t modelled north of 85° S, so the ground here is a smooth Moon.',
      tone: 'muted',
    });
  }
  return lines;
}
