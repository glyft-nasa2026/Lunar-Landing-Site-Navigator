import { describe, expect, it } from 'vitest';
import { Color, Vector3 } from 'three';
import type { DemMeta } from '../core/dem';
import { moonCentre, sitePosition, sphereSite } from './coordinates';
import { globeColors, globeNormals, globeSlopes, mapGlobeUv, parseGlobe, parseNorth, uvSite, type GlobeMeta } from './globe';
import { globeGeometry, northGeometry } from './terrain';

const meta: GlobeMeta = { width: 72, height: 36, height_scale: 0.5, source: 'test' };

/** A grid from a height function of the cell centre's latitude and longitude, in metres. */
function grid(heightM: (lat: number, lon: number) => number, m = meta) {
  const view = new DataView(new ArrayBuffer(m.width * m.height * 2));
  for (let row = 0; row < m.height; row++) {
    for (let col = 0; col < m.width; col++) {
      const lat = 90 - (row + 0.5) * 180 / m.height, lon = -180 + (col + 0.5) * 360 / m.width;
      view.setInt16((row * m.width + col) * 2, Math.round(heightM(lat, lon) / m.height_scale), true);
    }
  }
  return parseGlobe(m, view.buffer);
}

describe('whole-Moon height grid', () => {
  it('reads cells by latitude and longitude: row 0 at 90 N, column 0 at 180 W', () => {
    const g = grid((lat, lon) => lat * 10 + lon);
    expect(g.heightAt(87.5, -177.5)).toBe(875 - 177.5);
    expect(g.heightAt(-87.5, 177.5)).toBe(-875 + 177.5);
    expect(g.heightAt(2.5, 22.5)).toBe(25 + 22.5);
    expect(g.cell(0, 0)).toBe(875 - 177.5);
    expect(g.range).toEqual([-875 - 177.5, 875 + 177.5]);
  });

  it('wraps longitude and stops at the poles', () => {
    const g = grid((lat, lon) => lat * 10 + lon);
    expect(g.cell(5, -1)).toBe(g.cell(5, meta.width - 1));
    expect(g.cell(5, meta.width)).toBe(g.cell(5, 0));
    expect(g.cell(-3, 4)).toBe(g.cell(0, 4));
    expect(g.cell(meta.height + 2, 4)).toBe(g.cell(meta.height - 1, 4));
    expect(g.heightAt(90, 0)).toBe(g.cell(0, meta.width / 2));
    expect(g.heightAt(-90, 180)).toBe(g.cell(meta.height - 1, 0));
  });

  it('rejects a grid the files cannot hold', () => {
    expect(() => parseGlobe(meta, new ArrayBuffer(10))).toThrow(/globe\.bin/);
    expect(() => parseGlobe({ ...meta, width: 1.5 }, new ArrayBuffer(4000))).toThrow(/globe\.json/);
  });
});

describe('globe textures', () => {
  const demMeta: DemMeta = {
    size: 634, pixel_m: 960, x_min_m: -304320, y_max_m: 304320, height_scale: 0.5, nodata: -32768,
    min_lat: -80, source: 'mock',
  };

  it.each([['whole sphere', null], ['south cap left open', demMeta]])(
    'puts each vertex of the globe on its own latitude and longitude (%s)', (_name, dem) => {
      const geometry = globeGeometry(dem);
      const position = geometry.getAttribute('position'), uv = geometry.getAttribute('uv');
      const point = new Vector3();
      let checked = 0;
      for (let i = 0; i < uv.count; i += 7) {
        const real = sphereSite(point.fromBufferAttribute(position, i).add(moonCentre()));
        const mapped = uvSite(uv.getX(i), uv.getY(i));
        expect(mapped.lat).toBeCloseTo(real.lat, 3);
        // Longitude means nothing at a pole, and 180 and -180 are the same meridian.
        if (Math.abs(real.lat) > 89.9) continue;
        const dLon = Math.abs(((mapped.lon - real.lon + 540) % 360) - 180);
        expect(dLon).toBeLessThan(1e-3);
        checked++;
      }
      expect(checked).toBeGreaterThan(1000);
    });

  it('keeps texture coordinates continuous across each triangle, so no seam is drawn', () => {
    const geometry = globeGeometry(null);
    const uv = geometry.getAttribute('uv'), index = geometry.getIndex()!;
    for (let i = 0; i < index.count; i += 3) {
      const us = [0, 1, 2].map((k) => uv.getX(index.getX(i + k)));
      expect(Math.max(...us) - Math.min(...us)).toBeLessThan(0.02);
    }
  });

  it('re-maps only once per geometry call and leaves positions alone', () => {
    const geometry = globeGeometry(null);
    const before = Array.from(geometry.getAttribute('uv').array);
    const copy = geometry.clone(); mapGlobeUv(copy);
    // A second pass would mirror u again: the function is applied once, inside globeGeometry.
    expect(Array.from(copy.getAttribute('uv').array)).not.toEqual(before);
    expect(Array.from(copy.getAttribute('position').array)).toEqual(Array.from(geometry.getAttribute('position').array));
  });

  it('colours by height between the two ends of the ramp, clamped to the range', () => {
    const g = grid((lat) => lat > 0 ? 4000 : lat > -45 ? 0 : -4000);
    const black = new Color(0, 0, 0), white = new Color(1, 1, 1);
    const px = globeColors(g, black, white, [-1000, 1000]);
    const at = (row: number) => Array.from(px.slice(row * meta.width * 4, row * meta.width * 4 + 4));
    expect(at(0)).toEqual([255, 255, 255, 255]);                 // above the range: the high end
    expect(at(meta.height - 1)).toEqual([0, 0, 0, 255]);          // below it: the low end
    const mid = at(meta.height / 2 + 1);                          // 0 m: half way, stored as sRGB
    expect(mid[0]).toBe(Math.round(new Color(0.5, 0.5, 0.5).convertLinearToSRGB().r * 255));
    expect(mid[0]).toBe(mid[1]); expect(mid[1]).toBe(mid[2]);
  });

  const normalAt = (px: Uint8Array, m: GlobeMeta, row: number, col: number): Vector3 => {
    const o = (row * m.width + col) * 4;
    return new Vector3(px[o], px[o + 1], px[o + 2]).divideScalar(255).multiplyScalar(2).subScalar(1);
  };

  it('gives flat ground the outward normal of its place, in the render frame', () => {
    const px = globeNormals(grid(() => 250));
    for (const [row, col] of [[0, 0], [17, 36], [18, 3], [30, 60], [35, 71]]) {
      const site = { lat: 90 - (row + 0.5) * 5, lon: -180 + (col + 0.5) * 5 };
      const up = sitePosition(site).sub(moonCentre()).normalize();
      expect(normalAt(px, meta, row, col).distanceTo(up)).toBeLessThan(0.02);
    }
  });

  it('tilts the normal away from rising ground, east and north', () => {
    const fine: GlobeMeta = { width: 360, height: 180, height_scale: 0.5, source: 'test' };
    const row = 90, col = 200;                                    // just south of the equator, 20.5 E
    const site = { lat: -0.5, lon: 20.5 };
    const up = sitePosition(site).sub(moonCentre()).normalize();
    const east = sitePosition({ lat: site.lat, lon: site.lon + 0.01 }).sub(sitePosition(site)).normalize();
    const north = sitePosition({ lat: site.lat + 0.01, lon: site.lon }).sub(sitePosition(site)).normalize();

    const risesEast = normalAt(globeNormals(grid((_lat, lon) => lon * 3000, fine), 1), fine, row, col);
    expect(risesEast.dot(east)).toBeLessThan(-0.05);
    expect(Math.abs(risesEast.dot(north))).toBeLessThan(0.01);
    expect(risesEast.dot(up)).toBeGreaterThan(0.98);

    const risesNorth = normalAt(globeNormals(grid((lat) => lat * 3000, fine), 1), fine, row, col);
    expect(risesNorth.dot(north)).toBeLessThan(-0.05);
    expect(Math.abs(risesNorth.dot(east))).toBeLessThan(0.01);

    // 3,000 m a degree is a slope of 0.099; a sixth of that drawn 6 times steeper leans as far.
    expect(risesEast.dot(east)).toBeCloseTo(-Math.sin(Math.atan(3000 / (Math.PI * 1737400 / 180))), 2);
    const drawn = normalAt(globeNormals(grid((_lat, lon) => lon * 500, fine), 6), fine, row, col);
    expect(drawn.dot(east)).toBeCloseTo(risesEast.dot(east), 2);
  });
});

describe('north cap', () => {
  const R_M = 1737400;
  const northMeta: DemMeta = {
    size: 129, pixel_m: 4800, x_min_m: -307200, y_max_m: 307200, height_scale: 0.5, nodata: -32768,
    min_lat: 80, source: 'test',
  };
  /** A north grid from a height function of latitude and longitude: x = r sin lon, y = r cos lon. */
  function northGrid(heightM: (lat: number, lon: number) => number) {
    const view = new DataView(new ArrayBuffer(northMeta.size * northMeta.size * 2));
    for (let row = 0; row < northMeta.size; row++) {
      for (let col = 0; col < northMeta.size; col++) {
        const x = northMeta.x_min_m + col * northMeta.pixel_m, y = northMeta.y_max_m - row * northMeta.pixel_m;
        const lat = 90 - 2 * Math.atan(Math.hypot(x, y) / (2 * R_M)) * 180 / Math.PI;
        const lon = Math.atan2(x, y) * 180 / Math.PI;
        view.setInt16((row * northMeta.size + col) * 2, Math.round(heightM(lat, lon) / 0.5), true);
      }
    }
    return parseNorth(northMeta, view.buffer);
  }
  const low = new Color(0, 0, 0), high = new Color(1, 1, 1);

  it('reads the north grid through mirrored latitudes', () => {
    const north = northGrid((lat, lon) => (lat - 80) * 100 + (lon > 0 ? 1000 : 0));
    expect(north.covers(-85, 40)).toBe(true);
    expect(north.covers(-79, 40)).toBe(false);
    expect(north.covers(85, 40)).toBe(false);
    expect(north.heightAt(-85, 90)).toBeCloseTo(1500, -1);
    expect(north.heightAt(-85, -90)).toBeCloseTo(500, -1);
    expect(() => parseNorth({ ...northMeta, min_lat: -80 }, new ArrayBuffer(0))).toThrow(/north\.json/);
  });

  it('puts the mesh at the north pole, each vertex at its own longitude and height', () => {
    const north = northGrid((_lat, lon) => (lon > 0 ? 2000 : -1000));
    const geometry = northGeometry(north, low, high, 1);
    const position = geometry.getAttribute('position'), heights = geometry.getAttribute('height');
    const { valid } = geometry.userData.layout as { valid: Uint8Array };
    const point = new Vector3();
    let east = 0, west = 0;
    for (let i = 0; i < position.count; i++) {
      if (!valid[i]) continue;
      point.fromBufferAttribute(position, i);
      const site = sphereSite(point);
      expect(site.lat).toBeGreaterThan(79.9);
      const radiusM = point.sub(moonCentre()).length() * 1000 - R_M;
      expect(Math.abs(radiusM - heights.getX(i))).toBeLessThan(1);
      if (Math.abs(site.lon) < 3 || Math.abs(site.lon) > 177 || site.lat > 89.5) continue;
      if (site.lon > 0) { expect(heights.getX(i)).toBe(2000); east++; }
      else { expect(heights.getX(i)).toBe(-1000); west++; }
    }
    expect(east).toBeGreaterThan(1000); expect(west).toBeGreaterThan(1000);
  });

  it('faces every triangle and normal outward after the reflection', () => {
    const geometry = northGeometry(northGrid(() => 0), low, high);
    const position = geometry.getAttribute('position'), normal = geometry.getAttribute('normal');
    const index = geometry.getIndex()!;
    const a = new Vector3(), b = new Vector3(), c = new Vector3(), n = new Vector3();
    expect(geometry.drawRange.count).toBeGreaterThan(10_000);
    for (let i = 0; i < geometry.drawRange.count; i += 3) {
      a.fromBufferAttribute(position, index.getX(i));
      b.fromBufferAttribute(position, index.getX(i + 1));
      c.fromBufferAttribute(position, index.getX(i + 2));
      const face = b.clone().sub(a).cross(c.clone().sub(a));
      const up = a.clone().sub(moonCentre()).normalize();
      expect(face.dot(up)).toBeGreaterThan(0);
      expect(n.fromBufferAttribute(normal, index.getX(i)).dot(up)).toBeGreaterThan(0.99);
    }
  });

  it('lights slopes steeper than they are without moving the ground', () => {
    const north = northGrid((_lat, lon) => 500 * Math.sin(lon * Math.PI / 30));
    const real = northGeometry(north, low, high, 1), drawn = northGeometry(north, low, high, 4);
    expect(Array.from(drawn.getAttribute('position').array)).toEqual(Array.from(real.getAttribute('position').array));
    const position = real.getAttribute('position'), up = new Vector3(), n = new Vector3();
    let leanReal = 0, leanDrawn = 0;
    for (let i = 0; i < position.count; i += 50) {
      // A corner beyond 80 N belongs to no triangle and has no normal.
      if (n.fromBufferAttribute(real.getAttribute('normal'), i).lengthSq() < 0.5) continue;
      up.fromBufferAttribute(position, i).sub(moonCentre()).normalize();
      leanReal += 1 - n.fromBufferAttribute(real.getAttribute('normal'), i).dot(up);
      leanDrawn += 1 - n.fromBufferAttribute(drawn.getAttribute('normal'), i).dot(up);
    }
    expect(leanDrawn).toBeGreaterThan(leanReal * 1.5);
  });

  it('opens the globe under the cap, by less than the cap covers', () => {
    const globe = globeGeometry(null, northMeta);
    const position = globe.getAttribute('position'), point = new Vector3();
    let north = -90, south = 90;
    for (let i = 0; i < position.count; i++) {
      const lat = sphereSite(point.fromBufferAttribute(position, i).add(moonCentre())).lat;
      north = Math.max(north, lat); south = Math.min(south, lat);
    }
    expect(north).toBeGreaterThan(80);       // the globe runs on under the cap's edge: no gap
    expect(north).toBeLessThan(81);          // and stops soon after: the cap is not buried
    expect(south).toBeCloseTo(-90, 3);       // the other pole is closed without a south height map
  });
});

describe('slopes for the flat map', () => {
  it('flat ground points straight up, in the Moon frame core/ uses', () => {
    const slopes = globeSlopes(grid(() => 100));
    const at = (lat: number, lon: number) => {
      const o = (Math.floor((90 - lat) * meta.height / 180) * meta.width + Math.floor((lon + 180) * meta.width / 360)) * 3;
      return [slopes[o] / 127, slopes[o + 1] / 127, slopes[o + 2] / 127];
    };
    const RAD = Math.PI / 180;
    for (const [lat, lon] of [[2.5, 2.5], [2.5, 92.5], [-47.5, -137.5], [87.5, 177.5]]) {
      const [x, y, z] = at(lat, lon);
      // +X toward longitude 0, +Y toward 90 E, +Z north.
      expect(x).toBeCloseTo(Math.cos(lat * RAD) * Math.cos(lon * RAD), 1);
      expect(y).toBeCloseTo(Math.cos(lat * RAD) * Math.sin(lon * RAD), 1);
      expect(z).toBeCloseTo(Math.sin(lat * RAD), 1);
    }
  });

  it('ground rising to the east leans west, and rising to the north leans south', () => {
    const flat = globeSlopes(grid(() => 0));
    const o = ((meta.height / 2) * meta.width + meta.width / 2) * 3;   // the cell at 2.5 S, 2.5 E
    const east = globeSlopes(grid((_lat, lon) => lon * 2000));
    expect(east[o + 1]).toBeLessThan(flat[o + 1] - 20);                 // +Y is east there
    const north = globeSlopes(grid((lat) => lat * 2000));
    expect(north[o + 2]).toBeLessThan(flat[o + 2] - 20);
  });
});
