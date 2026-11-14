import { describe, expect, it } from 'vitest';
import { Color, Mesh, MeshBasicMaterial, Raycaster, Vector3 } from 'three';
import { parseDem, projectToGrid, type DemMeta } from '../core/dem';
import { MOON_RADIUS_KM } from '../core/types';
import { gridSite, moonCentre, moonDirection, siteNorth, sitePosition, siteUp, sphereSite } from './coordinates';
import { detailBounds, globeGeometry, setTerrainHole, terrainGeometry } from './terrain';

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
    expect(geometry.getAttribute('position').count).toBeLessThanOrEqual(512 ** 2);
    const b = detailBounds(large, crater);
    expect(b.col0).toBeGreaterThanOrEqual(0);
    expect(b.row1).toBeLessThan(largeMeta.size);
    const patch = terrainGeometry(large, low, high, 1, b);
    expect(patch.getAttribute('position').count).toBe((b.col1 - b.col0 + 1) * (b.row1 - b.row0 + 1));
    geometry.dispose(); patch.dispose();
  });

  it('cuts a hole under the native patch and stitches its boundary to the coarse edges', () => {
    const m = { ...meta, size: 634, pixel_m: 960, x_min_m: -304320, y_max_m: 304320 };
    const data = new Int16Array(m.size ** 2);
    // Sloping heights make a seam error visible instead of testing a coincident flat surface.
    for (let row = 0; row < m.size; row++) for (let col = 0; col < m.size; col++) data[row * m.size + col] = col + row;
    const terrain = parseDem(m, data.buffer);
    const bounds = detailBounds(terrain, crater);
    const coarse = terrainGeometry(terrain, low, high, 3, undefined, bounds);
    const patch = terrainGeometry(terrain, low, high, 3, bounds);
    const material = new MeshBasicMaterial();
    const at = sitePosition(crater);
    const ray = new Raycaster(at.clone().add(new Vector3(0, 100, 0)), new Vector3(0, -1, 0));
    expect(ray.intersectObject(new Mesh(coarse, material))).toHaveLength(0);
    expect(ray.intersectObject(new Mesh(patch, material))).toHaveLength(1);
    const positions = patch.getAttribute('position');
    // The first intermediate native point on the top edge lies exactly halfway between
    // the two surrounding coarse vertices (stride 2 for this grid).
    const first = new Vector3().fromBufferAttribute(positions, 0);
    const second = new Vector3().fromBufferAttribute(positions, 2);
    const middle = new Vector3().fromBufferAttribute(positions, 1);
    expect(middle.distanceTo(first.add(second).multiplyScalar(0.5))).toBeLessThan(1e-5);
    coarse.dispose(); patch.dispose(); material.dispose();
  });

  it('gives each site an outward up and a ground-level north', () => {
    expect(siteUp({ lat: -90, lon: 0 }).distanceTo(new Vector3(0, 1, 0))).toBeLessThan(1e-12);
    const up = siteUp({ lat: 0, lon: 0 });
    expect(up.distanceTo(new Vector3(0, 0, -1))).toBeLessThan(1e-12);
    expect(siteNorth(up).distanceTo(new Vector3(0, -1, 0))).toBeLessThan(1e-12);
    // At the south pole north is longitude 0, the map's up direction.
    expect(siteNorth(siteUp({ lat: -90, lon: 0 })).distanceTo(new Vector3(0, 0, -1))).toBeLessThan(1e-12);
    const site = { lat: -45, lon: 120 }, n = siteUp(site), north = siteNorth(n);
    expect(Math.abs(n.dot(north))).toBeLessThan(1e-12);
    // Walking north raises the latitude.
    const ahead = sphereSite(sitePosition(site).addScaledVector(north, 10));
    expect(ahead.lat).toBeGreaterThan(site.lat);
  });

  it('leaves the globe open over the terrain cap with no gap at its edge', () => {
    // A coarse grid that still reaches past 80 S, so the test stays quick.
    const m = { ...meta, size: 160, pixel_m: 3840, x_min_m: -305_280, y_max_m: 305_280 };
    const flat = parseDem(m, new Int16Array(m.size ** 2).buffer);
    const material = new MeshBasicMaterial();
    const globe = new Mesh(globeGeometry(m), material);
    globe.position.copy(moonCentre()); globe.updateMatrixWorld();
    const coarse = new Mesh(terrainGeometry(flat, low, high), material);
    // A ray falling straight down onto a site, from 50 km up.
    const down = (site: { lat: number; lon: number }): Raycaster => {
      const from = sitePosition(site, 50_000);
      return new Raycaster(from, moonCentre().sub(from).normalize());
    };
    expect(down(crater).intersectObject(globe)).toHaveLength(0);
    expect(down({ lat: -79, lon: 10 }).intersectObject(globe)).toHaveLength(1);
    // Every point around the cap's edge hits the globe or the terrain. The longitudes avoid
    // -90 exactly, where a ray runs along the sphere mesh's own seam.
    for (let lon = -179.7; lon < 180; lon += 3) {
      for (const lat of [-80.3, -80.2, -80.1, -80.02, -79.98, -79.9]) {
        const ray = down({ lat, lon });
        const hit = ray.intersectObject(globe).length > 0 || ray.intersectObject(coarse).length > 0;
        expect(hit, `${lat}, ${lon}`).toBe(true);
      }
    }
    expect(globeGeometry(null).parameters.thetaStart).toBe(0);
    globe.geometry.dispose(); coarse.geometry.dispose(); material.dispose();
  }, 20_000);

  it('moves the hole without rebuilding the vertices', () => {
    const m = { ...meta, size: 634, pixel_m: 960, x_min_m: -304320, y_max_m: 304320 };
    const flat = parseDem(m, new Int16Array(m.size ** 2).buffer);
    const geometry = terrainGeometry(flat, low, high);
    const material = new MeshBasicMaterial();
    const mesh = new Mesh(geometry, material);
    const at = sitePosition(crater);
    const ray = new Raycaster(at.clone().add(new Vector3(0, 100, 0)), new Vector3(0, -1, 0));
    const positions = geometry.getAttribute('position');
    expect(ray.intersectObject(mesh)).toHaveLength(1);
    setTerrainHole(geometry, detailBounds(flat, crater));
    expect(ray.intersectObject(mesh)).toHaveLength(0);
    setTerrainHole(geometry, detailBounds(flat, { lat: -87, lon: -120 }));
    expect(ray.intersectObject(mesh)).toHaveLength(1);
    setTerrainHole(geometry);
    expect(ray.intersectObject(mesh)).toHaveLength(1);
    expect(geometry.getAttribute('position')).toBe(positions);
    geometry.dispose(); material.dispose();
  });
});
