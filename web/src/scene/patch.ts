// Level of detail for the 3D globe (issue #66): finer whole-Moon heights cut into tiles
// (contract section 2: tiles.json + tiles/), of which only those around the selected site are
// fetched, and the patch of globe drawn from them. Illustration only.

import { BufferAttribute, BufferGeometry, Color, Float32BufferAttribute } from 'three';
import { MOON_RADIUS_KM, type Site } from '../core/types';

export type TileIndex = {
  cells_per_deg: number;   // cells per degree, both ways
  tile_deg: number;        // each tile is this many degrees square
  height_scale: number;    // metres = value * height_scale
  source: string;
};

/**
 * The cells a patch is drawn from, in the whole grid's rows (0 at 90 N) and columns (0 at
 * 180 W). Columns may run below 0 or past the grid's width: longitude wraps. Every `stride`th
 * column is used, so the points are about as far apart east-west as north-south.
 */
export type PatchWindow = { row0: number; row1: number; col0: number; col1: number; stride: number };

const RAD = Math.PI / 180;
/** Half the patch's height in degrees: about 180 km of ground each way from the site. */
export const PATCH_HALF_DEG = 6;
/** How much steeper the patch's slopes are lit: the globe's own GLOBE_RELIEF, so a crater wall is as dark inside the patch as outside. */
export const PATCH_RELIEF = 6;
/** The outer part of the patch, as a fraction of its width, where it fades into the globe. */
const FADE = 0.15;

/**
 * The window round a site, kept between the `south` and `north` latitudes (where the polar
 * meshes take over). Null when nothing is left.
 */
export function patchWindow(site: Site, index: TileIndex, south = -90, north = 90): PatchWindow | null {
  const cpd = index.cells_per_deg, rows = 180 * cpd, half = PATCH_HALF_DEG * cpd;
  const rowC = Math.min(rows - 1, Math.max(0, Math.floor((90 - site.lat) * cpd)));
  const row0 = Math.max(0, Math.ceil((90 - north) * cpd), rowC - half);
  const row1 = Math.min(rows - 1, Math.floor((90 - south) * cpd) - 1, rowC + half);
  if (row1 - row0 < 2) return null;
  const cl = Math.max(0.01, Math.cos(site.lat * RAD));
  const stride = Math.max(1, Math.round(1 / cl));
  // The same ground distance east-west, but never more than one tile's width each way.
  const halfCols = Math.max(1, Math.round(Math.min(PATCH_HALF_DEG / cl, index.tile_deg) * cpd / stride)) * stride;
  const colC = Math.floor((site.lon + 180) * cpd);
  return { row0, row1, col0: colC - halfCols, col1: colC + halfCols, stride };
}

/** The tiles a window touches, as tile row (0 at 90 N) and column (0 at 180 W), longitude wrapped. */
export function windowTiles(win: PatchWindow, index: TileIndex): { row: number; col: number }[] {
  const t = index.tile_deg * index.cells_per_deg, across = Math.round(360 / index.tile_deg);
  const out: { row: number; col: number }[] = [], seen = new Set<number>();
  for (let row = Math.floor(win.row0 / t); row <= Math.floor(win.row1 / t); row++) {
    for (let c = Math.floor(win.col0 / t); c <= Math.floor(win.col1 / t); c++) {
      const col = ((c % across) + across) % across;
      if (!seen.has(row * across + col)) { seen.add(row * across + col); out.push({ row, col }); }
    }
  }
  return out;
}

/** The latitude and longitude at the centre of a cell of the whole grid. */
export function cellSite(index: TileIndex, row: number, col: number): Site {
  const lon = -180 + (col + 0.5) / index.cells_per_deg;
  return { lat: 90 - (row + 0.5) / index.cells_per_deg, lon: ((lon + 540) % 360) - 180 };
}

/**
 * The patch as a mesh lying on the sphere, centred on the origin like the globe (the caller
 * moves it to the Moon's centre). Its ground is not raised: against the Moon's radius the relief
 * would not show, and ground below the sphere would be hidden by the globe. The heights give
 * each point its colour, on the ramp from `low` to `high` over `range` metres, and its normal,
 * with slopes `relief` times steeper. Toward the edge the normals fade into `coarse`, the
 * globe's own normal for the place (x, y, z written to its last argument), so no edge shows.
 */
export function patchGeometry(
  win: PatchWindow, index: TileIndex, height: (row: number, col: number) => number,
  low: Color, high: Color, range: number[], relief = PATCH_RELIEF,
  coarse?: (lat: number, lon: number, out: number[]) => void,
): BufferGeometry {
  const rows = win.row1 - win.row0 + 1, cols = Math.floor((win.col1 - win.col0) / win.stride) + 1;
  const count = rows * cols;
  const flat = new Float32Array(count * 3), raised = new Float32Array(count * 3), colors = new Float32Array(count * 3);
  const color = new Color(), span = Math.max(1, range[1] - range[0]);
  for (let r = 0; r < rows; r++) {
    for (let c = 0; c < cols; c++) {
      const row = win.row0 + r, col = win.col0 + c * win.stride, i = (r * cols + c) * 3;
      const site = cellSite(index, row, col), h = height(row, col);
      const lat = site.lat * RAD, lon = site.lon * RAD;
      // Render frame: +X = 90 E, +Y = south, -Z = longitude 0.
      const x = Math.cos(lat) * Math.sin(lon), y = -Math.sin(lat), z = -Math.cos(lat) * Math.cos(lon);
      const up = MOON_RADIUS_KM + h * relief / 1000;
      flat[i] = x * MOON_RADIUS_KM; flat[i + 1] = y * MOON_RADIUS_KM; flat[i + 2] = z * MOON_RADIUS_KM;
      raised[i] = x * up; raised[i + 1] = y * up; raised[i + 2] = z * up;
      color.copy(low).lerp(high, Math.max(0, Math.min(1, (h - range[0]) / span)));
      color.toArray(colors, i);
    }
  }
  const indices = new Uint32Array((rows - 1) * (cols - 1) * 6);
  let n = 0;
  for (let r = 0; r < rows - 1; r++) {
    for (let c = 0; c < cols - 1; c++) {
      // a b    rows run south, columns east; corners are listed anticlockwise seen from outside.
      // d e
      const a = r * cols + c, b = a + 1, d = a + cols, e = d + 1;
      indices[n++] = a; indices[n++] = d; indices[n++] = b;
      indices[n++] = b; indices[n++] = d; indices[n++] = e;
    }
  }
  const geometry = new BufferGeometry();
  geometry.setIndex(new BufferAttribute(indices, 1));
  // Normals from the raised ground, then the ground is laid back on the sphere.
  geometry.setAttribute('position', new Float32BufferAttribute(raised, 3));
  geometry.computeVertexNormals();
  geometry.setAttribute('position', new Float32BufferAttribute(flat, 3));
  geometry.setAttribute('color', new Float32BufferAttribute(colors, 3));
  if (coarse) {
    const normal = geometry.getAttribute('normal'), far = [0, 0, 0];
    for (let r = 0; r < rows; r++) {
      const edgeR = Math.min(r, rows - 1 - r) / (rows - 1);
      for (let c = 0; c < cols; c++) {
        const edge = Math.min(edgeR, Math.min(c, cols - 1 - c) / (cols - 1));
        if (edge >= FADE) continue;
        const t = edge / FADE, w = t * t * (3 - 2 * t), i = r * cols + c;
        const site = cellSite(index, win.row0 + r, win.col0 + c * win.stride);
        coarse(site.lat, site.lon, far);
        const x = far[0] + (normal.getX(i) - far[0]) * w, y = far[1] + (normal.getY(i) - far[1]) * w;
        const z = far[2] + (normal.getZ(i) - far[2]) * w, len = Math.hypot(x, y, z) || 1;
        normal.setXYZ(i, x / len, y / len, z / len);
      }
    }
  }
  geometry.computeBoundingSphere(); geometry.computeBoundingBox();
  return geometry;
}

/** Fetches tiles.json from data/ next to the page. Rejects if it is missing or malformed. */
export async function loadTileIndex(): Promise<TileIndex> {
  const res = await fetch(import.meta.env.BASE_URL + 'data/tiles.json');
  if (!res.ok) throw new Error(`tiles.json: HTTP ${res.status}`);
  const index = (await res.json().catch(() => { throw new Error('tiles.json: missing, or not JSON'); })) as TileIndex;
  if (!(index.cells_per_deg > 0) || !(index.tile_deg > 0)) throw new Error('tiles.json: bad sizes');
  return index;
}

/** The file name of a tile, under data/. */
export function tileFile(row: number, col: number): string {
  return `tiles/r${String(row).padStart(2, '0')}c${String(col).padStart(2, '0')}.bin`;
}

/** Reads a tile's little-endian int16 values, row by row from its north edge. */
export function parseTile(index: TileIndex, buffer: ArrayBuffer): Int16Array {
  const t = index.tile_deg * index.cells_per_deg;
  if (buffer.byteLength < t * t * 2) throw new Error(`tile: ${buffer.byteLength} bytes, expected ${t * t * 2}`);
  const view = new DataView(buffer), out = new Int16Array(t * t);
  for (let i = 0; i < out.length; i++) out[i] = view.getInt16(i * 2, true);
  return out;
}

/** A height lookup over loaded tiles, by the whole grid's row and column (columns wrap). Metres. */
export function tileHeights(index: TileIndex, tiles: Map<string, Int16Array>): (row: number, col: number) => number {
  const t = index.tile_deg * index.cells_per_deg, width = 360 * index.cells_per_deg;
  return (row, col) => {
    const c = ((col % width) + width) % width;
    const tile = tiles.get(tileFile(Math.floor(row / t), Math.floor(c / t)));
    return tile ? tile[(row % t) * t + (c % t)] * index.height_scale : 0;
  };
}

/** Tiles already fetched, newest last. A few stay, so going back to a site costs nothing. */
const cache = new Map<string, Promise<Int16Array>>();
const KEEP = 24;

/** Fetches the tiles a window needs (each once) and returns their height lookup. */
export async function loadWindow(index: TileIndex, win: PatchWindow): Promise<(row: number, col: number) => number> {
  const tiles = new Map<string, Int16Array>();
  await Promise.all(windowTiles(win, index).map(async ({ row, col }) => {
    const file = tileFile(row, col);
    let pending = cache.get(file);
    cache.delete(file);
    if (!pending) {
      pending = fetch(import.meta.env.BASE_URL + 'data/' + file).then(async (res) => {
        if (!res.ok) throw new Error(`${file}: HTTP ${res.status}`);
        return parseTile(index, await res.arrayBuffer());
      });
      pending.catch(() => { cache.delete(file); });
    }
    cache.set(file, pending);
    tiles.set(file, await pending);
  }));
  while (cache.size > KEEP) cache.delete(cache.keys().next().value as string);
  return tileHeights(index, tiles);
}
