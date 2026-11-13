// The south-pole height map (contract section 2: dem.bin + dem.json).
// A square grid in south polar stereographic projection on a sphere of radius R.

import { MOON_RADIUS_KM } from './types';

export type DemMeta = {
  size: number;          // cells per side
  pixel_m: number;
  x_min_m: number;
  y_max_m: number;
  height_scale: number;  // metres = value * height_scale
  nodata: number;
  min_lat: number;       // northern limit of the data, for example -80
  source: string;        // "mock" for T20's file
};

export type Dem = {
  meta: DemMeta;
  /** True when the point is inside the grid and not north of meta.min_lat. */
  covers(lat: number, lon: number): boolean;
  /** Height in metres above the R sphere, bilinear between cells. 0 outside the grid. */
  heightAt(lat: number, lon: number): number;
};

const R_M = MOON_RADIUS_KM * 1000;
const RAD = Math.PI / 180;

/**
 * Contract projection: where a latitude and longitude fall in the grid, in fractional cells.
 * A whole-number col and row is exactly on a stored value.
 */
export function projectToGrid(meta: DemMeta, lat: number, lon: number): { col: number; row: number } {
  const r = 2 * R_M * Math.tan(((90 + lat) / 2) * RAD);
  const x = r * Math.sin(lon * RAD);
  const y = r * Math.cos(lon * RAD);
  return { col: (x - meta.x_min_m) / meta.pixel_m, row: (meta.y_max_m - y) / meta.pixel_m };
}

/** Builds the height map from its two files. No network: tests call this with made-up grids. */
export function parseDem(meta: DemMeta, buffer: ArrayBuffer): Dem {
  const size = meta.size;
  if (!Number.isInteger(size) || size < 2) {
    throw new Error('dem.json: "size" must be a whole number, 2 or more');
  }
  if (!(meta.pixel_m > 0)) throw new Error('dem.json: "pixel_m" must be above 0');
  const count = size * size;
  if (buffer.byteLength < count * 2) {
    throw new Error(`dem.bin: ${buffer.byteLength} bytes, expected ${count * 2}`);
  }

  // The file is little-endian int16. Every browser we target is little-endian too, so the
  // buffer is used in place (no copy of up to 15 MB). A big-endian machine gets a swapped copy.
  let data: Int16Array;
  const hostIsLittleEndian = new Uint8Array(new Uint16Array([1]).buffer)[0] === 1;
  if (hostIsLittleEndian) {
    data = new Int16Array(buffer, 0, count);
  } else {
    data = new Int16Array(count);
    const view = new DataView(buffer);
    for (let i = 0; i < count; i++) data[i] = view.getInt16(i * 2, true);
  }

  const { height_scale: scale, nodata } = meta;
  const last = size - 1;

  // A cell with no data counts as height 0, so one hole can't poison its neighbours.
  const cell = (row: number, col: number): number => {
    const v = data[row * size + col];
    return v === nodata ? 0 : v * scale;
  };

  // A point exactly on the outer row or column can land a hair outside after the projection's
  // rounding, so the edge gets a tolerance far smaller than a cell.
  const EDGE = 1e-6;
  function inGrid(col: number, row: number): boolean {
    return col >= -EDGE && col <= last + EDGE && row >= -EDGE && row <= last + EDGE;
  }

  function covers(lat: number, lon: number): boolean {
    if (!(lat <= meta.min_lat)) return false;
    const { col, row } = projectToGrid(meta, lat, lon);
    return inGrid(col, row);
  }

  function heightAt(lat: number, lon: number): number {
    const p = projectToGrid(meta, lat, lon);
    if (!inGrid(p.col, p.row)) return 0;
    const col = Math.min(Math.max(p.col, 0), last);
    const row = Math.min(Math.max(p.row, 0), last);
    const c0 = Math.min(Math.floor(col), last - 1);
    const r0 = Math.min(Math.floor(row), last - 1);
    const u = col - c0;
    const v = row - r0;
    const top = cell(r0, c0) * (1 - u) + cell(r0, c0 + 1) * u;
    const bottom = cell(r0 + 1, c0) * (1 - u) + cell(r0 + 1, c0 + 1) * u;
    return top * (1 - v) + bottom * v;
  }

  return { meta, covers, heightAt };
}

/**
 * Fetches both files from data/ next to the page. onProgress gets 0..1 as dem.bin arrives.
 * Rejects if either file is missing or malformed.
 */
export async function loadDem(onProgress?: (fraction: number) => void): Promise<Dem> {
  const base = import.meta.env.BASE_URL + 'data/';
  const metaRes = await fetch(base + 'dem.json');
  if (!metaRes.ok) throw new Error(`dem.json: HTTP ${metaRes.status}`);
  const meta = (await metaRes.json()) as DemMeta;
  if (!Number.isInteger(meta.size) || meta.size < 2) {
    throw new Error('dem.json: "size" must be a whole number, 2 or more');
  }

  const binRes = await fetch(base + 'dem.bin');
  if (!binRes.ok) throw new Error(`dem.bin: HTTP ${binRes.status}`);

  // The expected size comes from dem.json, not Content-Length: a host that compresses the
  // file reports the compressed length, which would make the progress wrong.
  const total = meta.size * meta.size * 2;
  const reader = binRes.body?.getReader();
  if (!reader) {
    const whole = await binRes.arrayBuffer();
    onProgress?.(1);
    return parseDem(meta, whole);
  }

  const bytes = new Uint8Array(total);
  let received = 0;
  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    if (received + value.length > total) {
      throw new Error(`dem.bin: more than the expected ${total} bytes`);
    }
    bytes.set(value, received);
    received += value.length;
    onProgress?.(received / total);
  }
  if (received < total) throw new Error(`dem.bin: ${received} bytes, expected ${total}`);
  return parseDem(meta, bytes.buffer);
}
