// The whole-Moon height grid (contract section 2: globe.bin + globe.json) and the two textures
// the 3D globe wears: height colours, and surface normals so the Sun's light shows the relief.
// Illustration only: no number shown to the user comes from here.

import {
  Color, DataTexture, LinearFilter, LinearMipmapLinearFilter, NoColorSpace, RepeatWrapping,
  RGBAFormat, SRGBColorSpace, UnsignedByteType, type BufferGeometry,
} from 'three';
import { parseDem, type Dem, type DemMeta } from '../core/dem';
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

/**
 * The north cap's height grid (contract section 2: north.bin + north.json) as a height map of
 * mirrored latitudes: its grid is the mirror image of dem.bin's, so the south-pole code reads
 * it unchanged when every latitude is negated. Ask it for (-lat, lon).
 */
export function parseNorth(meta: DemMeta, buffer: ArrayBuffer): Dem {
  if (!(meta.min_lat > 0)) throw new Error('north.json: "min_lat" must be a northern latitude');
  return parseDem({ ...meta, min_lat: -meta.min_lat }, buffer);
}

/** Fetches the north cap from data/ next to the page. Rejects if it is missing or malformed. */
export async function loadNorth(): Promise<Dem> {
  const base = import.meta.env.BASE_URL + 'data/';
  const metaRes = await fetch(base + 'north.json');
  if (!metaRes.ok) throw new Error(`north.json: HTTP ${metaRes.status}`);
  const meta = (await metaRes.json().catch(() => {
    throw new Error('north.json: missing, or not JSON');
  })) as DemMeta;
  const binRes = await fetch(base + 'north.bin');
  if (!binRes.ok) throw new Error(`north.bin: HTTP ${binRes.status}`);
  return parseNorth(meta, await binRes.arrayBuffer());
}

/** The latitude and longitude a texture coordinate of the globe's textures stands for. */
export function uvSite(u: number, v: number): { lat: number; lon: number } {
  return { lat: 90 - v * 180, lon: (u - Math.floor(u)) * 360 - 180 };
}

/**
 * Re-maps a SphereGeometry's texture coordinates to the grid's layout: u runs east from
 * longitude -180, v runs south from 90 N (see uvSite). SphereGeometry's own u runs west from
 * 90 W in the render frame, and its v covers only the part of the sphere that was built, so a
 * globe with its south cap left open would otherwise squeeze the whole Moon into what remains.
 * u goes below 0 instead of jumping, and the textures repeat, so there is no seam.
 */
export function mapGlobeUv(geometry: BufferGeometry): void {
  const position = geometry.getAttribute('position'), uv = geometry.getAttribute('uv');
  for (let i = 0; i < uv.count; i++) {
    // Render frame: +Y is south.
    const colat = Math.acos(Math.max(-1, Math.min(1, -position.getY(i) / MOON_RADIUS_KM)));
    uv.setXY(i, 0.25 - uv.getX(i), colat / Math.PI);
  }
  uv.needsUpdate = true;
}

function texture(data: Uint8Array, width: number, height: number, srgb: boolean): DataTexture {
  const tex = new DataTexture(data, width, height, RGBAFormat, UnsignedByteType);
  tex.colorSpace = srgb ? SRGBColorSpace : NoColorSpace;
  tex.wrapS = RepeatWrapping;
  tex.magFilter = LinearFilter; tex.minFilter = LinearMipmapLinearFilter; tex.generateMipmaps = true;
  tex.needsUpdate = true;
  return tex;
}

/** RGBA bytes: each cell's height on the ramp from `low` to `high` over `range` metres, clamped. */
export function globeColors(globe: GlobeHeights, low: Color, high: Color, range: number[]): Uint8Array {
  const { width, height } = globe.meta;
  const ramp = new Uint8Array(256 * 3), color = new Color();
  for (let i = 0; i < 256; i++) {
    // Mixed in the renderer's working colours like the terrain's vertex colours, stored as sRGB.
    color.copy(low).lerp(high, i / 255).convertLinearToSRGB();
    ramp.set([Math.round(color.r * 255), Math.round(color.g * 255), Math.round(color.b * 255)], i * 3);
  }
  const span = Math.max(1, range[1] - range[0]);
  const out = new Uint8Array(width * height * 4);
  for (let row = 0; row < height; row++) {
    for (let col = 0; col < width; col++) {
      const t = Math.max(0, Math.min(1, (globe.cell(row, col) - range[0]) / span));
      const k = Math.round(t * 255) * 3, o = (row * width + col) * 4;
      out[o] = ramp[k]; out[o + 1] = ramp[k + 1]; out[o + 2] = ramp[k + 2]; out[o + 3] = 255;
    }
  }
  return out;
}

/**
 * RGBA bytes: each cell's surface normal in the render frame (+X = 90 E, +Y = south,
 * -Z = longitude 0), stored as n * 0.5 + 0.5. Slopes are `relief` times steeper than measured.
 */
export function globeNormals(globe: GlobeHeights, relief = GLOBE_RELIEF): Uint8Array {
  const { width, height } = globe.meta;
  const cellM = Math.PI * MOON_RADIUS_KM * 1000 / height;
  const out = new Uint8Array(width * height * 4);
  for (let row = 0; row < height; row++) {
    const lat = (90 - (row + 0.5) * 180 / height) * RAD;
    const cl = Math.cos(lat), sl = Math.sin(lat);
    // One row below and above, except at the poles where there is only one neighbour.
    const rowsApart = Math.min(height - 1, row + 1) - Math.max(0, row - 1);
    // Toward a pole the columns crowd together. Measuring the east slope between next-door
    // columns there, over a fraction of the ground the north slope spans, drew streaks along
    // the meridians; so step as many columns as cover about one row's worth of ground.
    const step = Math.min(width >> 2, Math.max(1, Math.round(1 / cl)));
    for (let col = 0; col < width; col++) {
      const lon = (-180 + (col + 0.5) * 360 / width) * RAD;
      const cn = Math.cos(lon), sn = Math.sin(lon);
      const east = (globe.cell(row, col + step) - globe.cell(row, col - step)) / (2 * step * cellM * cl) * relief;
      const north = (globe.cell(row - 1, col) - globe.cell(row + 1, col)) / (rowsApart * cellM) * relief;
      // up - slope east * east - slope north * north, with the three unit vectors written out.
      const x = cl * sn - east * cn + north * sl * sn;
      const y = -sl + north * cl;
      const z = -cl * cn - east * sn - north * sl * cn;
      const n = Math.hypot(x, y, z), o = (row * width + col) * 4;
      out[o] = Math.round((x / n * 0.5 + 0.5) * 255);
      out[o + 1] = Math.round((y / n * 0.5 + 0.5) * 255);
      out[o + 2] = Math.round((z / n * 0.5 + 0.5) * 255);
      out[o + 3] = 255;
    }
  }
  return out;
}

export function colorTexture(globe: GlobeHeights, low: Color, high: Color, range: number[]): DataTexture {
  return texture(globeColors(globe, low, high, range), globe.meta.width, globe.meta.height, true);
}

export function normalTexture(globe: GlobeHeights): DataTexture {
  return texture(globeNormals(globe), globe.meta.width, globe.meta.height, false);
}
