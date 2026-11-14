// Flat map projections (T31). Pure functions: the map turns a screen point into latitude and
// longitude only through these, so every coordinate it shows or picks comes from core/.

import { MOON_RADIUS_KM } from './types';

const RAD = Math.PI / 180;
const R_M = MOON_RADIUS_KM * 1000;

export type MapPoint = { x: number; y: number };
export type LatLon = { lat: number; lon: number };

/** Longitude wrapped to -180..180 (180 itself comes back as -180). */
export function wrapLon(lon: number): number {
  return ((((lon + 180) % 360) + 360) % 360) - 180;
}

/**
 * South polar stereographic, the height map's own grid (contract section 2), in metres.
 * Longitude 0 points up (+y), 90 E points right (+x).
 */
export function polarForward(lat: number, lon: number): MapPoint {
  const r = 2 * R_M * Math.tan(((90 + lat) / 2) * RAD);
  return { x: r * Math.sin(lon * RAD), y: r * Math.cos(lon * RAD) };
}

/** Inverse of `polarForward`. The south pole itself comes back as longitude 0. */
export function polarInverse(x: number, y: number): LatLon {
  const r = Math.hypot(x, y);
  return {
    lat: (2 * Math.atan(r / (2 * R_M))) / RAD - 90,
    lon: r === 0 ? 0 : Math.atan2(x, y) / RAD,
  };
}

/**
 * Equidistant cylindrical (plate carrée), true scale along the equator, in km:
 * x = R (lon - lon0), y = R lat, angles in radians. lon - lon0 is wrapped to -180..180, so the
 * map is centred on lon0.
 */
export function cylForward(lat: number, lon: number, lon0 = 0): MapPoint {
  return { x: MOON_RADIUS_KM * wrapLon(lon - lon0) * RAD, y: MOON_RADIUS_KM * lat * RAD };
}

/** Inverse of `cylForward`. Any x is accepted (the map repeats east and west); null beyond a pole. */
export function cylInverse(x: number, y: number, lon0 = 0): LatLon | null {
  const lat = y / MOON_RADIUS_KM / RAD;
  if (!(Math.abs(lat) <= 90)) return null;
  return { lat, lon: wrapLon(lon0 + x / MOON_RADIUS_KM / RAD) };
}

/**
 * What the canvas shows: the map point at its centre (cx, cy), screen pixels per map unit, and
 * the canvas size in pixels. Screen y grows down; map y grows up.
 */
export type MapView = { cx: number; cy: number; scale: number; width: number; height: number };

export function viewToScreen(view: MapView, x: number, y: number): { px: number; py: number } {
  return {
    px: view.width / 2 + (x - view.cx) * view.scale,
    py: view.height / 2 - (y - view.cy) * view.scale,
  };
}

export function screenToView(view: MapView, px: number, py: number): MapPoint {
  return {
    x: view.cx + (px - view.width / 2) / view.scale,
    y: view.cy - (py - view.height / 2) / view.scale,
  };
}

/** The view moved by a drag of (dx, dy) screen pixels: the ground follows the pointer. */
export function panView(view: MapView, dx: number, dy: number): MapView {
  return { ...view, cx: view.cx - dx / view.scale, cy: view.cy + dy / view.scale };
}

/**
 * The view zoomed by `factor` about a screen point, which stays over the same map point.
 * The scale is held between `min` and `max`.
 */
export function zoomView(view: MapView, px: number, py: number, factor: number, min = 0, max = Infinity): MapView {
  const scale = Math.min(max, Math.max(min, view.scale * factor));
  const at = screenToView(view, px, py);
  return {
    ...view, scale,
    cx: at.x - (px - view.width / 2) / scale,
    cy: at.y + (py - view.height / 2) / scale,
  };
}
