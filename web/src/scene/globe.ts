// The two textures the 3D globe wears, from the whole-Moon height grid (globeHeights.ts):
// height colours, and surface normals so the Sun's light shows the relief.
// Illustration only: no number shown to the user comes from here.

import {
  Color, DataTexture, LinearFilter, LinearMipmapLinearFilter, NoColorSpace, RepeatWrapping,
  RGBAFormat, SRGBColorSpace, UnsignedByteType, type BufferGeometry,
} from 'three';
import { parseDem, type Dem, type DemMeta } from '../core/dem';
import { MOON_RADIUS_KM } from '../core/types';
import { GLOBE_RELIEF, globeNormalAt, type GlobeHeights } from './globeHeights';

export * from './globeHeights';

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

/** RGBA bytes: every cell's globeNormalAt, stored as n * 0.5 + 0.5. */
export function globeNormals(globe: GlobeHeights, relief = GLOBE_RELIEF): Uint8Array {
  const { width, height } = globe.meta;
  const out = new Uint8Array(width * height * 4), n = [0, 0, 0];
  for (let row = 0; row < height; row++) {
    for (let col = 0; col < width; col++) {
      globeNormalAt(globe, row, col, relief, n);
      const o = (row * width + col) * 4;
      out[o] = Math.round((n[0] * 0.5 + 0.5) * 255);
      out[o + 1] = Math.round((n[1] * 0.5 + 0.5) * 255);
      out[o + 2] = Math.round((n[2] * 0.5 + 0.5) * 255);
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
