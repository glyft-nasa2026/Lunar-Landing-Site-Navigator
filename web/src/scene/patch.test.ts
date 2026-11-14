import { describe, expect, it } from 'vitest';
import { Color, Vector3 } from 'three';
import { moonCentre, sphereSite } from './coordinates';
import { globeNormalAt, globeNormalNear, parseGlobe, type GlobeMeta } from './globe';
import {
  cellSite, parseTile, PATCH_HALF_DEG, patchGeometry, patchWindow, tileFile, tileHeights, windowTiles,
  type TileIndex,
} from './patch';

const index: TileIndex = { cells_per_deg: 32, tile_deg: 15, height_scale: 0.5, source: 'test' };
const small: TileIndex = { cells_per_deg: 4, tile_deg: 15, height_scale: 0.5, source: 'test' };
const low = new Color(0, 0, 0), high = new Color(1, 1, 1);

describe('level-of-detail window', () => {
  it('is centred on the site and as wide on the ground east-west as north-south', () => {
    const equator = patchWindow({ lat: 0.67, lon: 23.47 }, index)!;
    expect(equator.stride).toBe(1);
    expect(equator.row1 - equator.row0).toBe(2 * PATCH_HALF_DEG * 32);
    expect(equator.col1 - equator.col0).toBe(2 * PATCH_HALF_DEG * 32);
    const mid = cellSite(index, (equator.row0 + equator.row1) / 2, (equator.col0 + equator.col1) / 2);
    expect(Math.abs(mid.lat - 0.67)).toBeLessThan(1 / 32);
    expect(Math.abs(mid.lon - 23.47)).toBeLessThan(1 / 32);

    const high60 = patchWindow({ lat: 60, lon: 0 }, index)!;
    expect(high60.stride).toBe(2);                                  // 1 / cos 60
    expect(high60.col1 - high60.col0).toBe(2 * 2 * PATCH_HALF_DEG * 32);
    expect((high60.col1 - high60.col0) % high60.stride).toBe(0);
  });

  it('stops at the polar meshes and never spans more than a tile each way in longitude', () => {
    const near = patchWindow({ lat: -76, lon: 40 }, index, -80, 80)!;
    expect(cellSite(index, near.row1, 0).lat).toBeGreaterThan(-80);
    expect(cellSite(index, near.row1 + 1, 0).lat).toBeLessThan(-80);
    expect(near.col1 - near.col0).toBeLessThanOrEqual(2 * 15 * 32);
    const top = patchWindow({ lat: 78, lon: 0 }, index, -80, 80)!;
    expect(cellSite(index, top.row0, 0).lat).toBeLessThan(80);
    expect(patchWindow({ lat: 89, lon: 0 }, index, -80, 80)).toBeNull();
    expect(patchWindow({ lat: 89.99, lon: 0 }, index)).not.toBeNull();
  });

  it('names the tiles it touches, wrapping across 180 degrees', () => {
    expect(windowTiles(patchWindow({ lat: 7, lon: 7 }, index)!, index)).toEqual([{ row: 5, col: 12 }]);
    const corner = windowTiles(patchWindow({ lat: 0, lon: 0 }, index)!, index);
    expect(corner).toHaveLength(4);
    const line = windowTiles(patchWindow({ lat: 22, lon: 179.9 }, index)!, index);
    expect(line.map((t) => t.col).sort((a, b) => a - b)).toEqual([0, 23]);
    expect(line.every((t) => t.row === 4)).toBe(true);
    expect(tileFile(4, 23)).toBe('tiles/r04c23.bin');
    expect(cellSite(index, 0, -1).lon).toBeCloseTo(180 - 1 / 64, 6);
    expect(cellSite(index, 0, 360 * 32).lon).toBeCloseTo(-180 + 1 / 64, 6);
  });
});

describe('tiles', () => {
  it('reads heights from the right tile and cell, with longitude wrapped', () => {
    const t = 60, make = (value: number, mark?: [number, number, number]) => {
      const view = new DataView(new ArrayBuffer(t * t * 2));
      for (let i = 0; i < t * t; i++) view.setInt16(i * 2, value, true);
      if (mark) view.setInt16((mark[0] * t + mark[1]) * 2, mark[2], true);
      return parseTile(small, view.buffer);
    };
    const tiles = new Map([[tileFile(0, 0), make(100, [3, 5, -2000])], [tileFile(0, 23), make(300)], [tileFile(1, 0), make(500)]]);
    const at = tileHeights(small, tiles);
    expect(at(0, 0)).toBe(50);
    expect(at(3, 5)).toBe(-1000);
    expect(at(0, -1)).toBe(150);                 // west of 180 W is the last tile
    expect(at(0, 360 * 4)).toBe(50);             // east of 180 E is the first
    expect(at(60, 0)).toBe(250);
    expect(at(0, 60)).toBe(0);                   // a tile that is not loaded
    expect(() => parseTile(small, new ArrayBuffer(8))).toThrow(/tile/);
  });
});

describe('patch mesh', () => {
  const win = patchWindow({ lat: -30, lon: 179 }, small)!;
  const up = new Vector3(), n = new Vector3();

  it('lies on the sphere at each cell centre, facing outward, coloured by height', () => {
    const geometry = patchGeometry(win, small, (row) => (row % 2 ? 2000 : -2000), low, high, [-2000, 2000], 1);
    const position = geometry.getAttribute('position'), color = geometry.getAttribute('color');
    const cols = (win.col1 - win.col0) / win.stride + 1;
    for (let i = 0; i < position.count; i++) {
      const row = win.row0 + Math.floor(i / cols), col = win.col0 + (i % cols) * win.stride;
      up.fromBufferAttribute(position, i);
      expect(up.length()).toBeCloseTo(1737.4, 2);
      const site = sphereSite(up.clone().add(moonCentre())), want = cellSite(small, row, col);
      expect(site.lat).toBeCloseTo(want.lat, 3);
      expect(Math.abs(((site.lon - want.lon + 540) % 360) - 180)).toBeLessThan(1e-3);
      expect(color.getX(i)).toBe(row % 2 ? 1 : 0);
    }
    const index3 = geometry.getIndex()!, a = new Vector3(), b = new Vector3(), c = new Vector3();
    for (let i = 0; i < index3.count; i += 3) {
      a.fromBufferAttribute(position, index3.getX(i)); b.fromBufferAttribute(position, index3.getX(i + 1));
      c.fromBufferAttribute(position, index3.getX(i + 2));
      expect(b.sub(a).cross(c.sub(a)).dot(a)).toBeGreaterThan(0);
    }
  });

  it('lights slopes without raising the ground, steeper with more relief', () => {
    const bumpy = (row: number, col: number): number => 800 * Math.sin(row) * Math.cos(col);
    const flat = patchGeometry(win, small, () => 0, low, high, [0, 1], 6);
    const gentle = patchGeometry(win, small, bumpy, low, high, [0, 1], 1);
    const steep = patchGeometry(win, small, bumpy, low, high, [0, 1], 6);
    expect(Array.from(steep.getAttribute('position').array)).toEqual(Array.from(flat.getAttribute('position').array));
    let leanFlat = 0, leanGentle = 0, leanSteep = 0;
    for (let i = 0; i < flat.getAttribute('position').count; i++) {
      up.fromBufferAttribute(flat.getAttribute('position'), i).normalize();
      leanFlat += 1 - n.fromBufferAttribute(flat.getAttribute('normal'), i).dot(up);
      leanGentle += 1 - n.fromBufferAttribute(gentle.getAttribute('normal'), i).dot(up);
      leanSteep += 1 - n.fromBufferAttribute(steep.getAttribute('normal'), i).dot(up);
    }
    expect(leanFlat).toBeLessThan(1e-3);
    expect(leanGentle).toBeGreaterThan(leanFlat + 0.01);
    expect(leanSteep).toBeGreaterThan(leanGentle * 3);
  });

  it('takes the globe\'s normal at its edge and its own in the middle', () => {
    const marker = (_lat: number, _lon: number, out: number[]): void => { out[0] = 1; out[1] = 0; out[2] = 0; };
    const own = patchGeometry(win, small, () => 0, low, high, [0, 1], 1);
    const faded = patchGeometry(win, small, () => 0, low, high, [0, 1], 1, marker);
    const cols = (win.col1 - win.col0) / win.stride + 1, rows = win.row1 - win.row0 + 1;
    const mid = Math.floor(rows / 2) * cols + Math.floor(cols / 2);
    expect(n.fromBufferAttribute(faded.getAttribute('normal'), 0).toArray()).toEqual([1, 0, 0]);
    expect(n.fromBufferAttribute(faded.getAttribute('normal'), cols - 1).toArray()).toEqual([1, 0, 0]);
    expect(n.fromBufferAttribute(faded.getAttribute('normal'), mid).toArray())
      .toEqual(new Vector3().fromBufferAttribute(own.getAttribute('normal'), mid).toArray());
  });
});

describe('globe normal at a point', () => {
  const meta: GlobeMeta = { width: 72, height: 36, height_scale: 0.5, source: 'test' };
  const view = new DataView(new ArrayBuffer(72 * 36 * 2));
  for (let i = 0; i < 72 * 36; i++) view.setInt16(i * 2, Math.round(4000 * Math.sin(i * 0.7)), true);
  const globe = parseGlobe(meta, view.buffer);

  it('equals the cell\'s normal at a cell centre and blends between centres', () => {
    const a = [0, 0, 0], b = [0, 0, 0], near = [0, 0, 0];
    globeNormalAt(globe, 10, 20, 6, a); globeNormalAt(globe, 10, 21, 6, b);
    globeNormalNear(globe, 90 - 10.5 * 5, -180 + 20.5 * 5, 6, near);
    near.forEach((v, k) => expect(v).toBeCloseTo(a[k], 6));
    globeNormalNear(globe, 90 - 10.5 * 5, -180 + 21 * 5, 6, near);
    const mid = new Vector3(a[0] + b[0], a[1] + b[1], a[2] + b[2]).normalize().toArray();
    near.forEach((v, k) => expect(v).toBeCloseTo(mid[k], 6));
    globeNormalNear(globe, 12, 179.99, 6, near);                    // across 180 degrees: no jump, unit length
    expect(Math.hypot(near[0], near[1], near[2])).toBeCloseTo(1, 6);
  });
});
