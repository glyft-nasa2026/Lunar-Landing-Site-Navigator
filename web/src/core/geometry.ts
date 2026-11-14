// Written by T00 straight from the contract's Geometry block; proven by T02 against Skyfield
// (geometry.test.ts: every case in __fixtures__/altaz.json on the real table, worst 0.0007
// degrees). Names and signatures never change.
//
// The Moon has no atmosphere: no refraction is applied anywhere.

import type { Ephemeris, Vec3 } from './ephemeris';
import { DEFAULT_EYE_M, MOON_RADIUS_KM, type AltAz, type Site } from './types';

const RAD = Math.PI / 180;
const DEG = 180 / Math.PI;

const dot = (a: Vec3, b: Vec3): number => a[0] * b[0] + a[1] * b[1] + a[2] * b[2];

/** The site's own up, east and north, as unit vectors in the Moon-fixed frame. */
function localAxes(lat: number, lon: number): { n: Vec3; east: Vec3; north: Vec3 } {
  const cl = Math.cos(lat * RAD), sl = Math.sin(lat * RAD);
  const co = Math.cos(lon * RAD), so = Math.sin(lon * RAD);
  return {
    n: [cl * co, cl * so, sl],
    east: [-so, co, 0],
    north: [-sl * co, -sl * so, cl],
  };
}

function toAltAz(d: Vec3, axes: { n: Vec3; east: Vec3; north: Vec3 }): AltAz {
  const up = Math.max(-1, Math.min(1, dot(d, axes.n)));
  const alt = Math.asin(up) * DEG;
  let az = Math.atan2(dot(d, axes.east), dot(d, axes.north)) * DEG;
  if (az < 0) az += 360;
  if (az >= 360) az -= 360;
  return { alt, az };
}

/**
 * Sun altitude and azimuth at a site. groundM is the terrain height at the site; the Sun is
 * so far away that it doesn't change the answer, but the argument keeps the two calls alike.
 */
export function sunAltAz(eph: Ephemeris, site: Site, _groundM: number, tMs: number): AltAz {
  return toAltAz(eph.vectorsAt(tMs).sun, localAxes(site.lat, site.lon));
}

/** Earth altitude and azimuth at a site, allowing for where the site stands on the Moon. */
export function earthAltAz(eph: Ephemeris, site: Site, groundM: number, tMs: number): AltAz {
  const axes = localAxes(site.lat, site.lon);
  const rKm = MOON_RADIUS_KM + (groundM + (site.eye_m ?? DEFAULT_EYE_M)) / 1000;
  const e = eph.vectorsAt(tMs).earthKm;
  const d: Vec3 = [e[0] - rKm * axes.n[0], e[1] - rKm * axes.n[1], e[2] - rKm * axes.n[2]];
  const len = Math.hypot(d[0], d[1], d[2]);
  return toAltAz([d[0] / len, d[1] / len, d[2] / len], axes);
}

/**
 * The point reached from (lat, lon) after distM metres along the great circle that starts out
 * at bearingDeg (clockwise from north), on a sphere of radius R.
 *
 * It turns the site's "up" vector by the angle distM / R towards cos(b) north + sin(b) east,
 * with the contract's north and east. Those are defined at the poles too, from the longitude
 * the site was given, so a start at exactly -90 or 90 works: bearing b from the south pole
 * lands on longitude lon + b. The latitude-and-longitude form of the same formula divides
 * 0 by 0 there.
 */
export function destination(
  lat: number, lon: number, bearingDeg: number, distM: number,
): { lat: number; lon: number } {
  const g = distM / (MOON_RADIUS_KM * 1000);
  const cl = Math.cos(lat * RAD), sl = Math.sin(lat * RAD);
  const co = Math.cos(lon * RAD), so = Math.sin(lon * RAD);
  const cb = Math.cos(bearingDeg * RAD), sb = Math.sin(bearingDeg * RAD);
  const cg = Math.cos(g), sg = Math.sin(g);
  const x = cg * cl * co + sg * (-sl * co * cb - so * sb);
  const y = cg * cl * so + sg * (-sl * so * cb + co * sb);
  const z = cg * sl + sg * cl * cb;
  const flat = Math.hypot(x, y);
  // On a pole every longitude is the same point: keep the one it came with.
  const rawLon = flat < 1e-12 ? lon : Math.atan2(y, x) * DEG;
  const outLon = ((((rawLon + 180) % 360) + 360) % 360) - 180;   // -180 to 180, never 0 to 360
  return { lat: Math.atan2(z, flat) * DEG, lon: outLon };
}
