import { BufferAttribute, BufferGeometry, Color, Float32BufferAttribute, SphereGeometry, Vector3 } from 'three';
import { projectToGrid, type Dem, type DemMeta } from '../core/dem';
import { MOON_RADIUS_KM, type Site } from '../core/types';
import { gridSite, sitePosition, sphereSite } from './coordinates';
import { mapGlobeUv } from './globe';

export type GridBounds = { col0: number; col1: number; row0: number; row1: number };
/** Which grid points a mesh's vertices sit on, kept so its triangles can be rebuilt. */
type Layout = { b: GridBounds; stride: number; cols: number; rows: number; valid: Uint8Array };

const RAD = Math.PI / 180;

/** Grid step of the whole-region mesh: at most 512 points a side, whatever the DEM's size. */
export function coarseStride(meta: DemMeta): number {
  return Math.ceil((meta.size - 1) / 511);
}

/** Native cells near the selected site, capped to keep edits and scrubbing responsive. */
export function detailBounds(dem: Dem, site: Site): GridBounds {
  const { col, row } = projectToGrid(dem.meta, site.lat, site.lon);
  const half = Math.min(64, Math.max(2, Math.ceil(20_000 / dem.meta.pixel_m)));
  const last = dem.meta.size - 1;
  const stride = coarseStride(dem.meta);
  const c = Math.max(0, Math.min(last, Math.round(col)));
  const r = Math.max(0, Math.min(last, Math.round(row)));
  return {
    col0: Math.max(0, Math.floor((c - half) / stride) * stride),
    col1: Math.min(last, Math.ceil((c + half) / stride) * stride),
    row0: Math.max(0, Math.floor((r - half) / stride) * stride),
    row1: Math.min(last, Math.ceil((r + half) / stride) * stride),
  };
}

/**
 * The Moon as a sphere centred on the origin (the caller moves it to the Moon's centre).
 * With a height map, the cap the terrain covers (south of `min_lat`, inside the grid) is left
 * open so the terrain isn't buried under the sphere. The opening is two coarse cells smaller
 * than the terrain, so the terrain's stepped edge never leaves a gap; where the two overlap the
 * globe's material is pushed back in depth so the terrain wins.
 * Texture coordinates follow the whole-Moon grid (globe.ts), whatever part of the sphere is built.
 */
export function globeGeometry(meta?: DemMeta | null): SphereGeometry {
  if (!meta) return withGlobeUv(new SphereGeometry(MOON_RADIUS_KM, 128, 96));
  const rM = MOON_RADIUS_KM * 1000;
  const last = meta.size - 1;
  // Distance from the pole to the nearest grid edge, so a grid smaller than min_lat still has no gap.
  const half = Math.min(-meta.x_min_m, meta.x_min_m + last * meta.pixel_m,
    meta.y_max_m, last * meta.pixel_m - meta.y_max_m);
  const gridColat = 2 * Math.atan(Math.max(0, half) / (2 * rM));
  const overlap = 2 * coarseStride(meta) * meta.pixel_m / rM;
  const cap = Math.max(0, Math.min((90 + meta.min_lat) * RAD, gridColat) - overlap);
  // Render frame +Y is south, and SphereGeometry measures theta from +Y.
  return withGlobeUv(new SphereGeometry(MOON_RADIUS_KM, 128, 96, 0, Math.PI * 2, cap, Math.PI - cap));
}

function withGlobeUv(geometry: SphereGeometry): SphereGeometry {
  mapGlobeUv(geometry);
  return geometry;
}

/** Writes the triangles whose three corners have data, leaving out the quads inside `hole`. */
function fillIndex(geometry: BufferGeometry, hole?: GridBounds): void {
  const { b, stride, cols, rows, valid } = geometry.userData.layout as Layout;
  const index = geometry.getIndex()!;
  const out = index.array as Uint32Array;
  let n = 0;
  for (let row = 0; row < rows - 1; row++) {
    const r0 = b.row0 + row * stride;
    const rowInHole = !!hole && r0 >= hole.row0 && Math.min(b.row1, r0 + stride) <= hole.row1;
    for (let col = 0; col < cols - 1; col++) {
      if (rowInHole && hole) {
        const c0 = b.col0 + col * stride;
        if (c0 >= hole.col0 && Math.min(b.col1, c0 + stride) <= hole.col1) continue;
      }
      const a = row * cols + col, next = a + 1, c = a + cols, d = c + 1;
      if (valid[a] && valid[next] && valid[c]) { out[n++] = a; out[n++] = c; out[n++] = next; }
      if (valid[next] && valid[c] && valid[d]) { out[n++] = next; out[n++] = c; out[n++] = d; }
    }
  }
  out.fill(0, n);
  geometry.setDrawRange(0, n);
  index.needsUpdate = true;
}

/**
 * Moves the coarse mesh's hole to sit under a new detail patch, or closes it (no `hole`).
 * Only the triangle list changes; the vertices stay, so a new site doesn't rebuild the region.
 */
export function setTerrainHole(geometry: BufferGeometry, hole?: GridBounds): void {
  fillIndex(geometry, hole);
}

/** A curved, indexed mesh. UVs map back to the full DEM, including for the detail patch.
 * Height, size, spacing and coverage all come from the loader, never a dataset-specific constant.
 */
export function terrainGeometry(
  dem: Dem, low: Color, high: Color, stretch = 1, bounds?: GridBounds, hole?: GridBounds,
): BufferGeometry {
  const last = dem.meta.size - 1;
  const b = bounds ?? { col0: 0, col1: last, row0: 0, row1: last };
  const coarse = coarseStride(dem.meta);
  const stride = bounds ? 1 : coarse;
  const cols = Math.ceil((b.col1 - b.col0) / stride) + 1;
  const rows = Math.ceil((b.row1 - b.row0) / stride) + 1;
  const count = cols * rows;
  const positions = new Float32Array(count * 3);
  const uvs = new Float32Array(count * 2);
  const heights = new Float32Array(count);
  const valid = new Uint8Array(count);
  let min = Infinity, max = -Infinity;
  for (let row = 0; row < rows; row++) {
    for (let col = 0; col < cols; col++) {
      const i = row * cols + col;
      const c = Math.min(b.col1, b.col0 + col * stride);
      const r = Math.min(b.row1, b.row0 + row * stride);
      const site = gridSite(dem.meta, c, r);
      valid[i] = dem.covers(site.lat, site.lon) ? 1 : 0;
      const height = valid[i] ? dem.heightAt(site.lat, site.lon) : 0;
      heights[i] = height;
      if (valid[i]) { min = Math.min(min, height); max = Math.max(max, height); }
      sitePosition(site, height, stretch).toArray(positions, i * 3);
      // Stitch the native patch to the coarse edges: their intermediate positions must lie
      // on the same straight edges, rather than leave narrow cracks between curved samples.
      if (bounds && (col === 0 || col === cols - 1 || row === 0 || row === rows - 1)) {
        const alongRow = row === 0 || row === rows - 1;
        const v = alongRow ? c : r;
        const lo = Math.floor(v / coarse) * coarse;
        const hi = Math.min(last, lo + coarse);
        if (hi > lo) {
          const a = gridSite(dem.meta, alongRow ? lo : c, alongRow ? r : lo);
          const z = gridSite(dem.meta, alongRow ? hi : c, alongRow ? r : hi);
          sitePosition(a, dem.heightAt(a.lat, a.lon), stretch)
            .lerp(sitePosition(z, dem.heightAt(z.lat, z.lon), stretch), (v - lo) / (hi - lo))
            .toArray(positions, i * 3);
        }
      }
      uvs[i * 2] = c / last;
      uvs[i * 2 + 1] = r / last;
    }
  }
  const colors = new Float32Array(count * 3);
  const color = new Color();
  // The caller reuses the whole-grid range for a detail patch through recolorTerrain().
  const range = Math.max(1, max - min);
  for (let i = 0; i < count; i++) {
    color.copy(low).lerp(high, Math.max(0, Math.min(1, (heights[i] - min) / range)));
    color.toArray(colors, i * 3);
  }
  const geometry = new BufferGeometry();
  geometry.setAttribute('position', new Float32BufferAttribute(positions, 3));
  geometry.setAttribute('uv', new Float32BufferAttribute(uvs, 2));
  geometry.setAttribute('color', new Float32BufferAttribute(colors, 3));
  geometry.setAttribute('height', new Float32BufferAttribute(heights, 1));
  geometry.userData.layout = { b, stride, cols, rows, valid } satisfies Layout;
  geometry.setIndex(new BufferAttribute(new Uint32Array(Math.max(0, (cols - 1) * (rows - 1) * 6)), 1));
  // Normals come from the whole mesh, so they stay smooth along the edge of a hole.
  fillIndex(geometry);
  geometry.computeVertexNormals();
  if (hole) fillIndex(geometry, hole);
  geometry.computeBoundingSphere();
  geometry.userData.heightRange = Number.isFinite(min) ? [min, max] : [0, 1];
  return geometry;
}

/**
 * Mean height, in metres, of the terrain within `band` degrees of its northern edge. The plain
 * globe beyond the height map takes this height's colour, so no ring shows where the map stops.
 */
export function edgeHeight(geometry: BufferGeometry, band = 0.5): number {
  const positions = geometry.getAttribute('position'), heights = geometry.getAttribute('height');
  const { valid } = geometry.userData.layout as Layout;
  const lats = new Float32Array(heights.count), point = new Vector3();
  let north = -Infinity;
  for (let i = 0; i < heights.count; i++) {
    if (!valid[i]) continue;
    lats[i] = sphereSite(point.fromBufferAttribute(positions, i)).lat;
    north = Math.max(north, lats[i]);
  }
  let sum = 0, n = 0;
  for (let i = 0; i < heights.count; i++) {
    if (valid[i] && lats[i] >= north - band) { sum += heights.getX(i); n++; }
  }
  return n ? sum / n : 0;
}

/** Reuse the coarse mesh's physical height range so a detail patch has no colour seam. */
export function recolorTerrain(geometry: BufferGeometry, low: Color, high: Color, range: number[]): void {
  const heights = geometry.getAttribute('height');
  const colors = geometry.getAttribute('color');
  const color = new Color();
  const span = Math.max(1, range[1] - range[0]);
  for (let i = 0; i < heights.count; i++) {
    color.copy(low).lerp(high, Math.max(0, Math.min(1, (heights.getX(i) - range[0]) / span)));
    colors.setXYZ(i, color.r, color.g, color.b);
  }
  colors.needsUpdate = true;
}
