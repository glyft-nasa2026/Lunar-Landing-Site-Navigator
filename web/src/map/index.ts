// The flat 2D map (T31): a plain 2D canvas, no three.js. Two projections, as LROC QuickMap does:
// the height map in its own south polar stereographic grid when the selected site is on it, and
// equidistant cylindrical for the whole Moon otherwise. Every coordinate and every light value
// comes from core/ (projection.ts, shade.ts); this file only draws them and turns pointer
// positions into calls to core/.

import type { Dem } from '../core/dem';
import type { Ephemeris, Vec3 } from '../core/ephemeris';
import {
  cylForward, cylInverse, panView, polarForward, polarInverse, screenToView, viewToScreen, zoomView,
  type LatLon, type MapView,
} from '../core/projection';
import { shadeGlobal, shadePolar, subPoint, type PolarShade } from '../core/shade';
import { MOON_RADIUS_KM, type Site } from '../core/types';
import { getState, select, selected, setLiveSite, subscribe, type AppState } from '../state';
import { themeColor } from '../ui/plotTheme';
import './map.css';

type Kind = 'polar' | 'global';
type Rgb = [number, number, number];
type Pin = { site: Site; color: string; scenarioId?: string; big: boolean };

const mounts = new WeakMap<HTMLElement, () => void>();
const demIds = new WeakMap<Dem, number>();
let nextDemId = 1;
/** A number per height map object, so a new grid (even with the same metadata) rebuilds the layers. */
function demId(d: Dem | null): number {
  if (!d) return 0;
  if (!demIds.has(d)) demIds.set(d, nextDemId++);
  return demIds.get(d)!;
}
const HALF_WORLD_KM = Math.PI * MOON_RADIUS_KM;   // 180 degrees of longitude, in map km
const GLOBAL_W = 1440, GLOBAL_H = 720;            // the whole-Moon layer: 0.25 degrees a cell
/** A press that moves less than this many CSS pixels is a click, not a drag (as in the 3D scene). */
const CLICK_SLOP = 5;
const POLAR_STEPS = [5, 2, 1, 0.5, 0.25, 0.1];    // parallels, degrees apart
const MERIDIAN_STEPS = [90, 45, 30, 15, 10, 5, 2, 1];
const GLOBAL_STEPS = [30, 15, 10, 5, 2, 1, 0.5, 0.25, 0.1];

/** A theme length in CSS pixels (theme.css may write it in rem). */
function themeLength(host: HTMLElement, name: string): number {
  const probe = document.createElement('div');
  probe.style.position = 'absolute'; probe.style.visibility = 'hidden'; probe.style.width = `var(${name})`;
  host.append(probe);
  const px = probe.getBoundingClientRect().width;
  probe.remove();
  return px;
}

/** Any CSS colour the theme gives, as RGB bytes (the canvas does the parsing). */
function rgbOf(color: string): Rgb {
  const c = document.createElement('canvas'); c.width = c.height = 1;
  const ctx = c.getContext('2d')!;
  ctx.fillStyle = color; ctx.fillRect(0, 0, 1, 1);
  const [r, g, b] = ctx.getImageData(0, 0, 1, 1).data;
  return [r, g, b];
}

function degLabel(value: number, pos: string, neg: string): string {
  const a = Math.abs(value);
  const text = Number.isInteger(a) ? String(a) : a.toFixed(a < 1 ? 2 : 1).replace(/0+$/, '');
  return a === 0 || a === 180 ? `${text}°` : `${text}°${value > 0 ? pos : neg}`;
}

/** Whether the table has a row for this time: outside it, the map is drawn without light, as the scene is. */
function tabled(eph: Ephemeris | null, tMs: number): eph is Ephemeris {
  return !!eph && tMs >= eph.startMs && tMs <= eph.endMs && eph.missing(tMs, tMs).length === 0;
}

export function unmount(el: HTMLElement): void { mounts.get(el)?.(); }

export function mount(el: HTMLElement): void {
  unmount(el);
  el.classList.add('map');
  el.innerHTML = '';
  const canvas = document.createElement('canvas');
  canvas.className = 'map-canvas'; canvas.tabIndex = 0;
  canvas.setAttribute('role', 'application');
  canvas.setAttribute('aria-label', 'Flat map of the Moon. Click to select a site; arrow keys pan, plus and minus zoom.');
  el.append(canvas);
  const ctx = canvas.getContext('2d')!;

  let disposed = false, frame = 0;
  let kind: Kind = 'global', dem: Dem | null = null, siteKey = '', framed = false;
  let view: MapView = { cx: 0, cy: 0, scale: 1, width: 1, height: 1 };
  let minScale = 0, maxScale = Infinity;
  let pins: Pin[] = [];
  // Cached layers, rebuilt only when what they depend on changes.
  let base: HTMLCanvasElement | null = null, baseKey = '', baseDirty = true;
  let shade: PolarShade | null = null, shadeKey = '';
  let sunPoint: LatLon | null = null, earthPoint: LatLon | null = null;
  let theme = { key: '', lo: [0, 0, 0] as Rgb, hi: [0, 0, 0] as Rgb, pinPx: 4, fontPx: 12, font: '' };

  function readTheme(): void {
    const key = ['--terrain-lo', '--terrain-hi', '--bg', '--text', '--muted', '--border', '--sun', '--earth', '--font', '--fs-sm', '--space-1'].map(themeColor).join('|');
    if (key === theme.key) return;
    const fontPx = themeLength(el, '--fs-sm') || 12;
    theme = {
      key, lo: rgbOf(themeColor('--terrain-lo')), hi: rgbOf(themeColor('--terrain-hi')),
      pinPx: Math.max(2, themeLength(el, '--space-1')), fontPx,
      font: `${fontPx}px ${themeColor('--font') || 'sans-serif'}`,
    };
    baseKey = '';
  }

  /** Height colour times brightness, into an RGBA buffer. */
  function paint(data: Uint8ClampedArray, i: number, t: number, light: number): void {
    const { lo, hi } = theme;
    data[i] = (lo[0] + (hi[0] - lo[0]) * t) * light;
    data[i + 1] = (lo[1] + (hi[1] - lo[1]) * t) * light;
    data[i + 2] = (lo[2] + (hi[2] - lo[2]) * t) * light;
    data[i + 3] = 255;
  }
  /**
   * Brightness from core's light layer. Shadow keeps a little, so the ground's shape still shows
   * through the height colours. Flat ground under a low Sun reads as lit, slopes facing it brighter.
   */
  const brightness = (frac: number, cosI: number): number =>
    0.3 + 0.7 * frac * Math.min(1, Math.max(0, 0.4 + 2 * cosI));

  function buildPolarBase(s: AppState, lit: boolean): void {
    const sc = selected();
    const sun: Vec3 | null = lit ? s.eph!.vectorsAt(sc.tMs).sun : null;
    const key = `polar|${theme.key}|${demId(dem)}|${sun ? sun.join(',') : 'unlit'}`;
    if (base && baseKey === key && shade) return;
    const sunKey = `${demId(dem)}|${sun ? sun.join(',') : 'unlit'}`;
    if (!shade || shadeKey !== sunKey) {
      // With no Sun, any direction gives the heights; the light is then left out below.
      shade = shadePolar(dem!, sun ?? [0, 0, -1]);
      shadeKey = sunKey;
    }
    const { size, frac, cosI, height, heightRange: [lo, hi] } = shade;
    const image = new ImageData(size, size);
    const span = Math.max(1, hi - lo);
    for (let i = 0; i < size * size; i++) {
      if (Number.isNaN(height[i])) continue;   // outside coverage: transparent
      paint(image.data, i * 4, (height[i] - lo) / span, sun ? brightness(frac[i], cosI[i]) : 0.6);
    }
    base = base && base.width === size ? base : document.createElement('canvas');
    base.width = base.height = size;
    base.getContext('2d')!.putImageData(image, 0, 0);
    baseKey = key;
  }

  function buildGlobalBase(s: AppState, lit: boolean): void {
    const sc = selected();
    const vectors = lit ? s.eph!.vectorsAt(sc.tMs) : null;
    const key = `global|${theme.key}|${demId(dem)}|${vectors ? vectors.sun.join(',') : 'unlit'}`;
    sunPoint = vectors ? subPoint(vectors.sun) : null;
    earthPoint = vectors ? subPoint(vectors.earthKm) : null;
    if (base && baseKey === key) return;
    const day = vectors ? shadeGlobal(vectors.sun, GLOBAL_W, GLOBAL_H) : null;
    const image = new ImageData(GLOBAL_W, GLOBAL_H);
    // The polar cap's own heights, where the height map covers it; mid-ramp grey elsewhere.
    const range = dem ? capRange(dem) : [0, 1];
    for (let j = 0; j < GLOBAL_H; j++) {
      const lat = 90 - ((j + 0.5) * 180) / GLOBAL_H;
      for (let i = 0; i < GLOBAL_W; i++) {
        const lon = -180 + ((i + 0.5) * 360) / GLOBAL_W;
        let t = 0.5;
        if (dem && lat <= dem.meta.min_lat && dem.covers(lat, lon)) {
          t = Math.min(1, Math.max(0, (dem.heightAt(lat, lon) - range[0]) / Math.max(1, range[1] - range[0])));
        }
        const k = j * GLOBAL_W + i;
        paint(image.data, k * 4, t, day ? (day[k] > 0 ? 0.6 + 0.4 * day[k] : 0.3) : 0.6);
      }
    }
    base = base && base.width === GLOBAL_W ? base : document.createElement('canvas');
    base.width = GLOBAL_W; base.height = GLOBAL_H;
    base.getContext('2d')!.putImageData(image, 0, 0);
    baseKey = key;
  }
  const capRanges = new WeakMap<Dem, [number, number]>();
  function capRange(d: Dem): [number, number] {
    let r = capRanges.get(d);
    if (!r) { r = shadePolar(d, [0, 0, -1], 400).heightRange; capRanges.set(d, r); }
    return r;
  }

  /** Map point of a site in the current projection. Global: the copy of it nearest the view centre. */
  function project(site: Site): { x: number; y: number } {
    if (kind === 'polar') return polarForward(site.lat, site.lon);
    const p = cylForward(site.lat, site.lon);
    const turns = Math.round((view.cx - p.x) / (2 * HALF_WORLD_KM));
    return { x: p.x + turns * 2 * HALF_WORLD_KM, y: p.y };
  }
  /** The site under a screen point, from core's inverse projections. */
  function unproject(px: number, py: number): LatLon | null {
    const p = screenToView(view, px, py);
    return kind === 'polar' ? polarInverse(p.x, p.y) : cylInverse(p.x, p.y);
  }

  /** Starting view of the selected site: about 150 km across at the pole, the whole Moon elsewhere. */
  function centre(): void {
    const { width, height } = view;
    if (kind === 'polar' && dem) {
      const spanKm = Math.max(8, Math.min(80, dem.meta.size * dem.meta.pixel_m / 8000));
      const whole = dem.meta.size * dem.meta.pixel_m;
      view = { ...view, scale: height / (2 * spanKm * 1000) };
      minScale = Math.min(width, height) / whole / 2;
      maxScale = 8 / dem.meta.pixel_m;
    } else {
      view = { ...view, scale: Math.min(width / (2 * HALF_WORLD_KM), height / HALF_WORLD_KM) };
      minScale = view.scale / 2;
      maxScale = 4;   // 4 pixels per km: a click lands within a few hundred metres
    }
    follow();
  }
  /** Brings the selected site to the middle of the view, keeping the zoom. */
  function follow(): void {
    const p = project(selected().site);
    view = { ...view, cx: p.x, cy: p.y };
    invalidate();
  }

  function resize(): void {
    const width = el.clientWidth, height = el.clientHeight;
    if (!width || !height) return;
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    canvas.width = Math.round(width * dpr); canvas.height = Math.round(height * dpr);
    const first = view.width <= 1;
    view = { ...view, width, height };
    if (first) { framed = false; update(getState()); }
    invalidate();
  }

  function invalidate(): void {
    if (frame || disposed) return;
    frame = requestAnimationFrame(() => { frame = 0; if (!disposed) draw(); });
  }

  /** The finest of `steps` (largest first) that keeps grid lines at least `minPx` apart; the coarsest if none does. */
  function niceStep(steps: number[], pxPerDeg: number, minPx: number): number {
    let best = steps[0];
    for (const s of steps) if (s * pxPerDeg >= minPx) best = s;
    return best;
  }

  function drawPolarGrid(): void {
    if (!dem) return;
    const { width, height } = view;
    const edgeLat = dem.meta.min_lat;
    const pole = viewToScreen(view, 0, 0);
    // About 30 km a degree near the pole: choose spacings that keep lines 60 px or more apart.
    const pxPerDegLat = (polarForward(-89, 0).y - polarForward(-90, 0).y) * view.scale;
    const latStep = niceStep(POLAR_STEPS, pxPerDegLat, 60);
    ctx.lineWidth = 1;
    ctx.strokeStyle = themeColor('--border'); ctx.fillStyle = themeColor('--muted');
    ctx.font = theme.font; ctx.textBaseline = 'middle'; ctx.textAlign = 'left';
    for (let lat = edgeLat; lat > -90 + 1e-9; lat -= latStep) {
      const r = polarForward(lat, 0).y * view.scale;
      ctx.beginPath(); ctx.arc(pole.px, pole.py, r, 0, Math.PI * 2); ctx.stroke();
      const label = viewToScreen(view, 0, polarForward(lat, 0).y);
      if (label.py > 0 && label.py < height) ctx.fillText(degLabel(lat, 'N', 'S'), pole.px + 4, label.py - theme.fontPx / 2);
    }
    // Meridians: straight lines from the pole. Spacing from the circle 60 px out from the view's middle.
    const middleR = Math.max(60, Math.hypot(pole.px - width / 2, pole.py - height / 2));
    const lonStep = niceStep(MERIDIAN_STEPS, (middleR * Math.PI) / 180, 60);
    ctx.textAlign = 'center';
    for (let lon = -180; lon < 180; lon += lonStep) {
      const end = polarForward(edgeLat, lon);
      const s = viewToScreen(view, end.x, end.y);
      ctx.beginPath(); ctx.moveTo(pole.px, pole.py); ctx.lineTo(s.px, s.py); ctx.stroke();
      // Label where the meridian leaves the view, or at the map's edge.
      const t = Math.min(1, clipT(pole.px, pole.py, s.px, s.py, width, height));
      if (t > 0.05) {
        const lx = pole.px + (s.px - pole.px) * t * 0.97, ly = pole.py + (s.py - pole.py) * t * 0.97;
        ctx.fillText(degLabel(lon, 'E', 'W'), lx, ly);
      }
    }
  }
  /** How far along a segment from inside the view it stays inside, 0..1 (or more: it ends inside). */
  function clipT(x0: number, y0: number, x1: number, y1: number, w: number, h: number): number {
    let t = Infinity;
    const dx = x1 - x0, dy = y1 - y0;
    if (dx > 0) t = Math.min(t, (w - x0) / dx); else if (dx < 0) t = Math.min(t, -x0 / dx);
    if (dy > 0) t = Math.min(t, (h - y0) / dy); else if (dy < 0) t = Math.min(t, -y0 / dy);
    return x0 < 0 || x0 > w || y0 < 0 || y0 > h ? 0 : t;
  }

  function drawGlobalGrid(): void {
    const { width, height } = view;
    const pxPerDeg = (HALF_WORLD_KM / 180) * view.scale;
    const step = niceStep(GLOBAL_STEPS, pxPerDeg, 60);
    ctx.lineWidth = 1;
    ctx.strokeStyle = themeColor('--border'); ctx.fillStyle = themeColor('--muted');
    ctx.font = theme.font;
    const top = viewToScreen(view, 0, HALF_WORLD_KM / 2).py, bottom = viewToScreen(view, 0, -HALF_WORLD_KM / 2).py;
    const y0 = Math.max(0, top), y1 = Math.min(height, bottom);
    // Meridians: vertical lines, every `step` degrees, repeating east and west.
    const left = screenToView(view, 0, 0).x, right = screenToView(view, width, 0).x;
    const degPerKm = 180 / HALF_WORLD_KM;
    ctx.textAlign = 'center'; ctx.textBaseline = 'bottom';
    for (let d = Math.ceil((left * degPerKm) / step) * step; d <= right * degPerKm; d += step) {
      const px = viewToScreen(view, d / degPerKm, 0).px;
      ctx.beginPath(); ctx.moveTo(px, y0); ctx.lineTo(px, y1); ctx.stroke();
      const lon = cylInverse(d / degPerKm, 0)!.lon;
      ctx.fillText(degLabel(Math.round(lon * 1000) / 1000, 'E', 'W'), px, y1 - 2);
    }
    // Parallels: horizontal lines.
    ctx.textAlign = 'left'; ctx.textBaseline = 'bottom';
    for (let lat = -90; lat <= 90; lat += step) {
      const py = viewToScreen(view, 0, (lat / 180) * HALF_WORLD_KM).py;
      if (py < -1 || py > height + 1) continue;
      ctx.beginPath(); ctx.moveTo(0, py); ctx.lineTo(width, py); ctx.stroke();
      ctx.fillText(degLabel(Math.round(lat * 1000) / 1000, 'N', 'S'), 4, py - 2);
    }
  }

  function drawMarker(site: LatLon, color: string, label: string): void {
    const p = project(site), s = viewToScreen(view, p.x, p.y);
    const r = theme.pinPx * 2;
    ctx.fillStyle = themeColor(color); ctx.strokeStyle = themeColor('--bg'); ctx.lineWidth = 1;
    ctx.beginPath(); ctx.arc(s.px, s.py, r, 0, Math.PI * 2); ctx.fill(); ctx.stroke();
    ctx.fillStyle = themeColor('--text'); ctx.font = theme.font;
    ctx.textAlign = 'left'; ctx.textBaseline = 'middle';
    ctx.fillText(label, s.px + r + 3, s.py);
  }

  function pinScreen(pin: Pin): { px: number; py: number; r: number } {
    const p = project(pin.site), s = viewToScreen(view, p.x, p.y);
    return { ...s, r: theme.pinPx * (pin.big ? 1.6 : 1) };
  }

  function draw(): void {
    const { width, height } = view;
    if (width <= 1 || el.hidden) return;
    if (baseDirty) {
      baseDirty = false;
      const s = getState(), lit = tabled(s.eph, selected().tMs);
      if (kind === 'polar' && dem) buildPolarBase(s, lit); else buildGlobalBase(s, lit);
    }
    const dpr = canvas.width / width;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.fillStyle = themeColor('--bg'); ctx.fillRect(0, 0, width, height);
    if (base) {
      ctx.save();
      if (kind === 'polar' && dem && shade) {
        const cell = dem.meta.pixel_m * shade.stride;
        const topLeft = viewToScreen(view, dem.meta.x_min_m - cell / 2, dem.meta.y_max_m + cell / 2);
        const sizePx = shade.size * cell * view.scale;
        // Zoomed in to a few pixels a cell, show the cells as they are.
        ctx.imageSmoothingEnabled = cell * view.scale < 4;
        ctx.drawImage(base, topLeft.px, topLeft.py, sizePx, sizePx);
      } else {
        const tl = viewToScreen(view, -HALF_WORLD_KM, HALF_WORLD_KM / 2);
        const w = 2 * HALF_WORLD_KM * view.scale, h = HALF_WORLD_KM * view.scale;
        ctx.imageSmoothingEnabled = true;
        for (let k = Math.floor(-tl.px / w) - 1; tl.px + k * w < width; k++) {
          if (tl.px + (k + 1) * w < 0) continue;
          ctx.drawImage(base, tl.px + k * w, tl.py, w, h);
        }
      }
      ctx.restore();
    }
    if (kind === 'polar') drawPolarGrid(); else drawGlobalGrid();
    if (kind === 'global') {
      if (sunPoint) drawMarker(sunPoint, '--sun', 'Sun overhead');
      if (earthPoint) drawMarker(earthPoint, '--earth', 'Earth overhead');
    }
    for (const pin of pins) {
      const s = pinScreen(pin);
      if (s.px < -s.r || s.py < -s.r || s.px > width + s.r || s.py > height + s.r) continue;
      ctx.fillStyle = themeColor(pin.color); ctx.strokeStyle = themeColor('--bg'); ctx.lineWidth = 1;
      ctx.beginPath(); ctx.arc(s.px, s.py, s.r, 0, Math.PI * 2); ctx.fill(); ctx.stroke();
    }
  }

  function update(s: AppState): void {
    const sc = selected();
    const nextKind: Kind = s.dem && s.dem.covers(sc.site.lat, sc.site.lon) ? 'polar' : 'global';
    const key = `${sc.site.lat},${sc.site.lon}`;
    const changedFrame = !framed || dem !== s.dem || kind !== nextKind;
    const changedSite = siteKey !== key;
    if (kind !== nextKind) baseKey = '';
    dem = s.dem; kind = nextKind; siteKey = key;
    el.hidden = s.mode !== '2d';
    readTheme();
    // The light layer is rebuilt in the next frame, not here: a timeline drag sends many changes
    // between two frames, and only the last needs drawing.
    baseDirty = true;
    const scenarios = [s.live, ...s.pinned, ...(s.ghost ? [s.ghost] : [])];
    pins = [
      ...s.sites.map((site): Pin => ({ site, color: '--muted', big: false })),
      ...scenarios.map((x): Pin => ({ site: x.site, color: x.color, scenarioId: x.id, big: x.id === s.selectedId })),
    ];
    if (view.width > 1) {
      if (changedFrame) { framed = true; centre(); } else if (changedSite) follow();
    }
    invalidate();
  }

  /** A click: a pin under the pointer first (the nearest), else the ground under it. */
  function pick(px: number, py: number): void {
    let best: Pin | null = null, bestD = Infinity;
    for (const pin of pins) {
      const s = pinScreen(pin), d = Math.hypot(s.px - px, s.py - py);
      if (d <= s.r + 2 && d < bestD) { best = pin; bestD = d; }
    }
    if (best) {
      if (best.scenarioId && getState().pinned.some((p) => p.id === best.scenarioId)) select(best.scenarioId);
      else setLiveSite({ lat: best.site.lat, lon: best.site.lon });
      return;
    }
    const site = unproject(px, py);
    if (site) setLiveSite(site);
  }

  // Pointers: one drags (pans), two pinch (zoom). A press that barely moves is a click.
  const pointers = new Map<number, { x: number; y: number }>();
  let press: { id: number; x: number; y: number; moved: number } | null = null;
  const local = (e: PointerEvent | WheelEvent): { x: number; y: number } => {
    const rect = canvas.getBoundingClientRect();
    return { x: e.clientX - rect.left, y: e.clientY - rect.top };
  };
  const down = (e: PointerEvent): void => {
    if (e.pointerType === 'mouse' && e.button !== 0) return;
    canvas.setPointerCapture?.(e.pointerId);
    pointers.set(e.pointerId, local(e));
    press = pointers.size === 1 && e.isPrimary ? { id: e.pointerId, ...local(e), moved: 0 } : null;
  };
  const move = (e: PointerEvent): void => {
    const last = pointers.get(e.pointerId);
    if (!last) return;
    const now = local(e);
    if (pointers.size === 1) {
      view = panView(view, now.x - last.x, now.y - last.y);
      if (press) press.moved = Math.max(press.moved, Math.hypot(now.x - press.x, now.y - press.y));
    } else if (pointers.size === 2) {
      const [a, b] = [...pointers.entries()].map(([id, p]) => id === e.pointerId ? now : p);
      const [a0, b0] = [...pointers.values()];
      const before = Math.hypot(a0.x - b0.x, a0.y - b0.y), after = Math.hypot(a.x - b.x, a.y - b.y);
      const mid = { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 }, mid0 = { x: (a0.x + b0.x) / 2, y: (a0.y + b0.y) / 2 };
      view = panView(view, mid.x - mid0.x, mid.y - mid0.y);
      if (before > 0) view = zoomView(view, mid.x, mid.y, after / before, minScale, maxScale);
    }
    pointers.set(e.pointerId, now);
    invalidate();
  };
  const up = (e: PointerEvent): void => {
    const was = press;
    pointers.delete(e.pointerId);
    if (was && was.id === e.pointerId && was.moved <= CLICK_SLOP) { const p = local(e); pick(p.x, p.y); }
    if (!pointers.size || (was && was.id === e.pointerId)) press = null;
  };
  const cancel = (e: PointerEvent): void => { pointers.delete(e.pointerId); press = null; };
  const wheel = (e: WheelEvent): void => {
    e.preventDefault();
    const p = local(e);
    const lines = e.deltaMode === 1 ? 16 : e.deltaMode === 2 ? view.height : 1;
    view = zoomView(view, p.x, p.y, Math.exp((-e.deltaY * lines) / 600), minScale, maxScale);
    invalidate();
  };
  const key = (e: KeyboardEvent): void => {
    const stepPx = Math.min(view.width, view.height) / 8;
    const moves: Record<string, [number, number]> = { ArrowLeft: [stepPx, 0], ArrowRight: [-stepPx, 0], ArrowUp: [0, stepPx], ArrowDown: [0, -stepPx] };
    if (moves[e.key]) view = panView(view, ...moves[e.key]);
    else if (e.key === '+' || e.key === '=') view = zoomView(view, view.width / 2, view.height / 2, 1.5, minScale, maxScale);
    else if (e.key === '-' || e.key === '_') view = zoomView(view, view.width / 2, view.height / 2, 1 / 1.5, minScale, maxScale);
    else if (e.key === 'Enter' || e.key === ' ') pick(view.width / 2, view.height / 2);
    else return;
    e.preventDefault(); invalidate();
  };
  /** The scene's "Centre selected site" button sends this. */
  const onCentre = (): void => { if (view.width > 1) centre(); };

  canvas.addEventListener('pointerdown', down); canvas.addEventListener('pointermove', move);
  canvas.addEventListener('pointerup', up); canvas.addEventListener('pointercancel', cancel);
  canvas.addEventListener('wheel', wheel, { passive: false }); canvas.addEventListener('keydown', key);
  el.addEventListener('map:centre', onCentre);
  const observer = new ResizeObserver(resize); observer.observe(el);
  const themeObserver = new MutationObserver(() => { readTheme(); update(getState()); });
  themeObserver.observe(document.documentElement, { attributes: true, attributeFilter: ['class', 'style'] });
  const unsubscribe = subscribe(update);
  update(getState()); resize();

  function dispose(): void {
    if (disposed) return;
    disposed = true; cancelAnimationFrame(frame); unsubscribe(); observer.disconnect(); themeObserver.disconnect();
    canvas.removeEventListener('pointerdown', down); canvas.removeEventListener('pointermove', move);
    canvas.removeEventListener('pointerup', up); canvas.removeEventListener('pointercancel', cancel);
    canvas.removeEventListener('wheel', wheel); canvas.removeEventListener('keydown', key);
    el.removeEventListener('map:centre', onCentre);
    canvas.remove(); base = null; shade = null; mounts.delete(el);
  }
  mounts.set(el, dispose);
}
