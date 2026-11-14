// The whole-Moon height grid (contract section 2: globe.bin + globe.json): reading it, and the
// surface normals that let the Sun's light show the relief. No three.js here, so the flat map
// (web/src/map/) can use it as well as the 3D globe. Illustration only: no number shown to the
// user comes from here.

import { MOON_RADIUS_KM } from '../core/types';

export type GlobeMeta = {
  width: number;         // cells around the equator; column 0 starts at longitude -180
  height: number;        // cells from pole to pole; row 0 starts at 90 N
  height_scale: number;  // metres = value * height_scale
  source: string;
};

export type GlobeHeights = {
  meta: GlobeMeta;
  /** Lowest and highest cell, metres above the R sphere. */
  range: [number, number];
  /** Height of the cell at a row and column, metres. Columns wrap; rows stop at the poles. */
  cell(row: number, col: number): number;
  /** Height of the cell holding a point, metres. */
  heightAt(lat: number, lon: number): number;
};

const RAD = Math.PI / 180;
/** Slopes are drawn this many times steeper, or relief a few km a cell would barely shade. */
export const GLOBE_RELIEF = 6;

/** Builds the grid from its two files. No network: tests call this with made-up grids. */
export function parseGlobe(meta: GlobeMeta, buffer: ArrayBuffer): GlobeHeights {
  const { width, height, height_scale: scale } = meta;
  if (!Number.isInteger(width) || !Number.isInteger(height) || width < 2 || height < 2) {
    throw new Error('globe.json: "width" and "height" must be whole numbers, 2 or more');
  }
  const count = width * height;
  if (buffer.byteLength < count * 2) {
    throw new Error(`globe.bin: ${buffer.byteLength} bytes, expected ${count * 2}`);
  }
  // Little-endian int16 in the file, read through a DataView so any machine gets it right.
  const view = new DataView(buffer);
  const data = new Int16Array(count);
  let min = Infinity, max = -Infinity;
  for (let i = 0; i < count; i++) {
    const v = data[i] = view.getInt16(i * 2, true);
    if (v < min) min = v;
    if (v > max) max = v;
  }
  const cell = (row: number, col: number): number => {
    const r = Math.min(height - 1, Math.max(0, row));
    const c = ((col % width) + width) % width;
    return data[r * width + c] * scale;
  };
  return {
    meta, range: [min * scale, max * scale], cell,
    heightAt: (lat, lon) => cell(Math.floor((90 - lat) * height / 180), Math.floor((lon + 180) * width / 360)),
  };
}

/** Fetches both files from data/ next to the page. Rejects if either is missing or malformed. */
export async function loadGlobe(): Promise<GlobeHeights> {
  const base = import.meta.env.BASE_URL + 'data/';
  const metaRes = await fetch(base + 'globe.json');
  if (!metaRes.ok) throw new Error(`globe.json: HTTP ${metaRes.status}`);
  // A dev server answers a missing file with the page itself, which is not JSON.
  const meta = (await metaRes.json().catch(() => {
    throw new Error('globe.json: missing, or not JSON');
  })) as GlobeMeta;
  const binRes = await fetch(base + 'globe.bin');
  if (!binRes.ok) throw new Error(`globe.bin: HTTP ${binRes.status}`);
  return parseGlobe(meta, await binRes.arrayBuffer());
}

let shared: Promise<GlobeHeights> | null = null;
/** loadGlobe, fetched once however many views ask for it (the 3D globe and the flat map). */
export function sharedGlobe(): Promise<GlobeHeights> {
  return shared ??= loadGlobe();
}

/**
 * A cell's surface normal in the render frame (+X = 90 E, +Y = south, -Z = longitude 0), with
 * slopes `relief` times steeper than measured. Written to `out` as x, y, z.
 */
export function globeNormalAt(globe: GlobeHeights, row: number, col: number, relief: number, out: number[]): void {
  const { width, height } = globe.meta;
  const cellM = Math.PI * MOON_RADIUS_KM * 1000 / height;
  const lat = (90 - (row + 0.5) * 180 / height) * RAD, lon = (-180 + (col + 0.5) * 360 / width) * RAD;
  const cl = Math.cos(lat), sl = Math.sin(lat), cn = Math.cos(lon), sn = Math.sin(lon);
  // One row below and above, except at the poles where there is only one neighbour.
  const rowsApart = Math.min(height - 1, row + 1) - Math.max(0, row - 1);
  // Toward a pole the columns crowd together. Measuring the east slope between next-door
  // columns there, over a fraction of the ground the north slope spans, drew streaks along
  // the meridians; so step as many columns as cover about one row's worth of ground.
  const step = Math.min(width >> 2, Math.max(1, Math.round(1 / cl)));
  const east = (globe.cell(row, col + step) - globe.cell(row, col - step)) / (2 * step * cellM * cl) * relief;
  const north = (globe.cell(row - 1, col) - globe.cell(row + 1, col)) / (rowsApart * cellM) * relief;
  // up - slope east * east - slope north * north, with the three unit vectors written out.
  const x = cl * sn - east * cn + north * sl * sn;
  const y = -sl + north * cl;
  const z = -cl * cn - east * sn - north * sl * cn;
  const n = Math.hypot(x, y, z);
  out[0] = x / n; out[1] = y / n; out[2] = z / n;
}

/**
 * The normal the globe's texture shows at a point: globeNormalAt blended between the four
 * nearest cell centres, as the renderer blends the texture.
 */
export function globeNormalNear(globe: GlobeHeights, lat: number, lon: number, relief: number, out: number[]): void {
  const { width, height } = globe.meta;
  const fr = (90 - lat) * height / 180 - 0.5, fc = (lon + 180) * width / 360 - 0.5;
  const r0 = Math.floor(fr), c0 = Math.floor(fc), wr = fr - r0, wc = fc - c0;
  const n = [0, 0, 0];
  let x = 0, y = 0, z = 0;
  for (let k = 0; k < 4; k++) {
    const row = Math.min(height - 1, Math.max(0, r0 + (k >> 1)));
    const col = (((c0 + (k & 1)) % width) + width) % width;
    globeNormalAt(globe, row, col, relief, n);
    const w = ((k >> 1) ? wr : 1 - wr) * ((k & 1) ? wc : 1 - wc);
    x += n[0] * w; y += n[1] * w; z += n[2] * w;
  }
  const len = Math.hypot(x, y, z) || 1;
  out[0] = x / len; out[1] = y / len; out[2] = z / len;
}

/**
 * Every cell's surface normal for the flat map, three signed bytes a cell (n * 127), in the
 * Moon's own frame as core/ uses it: +X toward longitude 0, +Y toward 90 E, +Z north. Slopes
 * are `relief` times steeper than measured, as on the 3D globe.
 */
export function globeSlopes(globe: GlobeHeights, relief = GLOBE_RELIEF): Int8Array {
  const { width, height } = globe.meta;
  const out = new Int8Array(width * height * 3), n = [0, 0, 0];
  for (let row = 0; row < height; row++) {
    for (let col = 0; col < width; col++) {
      globeNormalAt(globe, row, col, relief, n);
      const o = (row * width + col) * 3;
      // Render frame to Moon frame: +X = 90 E, +Y = south, -Z = longitude 0.
      out[o] = Math.round(-n[2] * 127); out[o + 1] = Math.round(n[0] * 127); out[o + 2] = Math.round(-n[1] * 127);
    }
  }
  return out;
}
