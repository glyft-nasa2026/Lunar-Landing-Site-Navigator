import {
  AmbientLight, Box3, CanvasTexture, Color, DirectionalLight, Group, Mesh, MeshBasicMaterial,
  MeshLambertMaterial, ObjectSpaceNormalMap, PCFShadowMap, PerspectiveCamera, Raycaster,
  Scene, SphereGeometry, Sprite, SpriteMaterial, SRGBColorSpace, Vector2, Vector3, WebGLRenderer,
  type Material,
} from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import type { Dem } from '../core/dem';
import { MOON_RADIUS_KM, type Sample, type Site } from '../core/types';
import {
  getState, samplesFor, select, selected, setLiveSite, setMode, subscribe, type AppState,
} from '../state';
import { themeColor } from '../ui/plotTheme';
import { mount as mountMap, unmount as unmountMap } from '../map';
import { gridSite, moonCentre, moonDirection, sitePosition, siteUp, sphereSite } from './coordinates';
import {
  detailBounds, edgeHeight, globeGeometry, northGeometry, recolorTerrain, setTerrainHole, terrainGeometry, type GridBounds,
} from './terrain';
import { colorTexture, loadGlobe, loadNorth, normalTexture, type GlobeHeights } from './globe';
import './scene.css';

const mounts = new WeakMap<HTMLElement, () => void>();
const RAD = Math.PI / 180;
/** Sets only the drawn size of the Earth sprite. No number shown to the user depends on it. */
const EARTH_RADIUS_KM = 6371;
/** The Earth sprite is drawn this far from the site, scaled to its true apparent size. */
const EARTH_DRAWN_KM = 20_000;

type PinData = { site: Site; scenarioId?: string; label: string; base: Vector3; up: Vector3; scale: number };

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

/** A theme length in CSS pixels, so the pin size comes from theme.css rather than from here. */
function themeLength(host: HTMLElement, name: string): number {
  const probe = document.createElement('div');
  probe.style.position = 'absolute'; probe.style.visibility = 'hidden'; probe.style.width = `var(${name})`;
  host.append(probe);
  const px = probe.getBoundingClientRect().width;
  probe.remove();
  return px;
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
    <div class="scene-viewport"><p class="scene-message muted" role="status">Loading Sun and Earth table…</p><section id="nudge" aria-label="Nudge"></section></div>
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
  // The 2D map is a flat canvas of its own (web/src/map/, T31), shown in place of the 3D canvas in
  // 2D mode. It needs no WebGL, so it works even where the 3D scene can't.
  const mapHost = document.createElement('div');
  viewport.prepend(mapHost); mountMap(mapHost);
  const centreMap = (): void => { mapHost.dispatchEvent(new Event('map:centre')); };
  let renderer: WebGLRenderer;
  try { renderer = new WebGLRenderer({ antialias: true }); }
  catch {
    // No 3D: keep the flat map, switch to it, and say why the 3D button is off.
    const only2d = buttons.find((b) => b.dataset.mode === '2d')!;
    for (const b of buttons) {
      const is2d = b === only2d;
      b.disabled = !is2d; b.classList.toggle('btn-primary', is2d); b.setAttribute('aria-pressed', String(is2d));
    }
    slider.disabled = true;
    help.textContent = 'The 3D view needs WebGL, which this browser has switched off · Click to pick a site · drag to pan · scroll to zoom';
    caption.textContent = 'Lighting is illustrative; use the readout for visibility';
    message.hidden = true;
    reset.addEventListener('click', centreMap);
    if (getState().mode !== '2d') setMode('2d');
    mounts.set(el, () => { reset.removeEventListener('click', centreMap); unmountMap(mapHost); mounts.delete(el); });
    return;
  }
  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
  renderer.shadowMap.enabled = true; renderer.shadowMap.type = PCFShadowMap;
  const canvas = renderer.domElement;
  canvas.className = 'scene-canvas'; canvas.tabIndex = 0;
  canvas.setAttribute('aria-label', 'Interactive Moon terrain. Click to select a site; use the site list for keyboard selection.');
  viewport.prepend(canvas);

  let frame = 0, disposed = false, lost = false, framed = false;
  let mode: AppState['mode'] = getState().mode;
  let polar = false, stretch = 1, drawnStretch = 1, pinPx = 1, orbitGlobe = false;
  let dem: Dem | null = null, coarse: Mesh | null = null, detail: Mesh | null = null;
  let bounds: GridBounds | undefined;
  let siteKey = '', coarseKey = '', detailKey = '', pinKey = '', themeKey = '', globeKey = '';
  /** The whole-Moon heights the globe is painted from. Null until they load, or if they are missing. */
  let globeHeights: GlobeHeights | null = null;
  /** The north cap: its heights (latitudes negated, see parseNorth) and its mesh. */
  let north: Dem | null = null, northMesh: Mesh | null = null, northKey = '', northRelief = 0;
  let pinSites: AppState['sites'] | null = null, pinDem: Dem | null = null;
  /** Highest drawn terrain above the sphere, in km, so the near plane never cuts a peak. */
  let relief = 0;
  /** The selected site on the drawn surface. */
  const target = new Vector3();
  /** Everything the terrain meshes draw, so the Sun's shadow box can be fitted to it. */
  const terrainBox = new Box3(), shadowBox = new Box3();

  const world = new Scene();
  // Only the orbit view is 3D. The 2D map is web/src/map/ (T31): the 3D scene draws nothing in 2D mode.
  const orbitCamera = new PerspectiveCamera(45, 1, 0.02, 60_000);
  let orbitControls = makeOrbitControls(false, new Vector3(0, 1, 0));
  const sun = new DirectionalLight(); sun.intensity = 3; sun.castShadow = true;
  sun.shadow.mapSize.set(2048, 2048); sun.shadow.bias = -0.00001; sun.shadow.normalBias = 0.002;
  sun.shadow.camera.near = 1; sun.shadow.camera.far = 4000;
  world.add(sun, sun.target);
  // A faint fill, so ground in shadow still shows its shape (through the height colours) instead of
  // matching the background; a shadowed crater floor stays dark. Illustrative, like the shadows.
  const ambient = new AmbientLight(); ambient.intensity = 0.3; world.add(ambient);
  const terrainMaterial = new MeshLambertMaterial({ vertexColors: true });
  const detailMaterial = terrainMaterial.clone();
  // The globe is always drawn, with the terrain set into its south cap. Pushed back in depth so
  // the terrain wins where the two overlap at the cap's edge.
  const globeMaterial = new MeshLambertMaterial({ polygonOffset: true, polygonOffsetFactor: 1, polygonOffsetUnits: 1 });
  const globe = new Mesh(globeGeometry(null), globeMaterial);
  globe.position.copy(moonCentre()); world.add(globe);
  const earthMaterial = new SpriteMaterial({ map: earthTexture(), depthTest: true });
  const earth = new Sprite(earthMaterial); earth.name = 'Earth'; world.add(earth);
  const pins = new Group(); world.add(pins);
  const pinGeometry = new SphereGeometry(1, 12, 8);
  const raycaster = new Raycaster(), pointer = new Vector2();
  let pointerDown: { x: number; y: number; id: number } | null = null, maxDrag = 0;

  /**
   * OrbitControls takes its orbit axis from camera.up once, when it is created, so each view
   * gets new controls. Terrain view: orbit around the site, never below its horizon. Globe view:
   * turn the whole Moon around its centre, with north up.
   */
  function makeOrbitControls(globeView: boolean, up: Vector3): OrbitControls {
    orbitCamera.up.copy(up);
    const controls = new OrbitControls(orbitCamera, canvas);
    controls.addEventListener('change', onOrbitChange);
    controls.enablePan = !globeView;
    controls.minDistance = globeView ? MOON_RADIUS_KM * 1.02 : 0.2;
    controls.maxDistance = MOON_RADIUS_KM * (globeView ? 8 : 6);
    controls.maxPolarAngle = globeView ? Math.PI : Math.PI * 0.49;
    controls.enabled = mode === '3d';
    orbitGlobe = globeView;
    return controls;
  }
  function onOrbitChange(): void {
    if (orbitGlobe) {
      // Turn the Moon about as fast as the ground under the cursor moves, at any height. The
      // controls turn 2π per canvas height; the ground moves 2 h tan(fov/2) / R per canvas height.
      const height = orbitCamera.position.distanceTo(globe.position) - MOON_RADIUS_KM;
      const speed = height * Math.tan(orbitCamera.fov * RAD / 2) / (Math.PI * MOON_RADIUS_KM);
      orbitControls.rotateSpeed = Math.min(1, Math.max(0.002, speed));
    }
    invalidate();
  }

  /** Pins keep the same size on screen at every zoom, sitting on the surface. */
  function sizePins(): void {
    const height = viewport.clientHeight || 1;
    for (const pin of pins.children) {
      const { base, up, scale } = pin.userData as PinData;
      const perPx = 2 * Math.tan(orbitCamera.fov * RAD / 2) * orbitCamera.position.distanceTo(base) / height;
      const r = pinPx * scale * perPx;
      pin.scale.setScalar(r);
      pin.position.copy(base).addScaledVector(up, r);
    }
  }
  function render(): void {
    // In 2D the flat map shows instead: nothing is drawn here, so no shadow map is rendered.
    if (mode === '2d') return;
    // The camera moves from metres above a crater to beyond the whole Moon: keep the depth
    // range tight around what can be seen, or near surfaces fight and far ones vanish.
    const fromCentre = orbitCamera.position.distanceTo(globe.position);
    orbitCamera.near = Math.min(1000, Math.max(0.005, (fromCentre - MOON_RADIUS_KM - Math.max(relief, northRelief)) / 2));
    orbitCamera.far = fromCentre + MOON_RADIUS_KM + EARTH_DRAWN_KM * 1.1;
    orbitCamera.updateProjectionMatrix();
    sizePins();
    fitShadow();
    renderer.render(world, orbitCamera);
  }
  /**
   * three.js leaves everything outside the Sun's shadow box unshadowed, which drew straight-edged
   * lit bands across dark ground. The box covers the whole terrain, because a peak far off screen
   * can still cast a shadow into view.
   */
  function fitShadow(): void {
    if (!sun.castShadow || !coarse || terrainBox.isEmpty()) return;
    const light = sun.shadow.camera;
    light.position.copy(sun.position); light.lookAt(sun.target.position); light.updateMatrixWorld();
    const box = shadowBox.copy(terrainBox).applyMatrix4(light.matrixWorldInverse);
    light.left = box.min.x; light.right = box.max.x; light.bottom = box.min.y; light.top = box.max.y;
    // The light looks down its -Z axis.
    light.near = Math.max(0.01, -box.max.z - 1); light.far = -box.min.z + 1;
    light.updateProjectionMatrix();
    // Depth bias stays about 40 m whatever the box's depth; the normal offset follows the texel size.
    sun.shadow.bias = -0.04 / (light.far - light.near);
    sun.shadow.normalBias = Math.max(0.002, (box.max.y - box.min.y) / sun.shadow.mapSize.y);
  }
  // No continuous animation while idle. Controls, state changes and resize schedule a frame.
  function invalidate(): void {
    if (frame || disposed || lost) return;
    frame = requestAnimationFrame(() => {
      frame = 0;
      if (!disposed && !lost) render();
    });
  }
  function resize(): void {
    const width = viewport.clientWidth, height = viewport.clientHeight;
    if (!width || !height) return;
    renderer.setSize(width, height, false);
    const aspect = width / height;
    orbitCamera.aspect = aspect; orbitCamera.updateProjectionMatrix(); invalidate();
  }
  /** Resets the orbit camera, and the flat map, to their starting view of the selected site. */
  function centre(): void {
    const up = siteUp(selected().site);
    orbitControls.dispose();
    if (polar && dem) {
      const span = Math.max(8, Math.min(80, dem.meta.size * dem.meta.pixel_m / 8000));
      orbitControls = makeOrbitControls(false, up);
      orbitControls.target.copy(target);
      orbitCamera.position.copy(target).add(new Vector3(span * 0.6, span * 0.9, span * 1.1));
    } else {
      orbitControls = makeOrbitControls(true, new Vector3(0, -1, 0));
      orbitControls.target.copy(globe.position);
      orbitCamera.position.copy(globe.position).addScaledVector(up, MOON_RADIUS_KM * 3.5);
    }
    orbitCamera.lookAt(orbitControls.target); orbitControls.update(); onOrbitChange();
    centreMap(); resize();
  }
  /** Brings the selected site back to the middle of the orbit view, keeping zoom and viewing angle. The map follows by itself. */
  function follow(): void {
    if (orbitGlobe) {
      const distance = orbitCamera.position.distanceTo(globe.position);
      orbitCamera.position.copy(globe.position).addScaledVector(siteUp(selected().site), distance);
    } else {
      orbitCamera.position.add(target.clone().sub(orbitControls.target));
      orbitControls.target.copy(target);
    }
    orbitControls.update(); invalidate();
  }
  function clearTerrain(): void {
    for (const mesh of [coarse, detail]) if (mesh) { world.remove(mesh); mesh.geometry.dispose(); }
    coarse = detail = null; coarseKey = detailKey = ''; relief = 0; bounds = undefined;
    terrainBox.makeEmpty();
  }
  /**
   * The whole region is built once per height map, stretch and theme, and shown in every view.
   * A new site only rebuilds the small native patch and moves the hole under it.
   */
  function updateTerrain(changedDem: boolean): void {
    if (changedDem) {
      clearTerrain();
      const old = globe.geometry; globe.geometry = globeGeometry(dem?.meta, north?.meta); old.dispose();
    }
    if (!dem) return;
    const low = new Color(themeColor('--terrain-lo')), high = new Color(themeColor('--terrain-hi'));
    const nextCoarse = `${stretch}|${themeKey}`;
    if (!coarse || coarseKey !== nextCoarse) {
      if (coarse) { world.remove(coarse); coarse.geometry.dispose(); }
      coarse = new Mesh(terrainGeometry(dem, low, high, stretch), terrainMaterial);
      coarse.castShadow = coarse.receiveShadow = true; world.add(coarse);
      coarse.geometry.computeBoundingBox();
      coarseKey = nextCoarse; detailKey = '';
      const [min, max] = coarse.geometry.userData.heightRange as number[];
      relief = Math.max(0, max) * stretch / 1000;
      // The sphere outside the height map takes the colour of the ground along the map's edge.
      const edge = (edgeHeight(coarse.geometry) - min) / Math.max(1, max - min);
      globeMaterial.color.copy(low).lerp(high, Math.max(0, Math.min(1, edge)));
    }
    const nextDetail = polar ? `${siteKey}|${coarseKey}` : 'none';
    if (detailKey === nextDetail) return;
    detailKey = nextDetail;
    if (detail) { world.remove(detail); detail.geometry.dispose(); detail = null; }
    bounds = polar ? detailBounds(dem, selected().site) : undefined;
    setTerrainHole(coarse.geometry, bounds);
    terrainBox.copy(coarse.geometry.boundingBox!);
    if (!bounds) return;
    detail = new Mesh(terrainGeometry(dem, low, high, stretch, bounds), detailMaterial);
    recolorTerrain(detail.geometry, low, high, coarse.geometry.userData.heightRange as number[]);
    detail.geometry.computeBoundingBox(); terrainBox.union(detail.geometry.boundingBox!);
    detail.castShadow = detail.receiveShadow = true; world.add(detail);
  }
  /**
   * Paints the globe with the whole Moon's heights (issue #66), on the terrain's colour ramp and
   * range so no ring shows where the height map stops. Without them it stays a plain sphere.
   */
  function paintGlobe(): void {
    if (!globeHeights) return;
    // The texture carries the colour; the material's own would tint it.
    globeMaterial.color.set(0xffffff);
    const range = (coarse?.geometry.userData.heightRange as number[] | undefined) ?? globeHeights.range;
    const key = `${themeKey}|${range.join(',')}`;
    if (northMesh && northKey !== key) {
      northKey = key;
      recolorTerrain(northMesh.geometry,
        new Color(themeColor('--terrain-lo')), new Color(themeColor('--terrain-hi')), range);
    }
    if (key === globeKey) return;
    globeKey = key;
    const old = globeMaterial.map;
    globeMaterial.map = colorTexture(globeHeights,
      new Color(themeColor('--terrain-lo')), new Color(themeColor('--terrain-hi')), range);
    old?.dispose();
    if (!globeMaterial.normalMap) {
      globeMaterial.normalMap = normalTexture(globeHeights);
      globeMaterial.normalMapType = ObjectSpaceNormalMap;
    }
    globeMaterial.needsUpdate = true;
  }
  /**
   * The cap north of 80 N is a mesh on a square polar grid, like the south-pole terrain: the
   * globe's latitude-longitude texture pinches together at a pole. Drawn only on a painted globe.
   */
  function buildNorth(): void {
    if (!north || !globeHeights || northMesh) return;
    const geometry = northGeometry(north, new Color(themeColor('--terrain-lo')), new Color(themeColor('--terrain-hi')));
    northMesh = new Mesh(geometry, terrainMaterial); world.add(northMesh);
    northRelief = Math.max(0, (geometry.userData.heightRange as number[])[1]) / 1000;
    const old = globe.geometry; globe.geometry = globeGeometry(dem?.meta, north.meta); old.dispose();
    northKey = ''; pinKey = '';
  }
  function clearPins(): void {
    for (const obj of [...pins.children]) { ((obj as Mesh).material as Material).dispose(); pins.remove(obj); }
  }
  function updatePins(s: AppState): void {
    const scenarios = [s.live, ...s.pinned, ...(s.ghost ? [s.ghost] : [])];
    const key = [themeKey, stretch, s.selectedId,
      ...scenarios.map((sc) => `${sc.id} ${sc.color} ${sc.label} ${sc.site.lat} ${sc.site.lon}`)].join('|');
    // Scrubbing time changes none of this, so the pins aren't rebuilt at every step of a drag.
    if (key === pinKey && pinSites === s.sites && pinDem === dem) return;
    pinKey = key; pinSites = s.sites; pinDem = dem;
    clearPins();
    const addPin = (site: Site, color: string, label: string, id?: string): void => {
      const height = dem?.covers(site.lat, site.lon) ? dem.heightAt(site.lat, site.lon)
        : northMesh && north?.covers(-site.lat, site.lon) ? north.heightAt(-site.lat, site.lon) : 0;
      const pin = new Mesh(pinGeometry, new MeshBasicMaterial({ color: themeColor(color) }));
      const data: PinData = {
        site, scenarioId: id, label, base: sitePosition(site, height, stretch), up: siteUp(site),
        scale: id !== undefined && id === s.selectedId ? 1.6 : 1,
      };
      pin.userData = data; pins.add(pin);
    };
    s.sites.forEach((site) => addPin(site, '--muted', site.name));
    scenarios.forEach((sc) => addPin(sc.site, sc.color, sc.label, sc.id));
  }
  function update(s: AppState): void {
    const sc = selected();
    const nextPolar = !!s.dem && s.dem.covers(sc.site.lat, sc.site.lon);
    const key = `${sc.site.lat},${sc.site.lon}`;
    const changedDem = dem !== s.dem, changedView = polar !== nextPolar, changedSite = siteKey !== key;
    const changedMode = mode !== s.mode, changedStretch = drawnStretch !== stretch;
    dem = s.dem; polar = nextPolar; mode = s.mode; siteKey = key; drawnStretch = stretch;
    target.copy(sitePosition(sc.site, polar && dem ? dem.heightAt(sc.site.lat, sc.site.lon) : 0, stretch));
    updateTerrain(changedDem);
    paintGlobe();
    // Stretch is drawn only in 3D; the flat map shows heights as colours.
    slider.disabled = !polar || mode === '2d';
    // scene.css gives the canvas display: block, which the hidden attribute would not override.
    canvas.style.display = mode === '2d' ? 'none' : '';
    for (const button of buttons) {
      const active = button.dataset.mode === mode;
      button.classList.toggle('btn-primary', active); button.setAttribute('aria-pressed', String(active));
    }
    orbitControls.enabled = mode === '3d';
    if (!framed || changedDem || changedView) { framed = true; centre(); }
    else if (changedSite || changedMode || changedStretch) follow();
    updatePins(s);
    sun.target.position.copy(target);
    // vectorsAt answers a time it has no row for (outside 1900-2100, or in a decade that failed
    // to download) with the nearest row it does have. Lighting the scene from that would show a
    // picture of some other date while the readout says the time is outside the table.
    const tabled = !!s.eph && sc.tMs >= s.eph.startMs && sc.tMs <= s.eph.endMs
      && s.eph.missing(sc.tMs, sc.tMs).length === 0;
    if (s.eph && tabled) {
      const vectors = s.eph.vectorsAt(sc.tMs);
      sun.position.copy(target).addScaledVector(moonDirection(vectors.sun), 2000); sun.intensity = 3;
      sun.castShadow = polar;
      // Seen from the site, not the Moon's centre: Earth is close enough for that to matter.
      const toEarth = moonDirection(vectors.earthKm).add(globe.position).sub(target);
      const distance = toEarth.length();
      earth.position.copy(target).addScaledVector(toEarth.normalize(), EARTH_DRAWN_KM);
      earth.scale.setScalar(2 * EARTH_RADIUS_KM * EARTH_DRAWN_KM / distance); earth.visible = true;
    } else { sun.intensity = 0; earth.visible = false; }
    if (!lost) {
      message.hidden = tabled;
      message.textContent = s.eph ? 'This time is outside the Sun and Earth table' : 'Loading Sun and Earth table…';
    }
    // The same cached sample the readout shows, so the two never disagree.
    const now: Sample | undefined = samplesFor(sc, '30d')[0];
    const mock = dem?.meta.source === 'mock' || s.eph?.meta.source === 'mock';
    const whole = mode === '2d' ? 'Whole-Moon map' : 'Moon globe';
    caption.textContent = [mock ? 'Mock data' : '',
      polar ? (mode === '2d' ? 'South-pole terrain · polar stereographic' : 'South-pole terrain')
        : `${whole}${mode === '2d' ? ' · equidistant cylindrical' : ''} · ${dem ? 'outside terrain coverage' : 'Loading height map'}`,
      now ? (now.sunFrac > 0 ? 'Sun visible' : 'Sun hidden') : '',
      stretch > 1 && dem ? 'Heights exaggerated; shadows are illustrative' : 'Lighting is illustrative; use the readout for visibility',
    ].filter(Boolean).join(' · ');
    help.textContent = mode === '2d' ? 'Click to pick a site · drag to pan · scroll to zoom'
      : orbitGlobe ? 'Click to pick a site · drag to turn the Moon · scroll to zoom'
        : 'Click to pick a site · drag to orbit · right-drag to pan · scroll to zoom';
    invalidate();
  }
  function updateTheme(): void {
    const key = ['--bg', '--text', '--terrain-lo', '--terrain-hi', '--earth', '--muted', '--accent', '--scn-a', '--scn-b', '--scn-c', '--scn-ghost', '--space-1'].map(themeColor).join('|');
    if (key === themeKey) return;
    themeKey = key; world.background = new Color(themeColor('--bg'));
    // Three quarters of the smallest gap: about the size the pins had at the starting zoom.
    pinPx = Math.max(1, themeLength(viewport, '--space-1') * 0.75);
    sun.color.set(themeColor('--text')); ambient.color.set(themeColor('--text'));
    // Until the height map arrives there is no 0 m colour; the middle of the ramp stands in.
    globeMaterial.color.set(themeColor('--terrain-lo')).lerp(new Color(themeColor('--terrain-hi')), 0.5);
    const old = earthMaterial.map; earthMaterial.map = earthTexture(); old?.dispose();
    update(getState());
  }
  function pick(event: PointerEvent): void {
    const start = pointerDown; pointerDown = null;
    if (!start || start.id !== event.pointerId || maxDrag > 5 || event.button !== 0 || lost) return;
    const rect = canvas.getBoundingClientRect(); if (!rect.width || !rect.height) return;
    pointer.set((event.clientX - rect.left) / rect.width * 2 - 1, -(event.clientY - rect.top) / rect.height * 2 + 1);
    sizePins(); world.updateMatrixWorld(true); orbitCamera.updateMatrixWorld(true);
    raycaster.setFromCamera(pointer, orbitCamera);
    const surface = raycaster.intersectObjects([detail, coarse, northMesh, globe].filter((m): m is Mesh => !!m), false)[0];
    const pin = raycaster.intersectObjects(pins.children, false).find((hit) => !surface || hit.distance <= surface.distance + 0.01);
    if (pin) {
      const data = pin.object.userData as PinData;
      if (data.scenarioId && getState().pinned.some((p) => p.id === data.scenarioId)) select(data.scenarioId);
      else setLiveSite(data.site);
    } else if (surface) {
      const uv = surface.object === coarse || surface.object === detail ? surface.uv : undefined;
      const site = uv && dem ? gridSite(dem.meta, uv.x * (dem.meta.size - 1), uv.y * (dem.meta.size - 1)) : sphereSite(surface.point);
      if (!uv || dem?.covers(site.lat, site.lon)) setLiveSite(site);
    }
  }
  const down = (event: PointerEvent): void => {
    // A second finger cancels the click; a new primary press always starts a fresh one.
    if (!event.isPrimary || event.button !== 0) { pointerDown = null; return; }
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
  // The camera follows the site up or down with the stretch; it isn't reset.
  const onStretch = (): void => { stretch = Number(slider.value); output.value = `${stretch}×`; update(getState()); };
  slider.addEventListener('input', onStretch); reset.addEventListener('click', centre);
  const observer = new ResizeObserver(resize); observer.observe(viewport);
  const themeObserver = new MutationObserver(updateTheme);
  themeObserver.observe(document.documentElement, { attributes: true, attributeFilter: ['class', 'style'] });
  const unsubscribe = subscribe(update);
  // Not needed for any number, so it loads beside the rest and the plain sphere shows meanwhile.
  Promise.all([loadGlobe(), loadNorth().catch(() => null)]).then(([loaded, cap]) => {
    if (disposed) return;
    globeHeights = loaded; north = cap; buildNorth(); update(getState());
  }).catch(() => { /* No whole-Moon heights (mock data set): the globe stays a plain sphere. */ });
  updateTheme(); resize();
  function dispose(): void {
    if (disposed) return;
    disposed = true; cancelAnimationFrame(frame); unsubscribe(); observer.disconnect(); themeObserver.disconnect();
    canvas.removeEventListener('pointerdown', down); canvas.removeEventListener('pointermove', move);
    canvas.removeEventListener('pointerup', pick); canvas.removeEventListener('pointercancel', cancel);
    canvas.removeEventListener('webglcontextlost', onLost); canvas.removeEventListener('webglcontextrestored', onRestored);
    slider.removeEventListener('input', onStretch); reset.removeEventListener('click', centre);
    buttons.forEach((b) => b.removeEventListener('click', changeMode)); window.removeEventListener('pagehide', onPageHide);
    orbitControls.dispose(); clearTerrain(); clearPins(); northMesh?.geometry.dispose(); unmountMap(mapHost);
    pinGeometry.dispose(); globe.geometry.dispose(); globeMaterial.map?.dispose(); globeMaterial.normalMap?.dispose(); globeMaterial.dispose(); terrainMaterial.dispose(); detailMaterial.dispose();
    earthMaterial.map?.dispose(); earthMaterial.dispose(); sun.dispose();
    // Free the WebGL context now: browsers allow only a few, and a remount would leak one.
    renderer.dispose(); renderer.forceContextLoss(); canvas.remove(); mounts.delete(el);
  }
  function onPageHide(event: PageTransitionEvent): void { if (!event.persisted) dispose(); }
  window.addEventListener('pagehide', onPageHide); mounts.set(el, dispose);
}
