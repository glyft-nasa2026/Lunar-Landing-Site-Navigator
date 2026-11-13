// Sanity tests by T00. T02 owns this file next and adds the fixture tests.
import { describe, expect, it } from 'vitest';
import { parseEphemeris, type Ephemeris } from './ephemeris';
import { destination, earthAltAz, sunAltAz } from './geometry';

const START = Date.parse('2027-01-01T00:00:00Z');

// A two-row table that holds still: the Sun at `sun`, Earth at `earthKm`.
function still(sun: number[], earthKm: number[]): Ephemeris {
  const buffer = new ArrayBuffer(48);
  const view = new DataView(buffer);
  [...sun, ...earthKm, ...sun, ...earthKm].forEach((v, i) => view.setFloat32(i * 4, v, true));
  return parseEphemeris({
    start: '2027-01-01T00:00:00Z', step_s: 3600, rows: 2, frame: 'MOON_ME_DE421',
    columns: [], source: 'made up for a test',
  }, buffer);
}

describe('sunAltAz', () => {
  const eph = still([1, 0, 0], [384400, 0, 0]);   // Sun over latitude 0, longitude 0

  it('is overhead at the point under the Sun', () => {
    expect(sunAltAz(eph, { lat: 0, lon: 0 }, 0, START).alt).toBeCloseTo(90, 4);
  });

  it('is on the horizon due west, seen from 90 degrees further east', () => {
    const a = sunAltAz(eph, { lat: 0, lon: 90 }, 0, START);
    expect(a.alt).toBeCloseTo(0, 6);
    expect(a.az).toBeCloseTo(270, 6);
  });

  it('is on the horizon due east, seen from 90 degrees further west', () => {
    const a = sunAltAz(eph, { lat: 0, lon: -90 }, 0, START);
    expect(a.alt).toBeCloseTo(0, 6);
    expect(a.az).toBeCloseTo(90, 6);
  });

  it('is due south at 45 degrees from latitude 45 N, and due north from 45 S', () => {
    const north = sunAltAz(eph, { lat: 45, lon: 0 }, 0, START);
    expect(north.alt).toBeCloseTo(45, 6);
    expect(north.az).toBeCloseTo(180, 6);
    const south = sunAltAz(eph, { lat: -45, lon: 0 }, 0, START);
    expect(south.alt).toBeCloseTo(45, 6);
    expect(south.az % 360).toBeCloseTo(0, 6);
  });

  it('sits on the horizon at the south pole when the Sun is over the equator', () => {
    expect(sunAltAz(eph, { lat: -90, lon: 0 }, 0, START).alt).toBeCloseTo(0, 6);
  });

  it('keeps azimuth within 0..360', () => {
    for (let lon = -180; lon <= 180; lon += 15) {
      const { az } = sunAltAz(eph, { lat: -60, lon }, 0, START);
      expect(az).toBeGreaterThanOrEqual(0);
      expect(az).toBeLessThan(360);
    }
  });
});

describe('earthAltAz', () => {
  const eph = still([0, 1, 0], [384400, 0, 0]);

  it('is overhead at the middle of the near side', () => {
    expect(earthAltAz(eph, { lat: 0, lon: 0 }, 0, START).alt).toBeCloseTo(90, 4);
  });

  it('is about 0.26 degrees below the horizon at the edge of the near side', () => {
    // Earth is close: standing 1,737 km to the side lowers it by atan(R / distance).
    const a = earthAltAz(eph, { lat: 0, lon: 90 }, 0, START);
    expect(a.alt).toBeCloseTo(-0.259, 2);
    expect(a.az).toBeCloseTo(270, 6);
  });

  it('rises a little when the site is higher', () => {
    const low = earthAltAz(eph, { lat: 0, lon: 60, eye_m: 0 }, 0, START).alt;
    const high = earthAltAz(eph, { lat: 0, lon: 60, eye_m: 0 }, 5000, START).alt;
    expect(high).toBeLessThan(low);                 // parallax grows with the site's radius
    expect(low - high).toBeLessThan(0.001);
  });
});

describe('destination', () => {
  it('moves 1 km north: latitude up by 0.03298 degrees, longitude unchanged', () => {
    const p = destination(-88, 45, 0, 1000);
    expect(p.lat - -88).toBeCloseTo(0.03298, 4);
    expect(p.lon).toBeCloseTo(45, 9);
  });

  it('moves 1 km east along the equator', () => {
    const p = destination(0, 10, 90, 1000);
    expect(p.lat).toBeCloseTo(0, 9);
    expect(p.lon - 10).toBeCloseTo(0.03298, 4);
  });

  it('keeps longitude between -180 and 180', () => {
    const p = destination(0, 179.99, 90, 1000);
    expect(p.lon).toBeLessThan(-179.9);
    expect(p.lon).toBeGreaterThanOrEqual(-180);
  });

  it('reaches the north pole after a quarter of the way round', () => {
    const quarter = (Math.PI / 2) * 1737.4 * 1000;
    expect(destination(0, 30, 0, quarter).lat).toBeCloseTo(90, 6);
  });

  it('stays put for a distance of 0', () => {
    expect(destination(-87.67, 45, 123, 0)).toEqual({ lat: expect.closeTo(-87.67, 9), lon: expect.closeTo(45, 9) });
  });
});
