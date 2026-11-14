import { describe, expect, it } from 'vitest';
import { Color, Vector3 } from 'three';
import type { DemMeta } from '../core/dem';
import { moonCentre, sitePosition, sphereSite } from './coordinates';
import { globeColors, globeNormals, mapGlobeUv, parseGlobe, uvSite, type GlobeMeta } from './globe';
import { globeGeometry } from './terrain';

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
