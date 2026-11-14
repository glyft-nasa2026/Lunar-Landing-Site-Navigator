import {
  AmbientLight, CanvasTexture, Color, DirectionalLight, Group, Mesh, MeshBasicMaterial,
  MeshLambertMaterial, OrthographicCamera, PCFSoftShadowMap, PerspectiveCamera, Raycaster,
  Scene, SphereGeometry, Sprite, SpriteMaterial, SRGBColorSpace, Vector2, Vector3, WebGLRenderer,
  type Camera, type Material,
} from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import type { Dem } from '../core/dem';
import { MOON_RADIUS_KM, type Site } from '../core/types';
import { series } from '../core/windows';
import { getState, selected, select, setLiveSite, setMode, skylineFor, subscribe, type AppState } from '../state';
import { themeColor } from '../ui/plotTheme';
import { gridSite, moonDirection, sitePosition, sphereSite } from './coordinates';
import { detailBounds, recolorTerrain, terrainGeometry, type GridBounds } from './terrain';
import './scene.css';

const mounts = new WeakMap<HTMLElement, () => void>();

/** Stylised illustration; no geographic dataset or numerical result is generated here. */
function earthTexture(): CanvasTexture {
  const canvas = document.createElement('canvas');
  canvas.width = canvas.height = 128;
  const ctx = canvas.getContext('2d')!;
  ctx.fillStyle = themeColor('--earth');
  ctx.beginPath(); ctx.arc(64, 64, 61, 0, Math.PI * 2); ctx.fill();
  ctx.fillStyle = themeColor('--terrain-hi');
  for (const points of [
    [[24, 26], [50, 16], [61, 31], [48, 42], [55, 56], [35, 66], [19, 48]],
    [[44, 65], [62, 69], [66, 86], [48, 111], [40, 91]],
    [[79, 24], [102, 36], [109, 60], [96, 68], [81, 57], [72, 42]],
  ]) {
    ctx.beginPath(); points.forEach(([x, y], i) => i ? ctx.lineTo(x, y) : ctx.moveTo(x, y));
    ctx.closePath(); ctx.fill();
  }
  const texture = new CanvasTexture(canvas);
  texture.colorSpace = SRGBColorSpace;
  return texture;
}

export function mount(el: HTMLElement): void {
  mounts.get(el)?.();
  el.innerHTML = `
    <div class="scene-toolbar">
      <h2>Moon explorer</h2>
      <div class="scene-modes" role="group" aria-label="Map view">
        <button class="btn" type="button" data-mode="2d">2D map</button>
        <button class="btn" type="button" data-mode="3d">3D orbit</button>
      </div>
      <button class="btn scene-reset" type="button">Centre selected site</button>
      <label class="scene-stretch">Vertical stretch
        <input type="range" min="1" max="5" step="1" value="1" aria-label="Vertical stretch">
        <output>1×</output>
      </label>
    </div>
    <div class="scene-viewport"><p class="scene-message muted" role="status">Loading Sun and Earth table…</p></div>
    <p class="scene-help muted">Click to pick a site · drag to pan · scroll to zoom</p>
    <p class="scene-caption muted">Lighting illustrates the terrain; use the readout for visibility.</p>`;
  const viewport = el.querySelector<HTMLDivElement>('.scene-viewport')!;
  const message = el.querySelector<HTMLParagraphElement>('.scene-message')!;
  const help = el.querySelector<HTMLParagraphElement>('.scene-help')!;
  const caption = el.querySelector<HTMLParagraphElement>('.scene-caption')!;
  const slider = el.querySelector<HTMLInputElement>('input')!;
  const output = el.querySelector<HTMLOutputElement>('output')!;
  const reset = el.querySelector<HTMLButtonElement>('.scene-reset')!;
  const buttons = [...el.querySelectorAll<HTMLButtonElement>('[data-mode]')];
  let renderer: WebGLRenderer;
  try { renderer = new WebGLRenderer({ antialias: true }); }
  catch {
    message.textContent = 'The Moon explorer needs WebGL. Try a browser with hardware acceleration enabled.';
    slider.disabled = reset.disabled = true;
    buttons.forEach((b) => { b.disabled = true; });
    return;
  }
  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
  renderer.shadowMap.enabled = true; renderer.shadowMap.type = PCFSoftShadowMap;
  const canvas = renderer.domElement;
  canvas.className = 'scene-canvas'; canvas.tabIndex = 0;
  canvas.setAttribute('aria-label', 'Interactive Moon terrain. Click to select a site; use the site list for keyboard selection.');
  viewport.prepend(canvas);
  const world = new Scene();
  const mapCamera = new OrthographicCamera(-1, 1, 1, -1, 0.01, 20_000);
  const orbitCamera = new PerspectiveCamera(45, 1, 0.02, 30_000);
  mapCamera.up.set(0, 0, -1);
  const mapControls = new OrbitControls(mapCamera, canvas);
  const orbitControls = new OrbitControls(orbitCamera, canvas);
  mapControls.enableRotate = false; mapControls.screenSpacePanning = true;
  mapControls.minZoom = 0.1; mapControls.maxZoom = 200;
  orbitControls.minDistance = 0.2; orbitControls.maxDistance = 12_000;
  let frame = 0, disposed = false, lost = false;
  let mode: AppState['mode'] = getState().mode;
  let polar = false, stretch = 1, span = 150;
  let dem: Dem | null = null, coarse: Mesh | null = null, detail: Mesh | null = null;
  let bounds: GridBounds | undefined, siteKey = '', terrainKey = '', themeKey = '';
  const target = new Vector3();
  const sun = new DirectionalLight(); sun.intensity = 3; sun.castShadow = true;
  sun.shadow.mapSize.set(2048, 2048); sun.shadow.bias = -0.00001; sun.shadow.normalBias = 0.002;
  sun.shadow.camera.near = 1; sun.shadow.camera.far = 4000;
  world.add(sun, sun.target);
  const ambient = new AmbientLight(); ambient.intensity = 0.07; world.add(ambient);
  const terrainMaterial = new MeshLambertMaterial({ vertexColors: true });
  const detailMaterial = terrainMaterial.clone();
  const globeMaterial = new MeshLambertMaterial();
  const globe = new Mesh(new SphereGeometry(MOON_RADIUS_KM, 96, 64), globeMaterial);
  globe.position.y = -MOON_RADIUS_KM; world.add(globe);
  const earthMaterial = new SpriteMaterial({ map: earthTexture(), depthTest: true });
  const earth = new Sprite(earthMaterial); earth.name = 'Earth'; world.add(earth);
  const pins = new Group(); world.add(pins);
  const pinGeometry = new SphereGeometry(1, 12, 8);
  const raycaster = new Raycaster(), pointer = new Vector2();
  let pointerDown: { x: number; y: number; id: number } | null = null, maxDrag = 0;
  const activeCamera = (): Camera => mode === '2d' ? mapCamera : orbitCamera;
  const activeControls = (): OrbitControls => mode === '2d' ? mapControls : orbitControls;

  // No continuous animation while idle. Controls, state changes and resize schedule a frame.
  function invalidate(): void {
    if (frame || disposed || lost) return;
    frame = requestAnimationFrame(() => {
      frame = 0;
      if (!disposed && !lost) renderer.render(world, activeCamera());
    });
  }
  mapControls.addEventListener('change', invalidate); orbitControls.addEventListener('change', invalidate);
  function resize(): void {
    const width = viewport.clientWidth, height = viewport.clientHeight;
    if (!width || !height) return;
    renderer.setSize(width, height, false);
    const aspect = width / height;
    mapCamera.left = -span * aspect; mapCamera.right = span * aspect;
    mapCamera.top = span; mapCamera.bottom = -span; mapCamera.updateProjectionMatrix();
    orbitCamera.aspect = aspect; orbitCamera.updateProjectionMatrix(); invalidate();
  }
  function centre(): void {
    mapCamera.zoom = 1; mapControls.target.copy(target); orbitControls.target.copy(target);
    if (polar) {
      span = Math.max(8, Math.min(80, (dem?.meta.size ?? 634) * (dem?.meta.pixel_m ?? 960) / 8000));
      mapCamera.up.set(0, 0, -1); mapCamera.position.copy(target).add(new Vector3(0, 2000, 0));
      orbitCamera.up.set(0, 1, 0);
      orbitCamera.position.copy(target).add(new Vector3(span * 0.6, span * 0.9, span * 1.1));
      orbitControls.maxPolarAngle = Math.PI * 0.49;
    } else {
      span = MOON_RADIUS_KM * 1.15;
      const normal = target.clone().sub(globe.position).normalize();
      const north = new Vector3(0, -1, 0).addScaledVector(normal, normal.y).normalize();
      if (north.lengthSq() < 0.5) north.set(0, 0, -1);
      mapCamera.up.copy(north); orbitCamera.up.copy(north);
      mapCamera.position.copy(target).addScaledVector(normal, MOON_RADIUS_KM * 3);
      orbitCamera.position.copy(target).addScaledVector(normal, MOON_RADIUS_KM * 2.5);
      orbitControls.maxPolarAngle = Math.PI;
    }
    mapCamera.lookAt(target); orbitCamera.lookAt(target);
    mapControls.update(); orbitControls.update(); resize();
  }
  function clearTerrain(): void {
    for (const mesh of [coarse, detail]) if (mesh) { world.remove(mesh); mesh.geometry.dispose(); }
    coarse = detail = null;
  }
  function updateTerrain(): void {
    clearTerrain();
    if (!dem || !polar) return;
    const low = new Color(themeColor('--terrain-lo')), high = new Color(themeColor('--terrain-hi'));
    bounds = detailBounds(dem, selected().site);
    const geometry = terrainGeometry(dem, low, high, stretch, undefined, bounds);
    coarse = new Mesh(geometry, terrainMaterial);
    detail = new Mesh(terrainGeometry(dem, low, high, stretch, bounds), detailMaterial);
    recolorTerrain(detail.geometry, low, high, geometry.userData.heightRange as number[]);
    for (const mesh of [coarse, detail]) { mesh.castShadow = mesh.receiveShadow = true; world.add(mesh); }
  }
  function clearPins(): void {
    for (const obj of [...pins.children]) { ((obj as Mesh).material as Material).dispose(); pins.remove(obj); }
  }
  function updatePins(s: AppState): void {
    clearPins();
    const addPin = (site: Site, color: string, label: string, id?: string): void => {
      if (polar && (!dem?.covers(site.lat, site.lon) || site.lat > -80)) return;
      const chosen = id === s.selectedId;
      const radius = polar ? Math.max(0.12, span * 0.012) : MOON_RADIUS_KM * 0.015;
      const pin = new Mesh(pinGeometry, new MeshBasicMaterial({ color: themeColor(color) }));
      pin.position.copy(sitePosition(site, polar ? dem!.heightAt(site.lat, site.lon) : 0, stretch));
      const up = pin.position.clone().sub(globe.position).normalize();
      pin.position.addScaledVector(up, radius * (chosen ? 1.6 : 1));
      pin.scale.setScalar(radius * (chosen ? 1.6 : 1));
      pin.userData = { site, scenarioId: id, label }; pins.add(pin);
    };
    s.sites.forEach((site) => addPin(site, '--muted', site.name));
    [s.live, ...s.pinned, ...(s.ghost ? [s.ghost] : [])].forEach((sc) => addPin(sc.site, sc.color, sc.label, sc.id));
  }
  function update(s: AppState): void {
    const sc = selected();
    const nextPolar = !!s.dem && sc.site.lat <= -80 && s.dem.covers(sc.site.lat, sc.site.lon);
    const changedDem = dem !== s.dem, changedSite = siteKey !== `${sc.site.lat},${sc.site.lon}`;
    const changedView = polar !== nextPolar, changedMode = mode !== s.mode;
    dem = s.dem; polar = nextPolar; mode = s.mode; siteKey = `${sc.site.lat},${sc.site.lon}`;
    target.copy(sitePosition(sc.site, polar ? dem!.heightAt(sc.site.lat, sc.site.lon) : 0, stretch));
    globe.visible = !polar; slider.disabled = !polar;
    for (const button of buttons) {
      const active = button.dataset.mode === mode;
      button.classList.toggle('btn-primary', active); button.setAttribute('aria-pressed', String(active));
    }
    mapControls.enabled = mode === '2d'; orbitControls.enabled = mode === '3d';
    if (changedSite || changedView || changedDem) centre();
    else if (changedMode) {
      const controls = activeControls(), delta = target.clone().sub(controls.target);
      controls.object.position.add(delta); controls.target.copy(target); controls.update();
    }
    const nextTerrainKey = `${siteKey}|${stretch}|${polar}`;
    if (changedDem || nextTerrainKey !== terrainKey) { terrainKey = nextTerrainKey; updateTerrain(); }
    updatePins(s);
    sun.target.position.copy(target);
    if (s.eph) {
      const vectors = s.eph.vectorsAt(sc.tMs);
      sun.position.copy(target).addScaledVector(moonDirection(vectors.sun), 2000); sun.intensity = 3;
      const half = polar ? Math.max(25, ((bounds?.col1 ?? 0) - (bounds?.col0 ?? 0)) * (dem?.meta.pixel_m ?? 0) / 1500) : MOON_RADIUS_KM * 1.2;
      const camera = sun.shadow.camera;
      camera.left = camera.bottom = -half; camera.right = camera.top = half; camera.updateProjectionMatrix();
      sun.castShadow = polar;
      // Topocentric Earth direction: translate the geocentric vector before normalising it.
      const earthAt = moonDirection(vectors.earthKm); earthAt.y -= MOON_RADIUS_KM;
      earth.position.copy(target).addScaledVector(earthAt.sub(target).normalize(), polar ? 350 : 6500);
      earth.scale.setScalar(polar ? 5 : 120); earth.visible = true;
    } else { sun.intensity = 0; earth.visible = false; }
    message.hidden = !!s.eph; message.textContent = 'Loading Sun and Earth table…';
    const ground = dem?.heightAt(sc.site.lat, sc.site.lon) ?? 0;
    const sample = s.eph ? series(s.eph, sc.site, ground, skylineFor(sc), sc.tMs, sc.tMs + 1, 1)[0] : undefined;
    const mock = dem?.meta.source === 'mock' || s.eph?.meta.source === 'mock';
    caption.textContent = [mock ? 'Mock data' : '', polar ? 'South-pole terrain' : (dem ? 'Moon globe · outside terrain coverage' : 'Moon globe · Loading height map'),
      sample ? (sample.sunFrac > 0 ? 'Sun visible' : 'Sun hidden') : '',
      stretch > 1 && polar ? 'Heights exaggerated; shadows are illustrative' : 'Lighting is illustrative; use the readout for visibility'].filter(Boolean).join(' · ');
    help.textContent = mode === '2d' ? 'Click to pick a site · drag to pan · scroll to zoom' : 'Click to pick a site · drag to orbit · right-drag to pan · scroll to zoom';
    invalidate();
  }
  function updateTheme(): void {
    const key = ['--bg', '--text', '--terrain-lo', '--terrain-hi', '--earth', '--muted', '--accent', '--scn-a', '--scn-b', '--scn-c', '--scn-ghost'].map(themeColor).join('|');
    if (key === themeKey) return;
    themeKey = key; world.background = new Color(themeColor('--bg'));
    sun.color.set(themeColor('--text')); ambient.color.set(themeColor('--text')); globeMaterial.color.set(themeColor('--terrain-hi'));
    const old = earthMaterial.map; earthMaterial.map = earthTexture(); old?.dispose();
    terrainKey = ''; update(getState());
  }
  function pick(event: PointerEvent): void {
    const start = pointerDown; pointerDown = null;
    if (!start || start.id !== event.pointerId || maxDrag > 5 || event.button !== 0 || lost) return;
    const rect = canvas.getBoundingClientRect(); if (!rect.width || !rect.height) return;
    pointer.set((event.clientX - rect.left) / rect.width * 2 - 1, -(event.clientY - rect.top) / rect.height * 2 + 1);
    world.updateMatrixWorld(true); activeCamera().updateMatrixWorld(true); raycaster.setFromCamera(pointer, activeCamera());
    const surface = raycaster.intersectObjects(polar ? [detail!, coarse!].filter(Boolean) : [globe])[0];
    const pin = raycaster.intersectObjects(pins.children).find((hit) => !surface || hit.distance <= surface.distance + 0.01);
    if (pin) {
      const data = pin.object.userData;
      if (data.scenarioId && getState().pinned.some((p) => p.id === data.scenarioId)) select(data.scenarioId as string);
      else setLiveSite(data.site as Site);
    } else if (surface) {
      const site = polar && surface.uv && dem ? gridSite(dem.meta, surface.uv.x * (dem.meta.size - 1), surface.uv.y * (dem.meta.size - 1)) : sphereSite(surface.point);
      if (!polar || dem?.covers(site.lat, site.lon)) setLiveSite(site);
    }
  }
  const down = (event: PointerEvent): void => {
    if (pointerDown || !event.isPrimary || event.button !== 0) { pointerDown = null; return; }
    pointerDown = { x: event.clientX, y: event.clientY, id: event.pointerId }; maxDrag = 0;
  };
  const move = (event: PointerEvent): void => { if (pointerDown) maxDrag = Math.max(maxDrag, Math.hypot(event.clientX - pointerDown.x, event.clientY - pointerDown.y)); };
  const cancel = (): void => { pointerDown = null; };
  const onLost = (event: Event): void => { event.preventDefault(); lost = true; message.hidden = false; message.textContent = 'Graphics paused. Waiting for the browser to restore the Moon explorer…'; };
  const onRestored = (): void => { lost = false; update(getState()); };
  canvas.addEventListener('pointerdown', down); canvas.addEventListener('pointermove', move);
  canvas.addEventListener('pointerup', pick); canvas.addEventListener('pointercancel', cancel);
  canvas.addEventListener('webglcontextlost', onLost); canvas.addEventListener('webglcontextrestored', onRestored);
  const changeMode = (event: Event): void => setMode((event.currentTarget as HTMLButtonElement).dataset.mode as AppState['mode']);
  buttons.forEach((b) => b.addEventListener('click', changeMode));
  const onStretch = (): void => { stretch = Number(slider.value); output.value = `${stretch}×`; update(getState()); centre(); };
  slider.addEventListener('input', onStretch); reset.addEventListener('click', centre);
  const observer = new ResizeObserver(resize); observer.observe(viewport);
  const themeObserver = new MutationObserver(updateTheme);
  themeObserver.observe(document.documentElement, { attributes: true, attributeFilter: ['class', 'style'] });
  const unsubscribe = subscribe(update);
  updateTheme(); resize();
  function dispose(): void {
    if (disposed) return;
    disposed = true; cancelAnimationFrame(frame); unsubscribe(); observer.disconnect(); themeObserver.disconnect();
    mapControls.dispose(); orbitControls.dispose(); clearTerrain(); clearPins();
    pinGeometry.dispose(); globe.geometry.dispose(); globeMaterial.dispose(); terrainMaterial.dispose(); detailMaterial.dispose();
    earthMaterial.map?.dispose(); earthMaterial.dispose(); sun.dispose(); renderer.dispose(); canvas.remove();
    canvas.removeEventListener('pointerdown', down); canvas.removeEventListener('pointermove', move);
    canvas.removeEventListener('pointerup', pick); canvas.removeEventListener('pointercancel', cancel);
    canvas.removeEventListener('webglcontextlost', onLost); canvas.removeEventListener('webglcontextrestored', onRestored);
    slider.removeEventListener('input', onStretch); reset.removeEventListener('click', centre);
    buttons.forEach((b) => b.removeEventListener('click', changeMode)); window.removeEventListener('pagehide', onPageHide); mounts.delete(el);
  }
  function onPageHide(event: PageTransitionEvent): void { if (!event.persisted) dispose(); }
  window.addEventListener('pagehide', onPageHide); mounts.set(el, dispose);
}
