import { Vector3 } from 'three';
import { MOON_RADIUS_KM, type Site } from '../core/types';
import type { DemMeta } from '../core/dem';
import type { Vec3 } from '../core/ephemeris';

const RAD = Math.PI / 180;

/** Render frame: +X = 90 E, +Y = south, -Z = longitude 0. Units are km.
 * This is a rotation (not a reflection), so normals and lighting keep their handedness.
 * The origin is the south pole; the centre of the Moon is (0, -R, 0).
 */
export function moonDirection(v: Vec3): Vector3 {
  return new Vector3(v[1], -v[2], -v[0]);
}

export function sitePosition(site: Site, heightM = 0, stretch = 1): Vector3 {
  const lat = site.lat * RAD, lon = site.lon * RAD;
  const r = MOON_RADIUS_KM + heightM * stretch / 1000;
  return new Vector3(
    r * Math.cos(lat) * Math.sin(lon),
    -r * Math.sin(lat) - MOON_RADIUS_KM,
    -r * Math.cos(lat) * Math.cos(lon),
  );
}

/** Contract inverse stereographic projection. UVs retain the original DEM grid coordinates. */
export function gridSite(meta: DemMeta, col: number, row: number): Site {
  const x = meta.x_min_m + col * meta.pixel_m;
  const y = meta.y_max_m - row * meta.pixel_m;
  return {
    lat: 2 * Math.atan(Math.hypot(x, y) / (2 * MOON_RADIUS_KM * 1000)) / RAD - 90,
    lon: Math.atan2(x, y) / RAD,
  };
}

export function sphereSite(point: Vector3): Site {
  const y = point.y + MOON_RADIUS_KM;
  return {
    lat: -Math.atan2(y, Math.hypot(point.x, point.z)) / RAD,
    lon: Math.atan2(point.x, -point.z) / RAD,
  };
}
