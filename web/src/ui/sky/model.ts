// Sky panorama data (F9), kept apart from Plotly and the page so it can be tested.
// Every number comes from core/ through state.ts: this file only arranges it for the chart.

import { skylineElev } from '../../core/horizon';
import type { AltAz, Sample, Skyline } from '../../core/types';
import { SUN_RADIUS } from '../../core/windows';

/** The bottom of the elevation axis, degrees. */
export const Y_BOTTOM = -5;
/** The top of the elevation axis unless something is higher, degrees. */
export const Y_TOP_DEFAULT = 15;
/** Room left above the highest thing when the axis is raised, degrees. */
const Y_HEADROOM = 2;

export type Path = { x: (number | null)[]; y: (number | null)[] };

export type SunState = 'up' | 'partly' | 'hidden';

export type SkyModel = {
  /** Closed outline of the skyline, from below the axis up to the skyline and back. */
  ground: { x: number[]; y: number[] };
  sunPath: Path;
  earthPath: Path;
  /** Positions at the scenario's own time, or null when that time is outside the table. */
  now: null | {
    sun: AltAz;
    earth: AltAz;
    sunState: SunState;
    sunFrac: number;
    earthUp: boolean;
    /** Skyline height at the Sun's and Earth's azimuths, degrees. */
    skylineAtSun: number;
    skylineAtEarth: number;
  };
  yTop: number;
};

/**
 * A body's path as chart lines. Azimuth wraps from 360 to 0; a null between two points
 * breaks the line there, so it doesn't streak across the whole chart.
 */
export function pathOf(samples: Sample[], body: 'sun' | 'earth'): Path {
  const x: (number | null)[] = [];
  const y: (number | null)[] = [];
  let prev: number | null = null;
  for (const s of samples) {
    const p = s[body];
    if (prev !== null && Math.abs(p.az - prev) > 180) {
      x.push(null);
      y.push(null);
    }
    x.push(p.az);
    y.push(p.alt);
    prev = p.az;
  }
  return { x, y };
}

/** The skyline as a closed shape: 0..360 along the top, closed far below the axis. */
export function groundOf(skyline: Skyline): { x: number[]; y: number[] } {
  const floor = Y_BOTTOM - 90;
  const x: number[] = [0];
  const y: number[] = [floor];
  for (let az = 0; az <= 360; az++) {
    x.push(az);
    y.push(skyline.elev[az % 360]);
  }
  x.push(360);
  y.push(floor);
  return { x, y };
}

/** Same rule as the readout: hidden when no part of the Sun's disc clears the skyline. */
export function sunStateOf(sunFrac: number): SunState {
  if (sunFrac <= 0) return 'hidden';
  if (sunFrac >= 1) return 'up';
  return 'partly';
}

/**
 * Top of the elevation axis: 15 degrees, raised (to a whole 5 degrees, at most 90) when the
 * skyline, a path or a marker would go higher.
 */
export function yTopOf(heights: Iterable<number>): number {
  let max = -Infinity;
  for (const h of heights) if (Number.isFinite(h) && h > max) max = h;
  if (!(max + Y_HEADROOM > Y_TOP_DEFAULT)) return Y_TOP_DEFAULT;
  return Math.min(90, Math.ceil((max + Y_HEADROOM) / 5) * 5);
}

/**
 * Everything the chart draws. samples: hourly from the scenario's time over 30 days
 * (samplesFor(sc, '30d')); the first one is "now" when its time equals tMs.
 */
export function skyModel(samples: Sample[], skyline: Skyline, tMs: number): SkyModel {
  const first = samples[0];
  const now = first && first.tMs === tMs
    ? {
      sun: first.sun,
      earth: first.earth,
      sunState: sunStateOf(first.sunFrac),
      sunFrac: first.sunFrac,
      earthUp: first.earthUp,
      skylineAtSun: skylineElev(skyline, first.sun.az),
      skylineAtEarth: skylineElev(skyline, first.earth.az),
    }
    : null;

  function* heights(): Generator<number> {
    yield* skyline.elev;
    for (const s of samples) {
      yield s.sun.alt + SUN_RADIUS;
      yield s.earth.alt;
    }
  }

  return {
    ground: groundOf(skyline),
    sunPath: pathOf(samples, 'sun'),
    earthPath: pathOf(samples, 'earth'),
    now,
    yTop: yTopOf(heights()),
  };
}

/**
 * Marker size in pixels for the Sun: its true diameter on the elevation axis, so the marker is
 * fully under the skyline exactly when the Sun is hidden. Never smaller than minPx.
 */
export function sunMarkerPx(plotHeightPx: number, yTop: number, minPx: number): number {
  const span = yTop - Y_BOTTOM;
  if (!(plotHeightPx > 0) || !(span > 0)) return minPx;
  return Math.max(minPx, (2 * SUN_RADIUS * plotHeightPx) / span);
}
