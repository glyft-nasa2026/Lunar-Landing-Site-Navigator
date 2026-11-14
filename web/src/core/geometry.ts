// Written by T00 straight from the contract's Geometry block; proven by T02 against Skyfield
// (geometry.test.ts: 25 cases in __fixtures__/altaz.json on the real table, worst 0.0007
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
 */
export function destination(
  lat: number, lon: number, bearingDeg: number, distM: number,
): { lat: number; lon: number } {
  const g = distM / (MOON_RADIUS_KM * 1000);
  const b = bearingDeg * RAD;
  const p1 = lat * RAD;
  const sinP2 = Math.sin(p1) * Math.cos(g) + Math.cos(p1) * Math.sin(g) * Math.cos(b);
  const p2 = Math.asin(Math.max(-1, Math.min(1, sinP2)));
  const dLon = Math.atan2(
    Math.sin(b) * Math.sin(g) * Math.cos(p1),
    Math.cos(g) - Math.sin(p1) * sinP2,
  );
  let outLon = lon + dLon * DEG;
  outLon = ((((outLon + 180) % 360) + 360) % 360) - 180;   // -180 to 180, never 0 to 360
  return { lat: p2 * DEG, lon: outLon };
}
