import { describe, expect, it } from 'vitest';
import { Color, Mesh, MeshBasicMaterial, Raycaster, Vector3 } from 'three';
import { parseDem, projectToGrid, type DemMeta } from '../core/dem';
import { MOON_RADIUS_KM } from '../core/types';
import { gridSite, moonDirection, sitePosition, sphereSite } from './coordinates';
import { detailBounds, terrainGeometry } from './terrain';

const meta: DemMeta = {
  size: 65, pixel_m: 2000, x_min_m: -64_000, y_max_m: 64_000,
  height_scale: 1, nodata: -32768, min_lat: -80, source: 'mock',
};
const crater = { lat: -88, lon: 45 };
const dem = parseDem(meta, new Int16Array(meta.size ** 2).buffer);
const low = new Color('gray'), high = new Color('white');

describe('scene coordinates and picking', () => {
  it('round-trips the contract projection, including west longitudes and the pole', () => {
    for (const site of [crater, { lat: -87, lon: -120 }, { lat: -90, lon: 0 }]) {
      const p = projectToGrid(meta, site.lat, site.lon);
      const out = gridSite(meta, p.col, p.row);
      expect(out.lat).toBeCloseTo(site.lat, 10);
      if (site.lat !== -90) expect(out.lon).toBeCloseTo(site.lon, 10);
      expect(out.lon).toBeGreaterThanOrEqual(-180);
      expect(out.lon).toBeLessThanOrEqual(180);
    }
  });

  it('preserves the right-handed Moon frame and puts south pole up', () => {
    const x = moonDirection([1, 0, 0]), y = moonDirection([0, 1, 0]);
    expect(x.clone().cross(y).equals(moonDirection([0, 0, 1]))).toBe(true);
    expect(moonDirection([0, 0, -1]).toArray()).toEqual([0, 1, -0]);
    expect(sitePosition({ lat: -90, lon: 0 }).length()).toBeLessThan(1e-10);
  });

  it('raycasts to the crater and recovers its grid location within one cell', () => {
    const geometry = terrainGeometry(dem, low, high);
    const material = new MeshBasicMaterial();
    const mesh = new Mesh(geometry, material);
    const at = sitePosition(crater);
    const ray = new Raycaster(at.clone().add(new Vector3(0, 100, 0)), new Vector3(0, -1, 0));
    const hit = ray.intersectObject(mesh)[0];
    expect(hit?.uv).toBeDefined();
    const picked = gridSite(meta, hit.uv!.x * (meta.size - 1), hit.uv!.y * (meta.size - 1));
    const a = projectToGrid(meta, crater.lat, crater.lon);
    const b = projectToGrid(meta, picked.lat, picked.lon);
    expect(Math.hypot(a.col - b.col, a.row - b.row)).toBeLessThan(1);
    // The surface winding must face outwards for rendering and front-face raycasting.
    expect(hit.face!.normal.y).toBeGreaterThan(0.9);
    geometry.dispose(); material.dispose();
  });

  it('uses a radial height stretch and round-trips globe picks, including Apollo latitudes', () => {
    for (const site of [crater, { lat: 0.674, lon: 23.473 }, { lat: 80, lon: -170 }]) {
      const point = sitePosition(site, 1000, 5);
      const result = sphereSite(point);
      expect(result.lat).toBeCloseTo(site.lat, 9);
      expect(result.lon).toBeCloseTo(site.lon, 9);
      expect(point.clone().add(new Vector3(0, MOON_RADIUS_KM, 0)).length()).toBeCloseTo(MOON_RADIUS_KM + 5);
    }
  });

  it('caps the coarse grid and keeps a native patch inside changed DEM sizes', () => {
    const largeMeta = { ...meta, size: 634, pixel_m: 960, x_min_m: -304320, y_max_m: 304320 };
    const large = parseDem(largeMeta, new Int16Array(largeMeta.size ** 2).buffer);
    const geometry = terrainGeometry(large, low, high);
    expect(geometry.getAttribute('position').count).toBe(512 ** 2);
    const b = detailBounds(large, crater);
    expect(b.col0).toBeGreaterThanOrEqual(0);
    expect(b.row1).toBeLessThan(largeMeta.size);
    const patch = terrainGeometry(large, low, high, 1, b);
    expect(patch.getAttribute('position').count).toBe((b.col1 - b.col0 + 1) * (b.row1 - b.row0 + 1));
    geometry.dispose(); patch.dispose();
  });
});
