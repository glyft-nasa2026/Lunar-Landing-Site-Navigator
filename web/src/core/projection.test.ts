import { describe, expect, it } from 'vitest';
import { projectToGrid, type DemMeta } from './dem';
import {
  cylForward, cylInverse, panView, polarForward, polarInverse, screenToView, viewToScreen, wrapLon,
  zoomView, type MapView,
} from './projection';
import { MOON_RADIUS_KM } from './types';

const META: DemMeta = {
  size: 634, pixel_m: 960, x_min_m: -304320, y_max_m: 304320,
  height_scale: 0.5, nodata: -32768, min_lat: -80, source: 'made up for a test',
};
const RAD = Math.PI / 180;

/** Distance between two points on the height map's grid, in cells. */
function cells(a: { lat: number; lon: number }, b: { lat: number; lon: number }): number {
  const p = projectToGrid(META, a.lat, a.lon), q = projectToGrid(META, b.lat, b.lon);
  return Math.hypot(p.col - q.col, p.row - q.row);
}

describe('wrapLon', () => {
  it('keeps longitudes in -180..180, never 0..360', () => {
    expect(wrapLon(0)).toBe(0);
    expect(wrapLon(190)).toBeCloseTo(-170, 12);
    expect(wrapLon(-190)).toBeCloseTo(170, 12);
    expect(wrapLon(540)).toBeCloseTo(-180, 12);
    expect(wrapLon(359)).toBeCloseTo(-1, 12);
  });
});

describe('polar stereographic', () => {
  it('is the height map grid of the contract', () => {
    for (const [lat, lon] of [[-88, 45], [-80, -120], [-89.67, 129.78], [-85, 180]]) {
      const p = polarForward(lat, lon), g = projectToGrid(META, lat, lon);
      expect((p.x - META.x_min_m) / META.pixel_m).toBeCloseTo(g.col, 9);
      expect((META.y_max_m - p.y) / META.pixel_m).toBeCloseTo(g.row, 9);
    }
  });

  it('points longitude 0 up and 90 E right', () => {
    const up = polarForward(-89, 0), right = polarForward(-89, 90);
    expect(up.x).toBeCloseTo(0, 6); expect(up.y).toBeGreaterThan(0);
    expect(right.y).toBeCloseTo(0, 6); expect(right.x).toBeGreaterThan(0);
  });

  it('inverts exactly, and puts the pole at the origin', () => {
    expect(polarInverse(0, 0)).toEqual({ lat: -90, lon: 0 });
    for (const [lat, lon] of [[-88, 45], [-80.5, -179.5], [-89.999, 10], [-60, 90]]) {
      const p = polarForward(lat, lon), back = polarInverse(p.x, p.y);
      expect(back.lat).toBeCloseTo(lat, 9);
      expect(back.lon).toBeCloseTo(lon, 9);
    }
  });
});

describe('equidistant cylindrical', () => {
  it('is x = R lon, y = R lat in km, so grid lines are straight and evenly spaced', () => {
    const p = cylForward(30, 60);
    expect(p.x).toBeCloseTo(MOON_RADIUS_KM * 60 * RAD, 9);
    expect(p.y).toBeCloseTo(MOON_RADIUS_KM * 30 * RAD, 9);
    // A meridian has one x at every latitude; a parallel one y at every longitude.
    expect(cylForward(-80, 45).x).toBeCloseTo(cylForward(70, 45).x, 9);
    expect(cylForward(-20, -170).y).toBeCloseTo(cylForward(-20, 100).y, 9);
  });

  it('centres on lon0 and wraps across the antimeridian', () => {
    expect(cylForward(0, 170, 170).x).toBeCloseTo(0, 9);
    // 10 degrees east of 175 E is 175 W, drawn just to the right of the centre.
    expect(cylForward(0, -175, 175).x).toBeCloseTo(MOON_RADIUS_KM * 10 * RAD, 9);
  });

  it('inverts, keeps longitude in -180..180 and refuses beyond a pole', () => {
    for (const [lat, lon, lon0] of [[0.674, 23.473, 0], [-88, 45, 45], [89, -179, 170], [-30, 120, -90]]) {
      const p = cylForward(lat, lon, lon0), back = cylInverse(p.x, p.y, lon0)!;
      expect(back.lat).toBeCloseTo(lat, 9);
      expect(back.lon).toBeCloseTo(lon, 9);
    }
    const east = cylInverse(MOON_RADIUS_KM * 200 * RAD, 0)!;
    expect(east.lon).toBeCloseTo(-160, 9);
    expect(cylInverse(0, MOON_RADIUS_KM * 91 * RAD)).toBeNull();
  });
});

describe('map view', () => {
  const view: MapView = { cx: 1000, cy: -500, scale: 0.01, width: 800, height: 500 };

  it('puts the view centre in the middle of the canvas, with map y up', () => {
    expect(viewToScreen(view, 1000, -500)).toEqual({ px: 400, py: 250 });
    const p = viewToScreen(view, 1100, -400);
    expect(p.px).toBeCloseTo(401, 9); expect(p.py).toBeCloseTo(249, 9);
  });

  it('turns a screen point back into the same map point', () => {
    for (const [x, y] of [[0, 0], [-300000, 250000], [1000, -500]]) {
      const s = viewToScreen(view, x, y), back = screenToView(view, s.px, s.py);
      expect(back.x).toBeCloseTo(x, 6); expect(back.y).toBeCloseTo(y, 6);
    }
  });

  it('pans with the pointer and zooms about it', () => {
    const before = screenToView(view, 100, 50);
    const panned = panView(view, 30, -20);
    const after = screenToView(panned, 130, 30);
    expect(after.x).toBeCloseTo(before.x, 6); expect(after.y).toBeCloseTo(before.y, 6);
    const zoomed = zoomView(view, 100, 50, 4);
    expect(zoomed.scale).toBeCloseTo(0.04, 12);
    const still = screenToView(zoomed, 100, 50);
    expect(still.x).toBeCloseTo(before.x, 6); expect(still.y).toBeCloseTo(before.y, 6);
    expect(zoomView(view, 0, 0, 1000, 0, 0.5).scale).toBe(0.5);
  });
});

// Done-when line: a click on the 2D map returns latitude and longitude within one grid cell.
describe('a click on the flat map', () => {
  const CRATER = { lat: -88.0, lon: 45.0 };

  it('picks the mock crater centre in the polar view, at every zoom where a pixel is a cell or less', () => {
    // Half a pixel of rounding: from 1/960 pixels per metre up, a click lands in the right cell.
    for (const scale of [1 / 960, 0.002, 0.02, 0.2]) {
      // The view centred somewhere else, as after a pan; the canvas a phone or a laptop.
      for (const view of [
        { cx: 12000, cy: -40000, scale, width: 1280, height: 600 },
        { cx: -5000, cy: 7000, scale, width: 390, height: 420 },
      ]) {
        const at = polarForward(CRATER.lat, CRATER.lon);
        const screen = viewToScreen(view, at.x, at.y);
        // The browser reports whole CSS pixels: round, as a real click would be.
        const ground = screenToView(view, Math.round(screen.px), Math.round(screen.py));
        const picked = polarInverse(ground.x, ground.y);
        expect(cells(picked, CRATER)).toBeLessThan(1);
      }
    }
  });

  it('picks the same point in the global view, within one cell once zoomed to it', () => {
    const lon0 = 30;
    const at = cylForward(CRATER.lat, CRATER.lon, lon0);
    // One cell (960 m) is about 0.03 degrees of latitude: a few pixels per km is enough.
    const view = { cx: at.x + 20, cy: at.y - 10, scale: 4, width: 800, height: 500 };
    const screen = viewToScreen(view, at.x, at.y);
    const ground = screenToView(view, Math.round(screen.px), Math.round(screen.py));
    const picked = cylInverse(ground.x, ground.y, lon0)!;
    expect(Math.abs(picked.lat - CRATER.lat)).toBeLessThan(0.01);
    expect(cells(picked, CRATER)).toBeLessThan(1);
  });
});
