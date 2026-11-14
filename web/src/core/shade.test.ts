import { describe, expect, it } from 'vitest';
import { parseDem, projectToGrid, type Dem, type DemMeta } from './dem';
import type { Ephemeris, Vec3 } from './ephemeris';
import { sunAltAz } from './geometry';
import { skylineAt, skylineElev } from './horizon';
import { polarForward, polarInverse } from './projection';
import { shadeGlobal, shadePolar, shadeStride, subPoint } from './shade';

// The mock height map's shape and features (contract section 2), built in memory.
const META: DemMeta = {
  size: 634, pixel_m: 960, x_min_m: -304320, y_max_m: 304320,
  height_scale: 0.5, nodata: -32768, min_lat: -80, source: 'made up for a test',
};
const RAD = Math.PI / 180;
const SUN_RADIUS = 0.267;

function mockDem(flat = false): Dem {
  const crater = polarForward(-88, 45), ridge = polarForward(-87, -120);
  const values = new Int16Array(META.size * META.size);
  for (let row = 0; row < META.size; row++) {
    const y = META.y_max_m - row * META.pixel_m;
    for (let col = 0; col < META.size; col++) {
      const x = META.x_min_m + col * META.pixel_m;
      let h = 0;
      if (!flat) {
        const d = Math.hypot(x - crater.x, y - crater.y);
        h = d < 3000 ? -3000 : d < 10000 ? -3000 + (3500 * (d - 3000)) / 7000 : d < 12000 ? (500 * (12000 - d)) / 2000 : 0;
        if (Math.abs(x - ridge.x) < 10000 && Math.abs(y - ridge.y) < 1500) h = Math.max(h, 1500 * (1 - Math.abs(y - ridge.y) / 1500));
      }
      values[row * META.size + col] = Math.round(h * 2);
    }
  }
  const buffer = new ArrayBuffer(values.length * 2);
  const view = new DataView(buffer);
  values.forEach((v, i) => view.setInt16(i * 2, v, true));
  return parseDem(META, buffer);
}

/** The Sun at `elev` degrees from the Moon's equator plane (south positive), at longitude `lon`. */
function sunFrom(lon: number, southDeg: number): Vec3 {
  const z = -Math.sin(southDeg * RAD), c = Math.cos(southDeg * RAD);
  return [c * Math.cos(lon * RAD), c * Math.sin(lon * RAD), z];
}

function at(shade: ReturnType<typeof shadePolar>, lat: number, lon: number): { frac: number; cosI: number } {
  const g = projectToGrid(META, lat, lon);
  const i = Math.round(g.row / shade.stride) * shade.size + Math.round(g.col / shade.stride);
  return { frac: shade.frac[i], cosI: shade.cosI[i] };
}

/** A table that answers every time with one Sun direction: enough for sunAltAz. */
function fixedSun(sun: Vec3): Ephemeris {
  return { vectorsAt: () => ({ sun, earthKm: [384400, 0, 0] }) } as unknown as Ephemeris;
}

const dem = mockDem();

describe('shadeStride', () => {
  it('keeps the layer at or under the cell limit', () => {
    expect(shadeStride(634, 1300)).toBe(1);
    expect(shadeStride(2534, 1300)).toBe(2);
    expect(shadeStride(2534, 600)).toBe(5);
  });
});

describe('shadePolar', () => {
  it('lights flat ground evenly when the Sun stands well up, and marks the corners outside coverage', () => {
    const flat = mockDem(true);
    const s = shadePolar(flat, sunFrom(30, 20));
    expect(s.size).toBe(634);
    for (const [lat, lon] of [[-89.9, 0], [-85, 30], [-81, -150], [-84, 120]]) {
      expect(at(s, lat, lon).frac).toBe(1);
    }
    // Facing the Sun more near its sub-solar side of the pole: the ground curves toward it.
    expect(at(s, -82, 30).cosI).toBeGreaterThan(at(s, -82, -150).cosI);
    expect(at(s, -89.99, 0).cosI).toBeCloseTo(Math.sin(20 * RAD), 3);
    // The grid's corner is north of 80 S: no data drawn there.
    expect(Number.isNaN(s.frac[0])).toBe(true);
    expect(Number.isNaN(s.cosI[0])).toBe(true);
  });

  it('puts the crater floor in shadow under a low Sun from every direction', () => {
    for (let lon = -180; lon < 180; lon += 30) {
      const s = shadePolar(dem, sunFrom(lon, 1.5));
      expect(at(s, -88, 45).frac).toBe(0);
    }
  });

  it('lights the crater floor when the Sun is overhead at the pole', () => {
    const s = shadePolar(dem, [0, 0, -1]);
    expect(at(s, -88, 45).frac).toBe(1);
  });

  it('casts the ridge\'s shadow on the side away from the Sun only', () => {
    // The ridge runs along the grid's x. A Sun from longitude 0 (+y) shines across it and shades
    // the -y side; one from 90 E (+x) shines along it. 10 degrees south of the equator puts it
    // about 8 degrees up at the ridge, so its 1,500 m cast a shadow about 10 km long.
    const s = shadePolar(dem, sunFrom(90, 10));
    const along = shadePolar(dem, sunFrom(0, 10));
    const ridge = polarForward(-87, -120);
    const behind = { col: (ridge.x - META.x_min_m) / 960, row: (META.y_max_m - (ridge.y - 4000)) / 960 };
    const front = { col: behind.col, row: (META.y_max_m - (ridge.y + 4000)) / 960 };
    const idx = (p: { col: number; row: number }): number => Math.round(p.row) * along.size + Math.round(p.col);
    expect(along.frac[idx(behind)]).toBe(0);
    expect(along.frac[idx(front)]).toBe(1);
    expect(s.frac[idx(behind)]).toBe(1);
  });

  it('agrees with the skyline (windows.ts rule) wherever the Sun is clearly up or clearly hidden', () => {
    const ridge = polarForward(-87, -120);
    const sites = [
      { lat: -88, lon: 45 },      // crater floor
      { lat: -87.67, lon: 45 },   // crater rim
      { lat: -88.2, lon: 45 },    // floor, off centre
      polarInverse(ridge.x, ridge.y - 6000), // 6 km off the ridge, on the -y side
      polarInverse(ridge.x, ridge.y + 6000),
      { lat: -86, lon: 100 }, { lat: -89.5, lon: -60 }, { lat: -82, lon: 170 },
    ];
    const skylines = sites.map((site) => skylineAt(dem, site));
    let compared = 0;
    for (let lon = -180; lon < 180; lon += 20) {
      for (const south of [-1.5, 0, 1.5]) {
        const sun = sunFrom(lon, south);
        const s = shadePolar(dem, sun);
        for (const [k, site] of sites.entries()) {
          const { alt, az } = sunAltAz(fixedSun(sun), site, 0, 0);
          const above = alt - skylineElev(skylines[k], az);
          // Near the limb the two grids may differ by a cell: compare only clear cases.
          if (Math.abs(above + SUN_RADIUS) < 0.3) continue;
          expect(at(s, site.lat, site.lon).frac > 0, `${JSON.stringify(site)} sun ${lon},${south}`).toBe(above > -SUN_RADIUS);
          compared++;
        }
      }
    }
    expect(compared).toBeGreaterThan(200);
  });

  it('is quick enough to redraw while the time is dragged on the real grid size', () => {
    const big: DemMeta = { ...META, size: 2534, pixel_m: 240, x_min_m: -304080, y_max_m: 304080 };
    const real = parseDem(big, new ArrayBuffer(2534 * 2534 * 2));
    shadePolar(real, sunFrom(0, 1)); // builds the cached ground once
    const t0 = performance.now();
    const s = shadePolar(real, sunFrom(77, 1));
    expect(s.stride).toBe(2);
    expect(performance.now() - t0).toBeLessThan(400);
  });
});

describe('shadeGlobal and subPoint', () => {
  it('is day under the Sun and night opposite, row 0 at the north', () => {
    const sun: Vec3 = [1, 0, 0];
    const g = shadeGlobal(sun, 360, 180);
    expect(g[90 * 360 + 180]).toBeGreaterThan(0.99);   // near 0, 0
    expect(g[90 * 360 + 0]).toBeLessThan(-0.99);       // near 180 W
    expect(Math.abs(g[0])).toBeLessThan(0.01);         // near the north pole: on the terminator
    const north = shadeGlobal([0, 0, 1], 4, 4);
    expect(north[0]).toBeGreaterThan(0);
    expect(north[15]).toBeLessThan(0);
  });

  it('finds the point under a direction', () => {
    const p = subPoint([0, 2, 2]);
    expect(p.lat).toBeCloseTo(45, 9);
    expect(p.lon).toBeCloseTo(90, 9);
    expect(subPoint([-1, -1e-12, 0]).lon).toBeCloseTo(-180, 6);
  });
});
