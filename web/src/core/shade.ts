// Illustrative light layers for the flat map (T31). The map draws these and computes no Sun
// angle itself. They illustrate; the lit/dark answer shown to the user comes from windows.ts.

import type { Dem } from './dem';
import type { Vec3 } from './ephemeris';
import { polarInverse } from './projection';
import { MOON_RADIUS_KM } from './types';

const RAD = Math.PI / 180;
const R_M = MOON_RADIUS_KM * 1000;
/** The Sun's angular radius, as in windows.ts. */
const SUN_RADIUS_DEG = 0.267;

export type PolarShade = {
  /** Cells per side of this layer; cell (row, col) is height-map cell (row * stride, col * stride). */
  size: number;
  stride: number;
  /** Fraction of the Sun's disc above the terrain: 0, 0.5 or 1. NaN outside the height map's coverage. */
  frac: Float32Array;
  /** Cosine of the angle between the Sun and the ground's normal; below 0 the slope faces away. */
  cosI: Float32Array;
  /** Height of each cell, metres above the R sphere. NaN outside the height map's coverage. */
  height: Float32Array;
  /** Lowest and highest covered height, metres. */
  heightRange: [number, number];
};

type PolarGround = {
  size: number; stride: number; cell_m: number;
  /** Height of each cell above the plane touching the south pole, metres (the ground drops away from the pole). */
  z: Float32Array;
  covered: Uint8Array;
  height: Float32Array;
  heightRange: [number, number];
};

const grounds = new WeakMap<Dem, Map<number, PolarGround>>();

/** The stride that keeps a layer at or under `maxCells` per side. */
export function shadeStride(size: number, maxCells: number): number {
  return Math.max(1, Math.ceil(size / Math.max(2, maxCells)));
}

/** Heights in the plane-at-the-pole frame, built once per height map and stride. */
function polarGround(dem: Dem, stride: number): PolarGround {
  let byStride = grounds.get(dem);
  if (!byStride) grounds.set(dem, (byStride = new Map()));
  const known = byStride.get(stride);
  if (known) return known;
  const { meta } = dem;
  const size = Math.floor((meta.size - 1) / stride) + 1;
  const cell_m = meta.pixel_m * stride;
  const z = new Float32Array(size * size), covered = new Uint8Array(size * size);
  const height = new Float32Array(size * size);
  let lo = Infinity, hi = -Infinity;
  for (let row = 0; row < size; row++) {
    const y = meta.y_max_m - row * cell_m;
    for (let col = 0; col < size; col++) {
      const x = meta.x_min_m + col * cell_m;
      const { lat, lon } = polarInverse(x, y);
      const i = row * size + col;
      covered[i] = dem.covers(lat, lon) ? 1 : 0;
      const h = covered[i] ? dem.heightAt(lat, lon) : 0;
      height[i] = covered[i] ? h : NaN;
      if (covered[i]) { lo = Math.min(lo, h); hi = Math.max(hi, h); }
      // Angle from the pole at the Moon's centre, and the point's height above the polar plane.
      const c = (90 + lat) * RAD;
      z[i] = (R_M + h) * Math.cos(c) - R_M;
    }
  }
  const heightRange: [number, number] = lo <= hi ? [lo, hi] : [0, 0];
  const ground = { size, stride, cell_m, z, covered, height, heightRange };
  byStride.set(stride, ground);
  return ground;
}

/**
 * The Sun in the map's frame: x toward 90 E, y toward longitude 0, z up from the south pole.
 * A rotation of the Moon-fixed frame (contract section 1): (x, y, z) -> (y, x, -z).
 */
function sunInGrid(sun: Vec3): Vec3 {
  const n = Math.hypot(sun[0], sun[1], sun[2]) || 1;
  return [sun[1] / n, sun[0] / n, -sun[2] / n];
}

/**
 * Marks each cell lit (1) or in shadow (0) for light arriving at `elevDeg` above the polar plane
 * from the horizontal direction (lx, ly). One sweep from the sunward edge: each cell's shadow
 * line is the higher of its own ground and the line from the cell before it, dropping by the
 * ray's slope. Curvature is in z, so a peak far away shadows less as the ground falls away.
 */
function sweep(g: PolarGround, lx: number, ly: number, elevDeg: number, lit: Uint8Array): void {
  const { size, z } = g;
  const slope = Math.tan(elevDeg * RAD);
  // In cells: toward the Sun is (+dc columns, +dr rows); rows grow down, map y grows up.
  const dc = lx, dr = -ly;
  const alongCols = Math.abs(dc) >= Math.abs(dr);
  const main = alongCols ? dc : dr, side = (alongCols ? dr : dc) / Math.abs(main);
  const step = Math.sign(main);
  const rise = slope * g.cell_m * Math.hypot(1, side);
  const shadow = new Float32Array(size * size);
  const at = (m: number, s: number): number => alongCols ? s * size + m : m * size + s;
  const first = step > 0 ? size - 1 : 0;
  for (let s = 0; s < size; s++) { const i = at(first, s); shadow[i] = z[i]; lit[i] = 1; }
  for (let m = first - step; m >= 0 && m < size; m -= step) {
    const up = m + step;
    for (let s = 0; s < size; s++) {
      const i = at(m, s), u = s + side;
      if (u < 0 || u > size - 1) { shadow[i] = z[i]; lit[i] = 1; continue; }
      const s0 = Math.min(Math.floor(u), size - 2), f = u - s0;
      const blocker = shadow[at(up, s0)] * (1 - f) + shadow[at(up, s0 + 1)] * f - rise;
      lit[i] = z[i] >= blocker ? 1 : 0;
      shadow[i] = Math.max(z[i], blocker);
    }
  }
}

/**
 * Sun and shadow over the height map, on every `stride`th cell so that the layer is at most
 * `maxCells` per side. `sun` is the unit vector from the Moon's centre to the Sun.
 */
export function shadePolar(dem: Dem, sun: Vec3, maxCells = 1300): PolarShade {
  const stride = shadeStride(dem.meta.size, maxCells);
  const g = polarGround(dem, stride);
  const { size, z, covered, cell_m } = g;
  const n = size * size;
  const [lx, ly, lz] = sunInGrid(sun);
  const horizontal = Math.hypot(lx, ly);
  const frac = new Float32Array(n), cosI = new Float32Array(n);
  if (horizontal < 1e-9) {
    frac.fill(lz > 0 ? 1 : 0);
  } else {
    const elev = Math.atan2(lz, horizontal) / RAD;
    const top = new Uint8Array(n), bottom = new Uint8Array(n);
    sweep(g, lx / horizontal, ly / horizontal, elev + SUN_RADIUS_DEG, top);
    sweep(g, lx / horizontal, ly / horizontal, elev - SUN_RADIUS_DEG, bottom);
    for (let i = 0; i < n; i++) frac[i] = (top[i] + bottom[i]) / 2;
  }
  for (let row = 0; row < size; row++) {
    for (let col = 0; col < size; col++) {
      const i = row * size + col;
      if (!covered[i]) { frac[i] = NaN; cosI[i] = NaN; continue; }
      const c0 = Math.max(0, col - 1), c1 = Math.min(size - 1, col + 1);
      const r0 = Math.max(0, row - 1), r1 = Math.min(size - 1, row + 1);
      const dzdx = (z[row * size + c1] - z[row * size + c0]) / ((c1 - c0) * cell_m);
      // Rows grow down and y grows up.
      const dzdy = (z[r0 * size + col] - z[r1 * size + col]) / ((r1 - r0) * cell_m);
      cosI[i] = (-dzdx * lx - dzdy * ly + lz) / Math.hypot(dzdx, dzdy, 1);
    }
  }
  return { size, stride, frac, cosI, height: g.height, heightRange: g.heightRange };
}

/**
 * Cosine of the Sun's zenith angle at each cell centre of a latitude-longitude grid, `width`
 * cells from 180 W to 180 E and `height` cells from 90 N to 90 S. Above 0 is day.
 */
export function shadeGlobal(sun: Vec3, width: number, height: number): Float32Array {
  const n = Math.hypot(sun[0], sun[1], sun[2]) || 1;
  const [sx, sy, sz] = [sun[0] / n, sun[1] / n, sun[2] / n];
  const out = new Float32Array(width * height);
  // The longitude terms are the same on every row: work them out once.
  const cosLon = new Float64Array(width), sinLon = new Float64Array(width);
  for (let i = 0; i < width; i++) {
    const lon = (-180 + ((i + 0.5) * 360) / width) * RAD;
    cosLon[i] = Math.cos(lon); sinLon[i] = Math.sin(lon);
  }
  for (let j = 0; j < height; j++) {
    const lat = (90 - ((j + 0.5) * 180) / height) * RAD;
    const cl = Math.cos(lat), sl = Math.sin(lat);
    for (let i = 0; i < width; i++) {
      out[j * width + i] = cl * cosLon[i] * sx + cl * sinLon[i] * sy + sl * sz;
    }
  }
  return out;
}

/** Where a direction from the Moon's centre meets the surface (sub-solar or sub-Earth point). */
export function subPoint(v: Vec3): { lat: number; lon: number } {
  const n = Math.hypot(v[0], v[1], v[2]) || 1;
  return { lat: Math.asin(Math.max(-1, Math.min(1, v[2] / n))) / RAD, lon: Math.atan2(v[1], v[0]) / RAD };
}
