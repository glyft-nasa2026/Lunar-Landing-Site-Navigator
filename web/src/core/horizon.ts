// First pass by T00: the flat skyline only. T05 owns this file next and writes the terrain
// walk from the contract's Skyline block. Names and signatures never change.

import type { Dem } from './dem';
import type { Site, Skyline } from './types';

/** Skyline seen from a site: 360 elevations in degrees, index = azimuth. Flat for now. */
export function skylineAt(_dem: Dem | null, _site: Site): Skyline {
  return { elev: new Float32Array(360), terrain: false };
}

/** Skyline elevation at any azimuth, straight-line between the two whole degrees around it. */
export function skylineElev(s: Skyline, az: number): number {
  const a = ((az % 360) + 360) % 360;
  const i = Math.floor(a) % 360;
  const u = a - Math.floor(a);
  return s.elev[i] * (1 - u) + s.elev[(i + 1) % 360] * u;
}
