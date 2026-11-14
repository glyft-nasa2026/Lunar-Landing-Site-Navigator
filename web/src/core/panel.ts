// Solar panel choice (T15, spec F15): how much power a flat panel and an upright panel that turns
// to face the Sun make, each as a fraction of what it would make with the Sun full on its face.
// Pure functions on the samples state.ts already computes; no ephemeris or terrain here.

import type { Sample } from './types';

/** Each 0..1 of full power. */
export type PanelPower = { flat: number; upright: number };

const RAD = Math.PI / 180;

/**
 * Power at one sample. Light falls on a panel in proportion to the cosine of the angle between
 * the Sun and the panel's face direction, scaled by how much of the Sun's disc clears the skyline.
 * Flat (facing straight up): the angle is 90 - altitude, so power = sunFrac * sin(altitude),
 * and nothing when the Sun is below the horizontal (it would light the panel's underside).
 * Upright and turned to the Sun's azimuth: the angle is the altitude, so power = sunFrac * cos(altitude).
 */
export function panelPower(sample: Pick<Sample, 'sun' | 'sunFrac'>): PanelPower {
  const frac = Math.min(1, Math.max(0, sample.sunFrac));
  if (!(frac > 0)) return { flat: 0, upright: 0 };
  const alt = sample.sun.alt * RAD;
  return {
    flat: frac * Math.max(0, Math.sin(alt)),
    upright: frac * Math.max(0, Math.cos(alt)),
  };
}

/** Mean of panelPower over the samples (hourly in the app), dark hours counting as zero. */
export function panelAverage(samples: Pick<Sample, 'sun' | 'sunFrac'>[]): PanelPower {
  if (samples.length === 0) return { flat: 0, upright: 0 };
  let flat = 0;
  let upright = 0;
  for (const s of samples) {
    const p = panelPower(s);
    flat += p.flat;
    upright += p.upright;
  }
  return { flat: flat / samples.length, upright: upright / samples.length };
}
