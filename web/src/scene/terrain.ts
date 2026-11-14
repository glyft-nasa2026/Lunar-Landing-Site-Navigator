import { BufferGeometry, Color, Float32BufferAttribute } from 'three';
import { projectToGrid, type Dem } from '../core/dem';
import type { Site } from '../core/types';
import { gridSite, sitePosition } from './coordinates';

export type GridBounds = { col0: number; col1: number; row0: number; row1: number };

/** Native cells near the selected site, capped to keep edits and scrubbing responsive. */
export function detailBounds(dem: Dem, site: Site): GridBounds {
  const { col, row } = projectToGrid(dem.meta, site.lat, site.lon);
  const half = Math.min(64, Math.max(2, Math.ceil(20_000 / dem.meta.pixel_m)));
  const last = dem.meta.size - 1;
  const c = Math.max(0, Math.min(last, Math.round(col)));
  const r = Math.max(0, Math.min(last, Math.round(row)));
  return {
    col0: Math.max(0, c - half), col1: Math.min(last, c + half),
    row0: Math.max(0, r - half), row1: Math.min(last, r + half),
  };
}

/** A curved, indexed mesh. UVs map back to the full DEM, including for the detail patch.
 * Height, size, spacing and coverage all come from the loader, never a dataset-specific constant.
 */
export function terrainGeometry(
  dem: Dem, low: Color, high: Color, stretch = 1, bounds?: GridBounds,
): BufferGeometry {
  const last = dem.meta.size - 1;
  const b = bounds ?? { col0: 0, col1: last, row0: 0, row1: last };
  const cols = bounds ? b.col1 - b.col0 + 1 : Math.min(dem.meta.size, 512);
  const rows = bounds ? b.row1 - b.row0 + 1 : Math.min(dem.meta.size, 512);
  const count = cols * rows;
  const positions = new Float32Array(count * 3);
  const uvs = new Float32Array(count * 2);
  const heights = new Float32Array(count);
  const valid = new Uint8Array(count);
  let min = Infinity, max = -Infinity;
  for (let row = 0; row < rows; row++) {
    for (let col = 0; col < cols; col++) {
      const i = row * cols + col;
      const c = b.col0 + col * (b.col1 - b.col0) / (cols - 1);
      const r = b.row0 + row * (b.row1 - b.row0) / (rows - 1);
      const site = gridSite(dem.meta, c, r);
      valid[i] = dem.covers(site.lat, site.lon) ? 1 : 0;
      const height = valid[i] ? dem.heightAt(site.lat, site.lon) : 0;
      heights[i] = height;
      if (valid[i]) { min = Math.min(min, height); max = Math.max(max, height); }
      sitePosition(site, height, stretch).toArray(positions, i * 3);
      uvs[i * 2] = c / last;
      uvs[i * 2 + 1] = r / last;
    }
  }
  const colors = new Float32Array(count * 3);
  const color = new Color();
  // A fixed physical height ramp gives the coarse grid and the native patch the same colours.
  // Bounds are sampled on the whole grid when needed by the caller through recolorTerrain().
  const range = Math.max(1, max - min);
  for (let i = 0; i < count; i++) {
    color.copy(low).lerp(high, Math.max(0, Math.min(1, (heights[i] - min) / range)));
    color.toArray(colors, i * 3);
  }
  const indices: number[] = [];
  for (let row = 0; row < rows - 1; row++) {
    for (let col = 0; col < cols - 1; col++) {
      const a = row * cols + col, b = a + 1, c = a + cols, d = c + 1;
      if (valid[a] && valid[b] && valid[c]) indices.push(a, c, b);
      if (valid[b] && valid[c] && valid[d]) indices.push(b, c, d);
    }
  }
  const geometry = new BufferGeometry();
  geometry.setAttribute('position', new Float32BufferAttribute(positions, 3));
  geometry.setAttribute('uv', new Float32BufferAttribute(uvs, 2));
  geometry.setAttribute('color', new Float32BufferAttribute(colors, 3));
  geometry.setAttribute('height', new Float32BufferAttribute(heights, 1));
  geometry.setIndex(indices);
  geometry.computeVertexNormals();
  geometry.computeBoundingSphere();
  geometry.userData.heightRange = [min, max];
  return geometry;
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
