# T12: 3D scene and map

Status: done (pull requests #7 and #18; drag-to-pan and outside-table fixes in #52). Above 30 FPS on the laptop, confirmed by P1 on 14 Nov 2026

| | |
|---|---|
| Tier | must |
| Waits for | T00 |
| Branch | `t12-scene` |

## Goal

Spec feature F10, and F1's click-to-pick.

## Files in scope

- `web/src/scene/`
- `web/public/textures/` if any
- `docs/ai-use/T12.md`, `docs/sources/T12.md`, this file's `Status:` line

## Steps

1. Build the terrain mesh from `dem`: a reduced grid for the whole region (about 512 x 512 points), plus a full-detail patch around the selected site. Colour by height between `themeColor('--terrain-lo')` and `themeColor('--terrain-hi')`; a vertical stretch slider (1x to 5x).
2. One scene, two cameras: top-down for the "2D map", orbit for "3D". `setMode` switches.
3. Sun: a directional light placed from `eph.vectorsAt(tMs).sun` at the selected scenario's time, converted into the scene's axes. Shadows on if they look right; the lit/dark answer always comes from `core/`, never from the rendered shadow.
4. Earth: a small textured sphere or sprite placed far away in its computed direction.
5. Pins: curated sites in `themeColor('--muted')`, scenarios in `themeColor(sc.color)`, the selected one larger. No colour code in this folder.
6. Click: raycast to the mesh, convert the hit to latitude and longitude with the contract's inverse projection, call `setLiveSite`.
7. North of 80 S there is no mesh: show a plain Moon sphere with pins, so Apollo sites can still be selected from the list.

## Done when

- [ ] Clicking the centre of the mock crater returns latitude -88.0, longitude 45.0 within one grid cell.
- [ ] Scrubbing time moves the light; at a time when the readout says "Sun hidden" for a crater floor, the floor is visibly dark.
- [ ] The 2D/3D switch works and keeps the same site centred.
- [ ] Stays above 30 frames per second on a mid-range laptop.
- [ ] Usable on mock data today; no changes needed in this folder when the real grid lands, apart from tuning.
- [ ] `npm test` and `npm run build` pass.

## Notes

Biggest task in the project. Get click-to-pick and the light working before anything decorative.

The folder's CSS file goes to T23 once this merges.

## After the merge

- 14 Nov 2026, pull request #7 also put readable headings on five other modules' placeholders (Compare, Timeline, Sky, Nudge, About), at P1's request. Those folders belong to their own tasks.
- 14 Nov 2026, pull request #18 (`t12-scene-b`): the Moon sphere is always drawn with the terrain set into it, globe drags turn the Moon about its centre, and the Sun's shadow box is fitted to the visible terrain on the real height map.
- 14 Nov 2026: the "above 30 frames per second" line. An earlier measurement read exactly 30; P1 confirmed on 14 Nov 2026 that the laptop runs above 30.
- 14 Nov 2026, pull request #52 (`t12-scene-c`), from the audit of merged tickets:
  - A plain left-drag or one-finger drag pans the 2D map. Before, it did nothing.
  - With no table row for the selected time, the scene goes dark and says "This time is outside the Sun and Earth table". Before, it was lit from the nearest row.
  - `browser-check.py` has 15 checks, not 13, and its drag check starts away from the selected pin.
- 14 Nov 2026, issue #66 (`issue-66-moon-model`): the globe north of 80 S is no longer a plain sphere (step 7). It is coloured by height and lit through surface normals from a whole-Moon LOLA grid, `globe.bin` (contract section 2), with slopes drawn 6 times steeper. North of 80 N it is a mesh on a square polar grid, `north.bin`, like the south-pole terrain, so nothing pinches together at the pole. Round the selected site the globe is drawn from 950 m heights fetched as tiles (level of detail, `tiles/`); that patch lies on the sphere, its ground is not raised. The whole-Moon 2D map (T31) is drawn from the same `globe.bin`: height colours, with slopes facing the Sun brighter and slopes facing away darker; the polar 2D map is unchanged. Without the files the globe is the plain sphere as before.

## Prompt to paste into Claude Code

```text
Read CLAUDE.md, docs/data-contract.md and tasks/T12-scene.md. Do only that task, on branch t12-scene. Use "Files in scope" as the starting scope; follow CLAUDE.md's coordination rules for any additional files or dependencies. When you think you're finished, run every line of "Done when" and show me the output for each.
```

## Issue #77 handoff (branch `t12-scene-d`, no code written yet)

Issue #77: in the 3D view, orbit around the selected site, "Centre selected site" and the
vertical stretch do not work north of 80 S. Investigated on 14 Nov 2026; nothing implemented.
Whoever picks this up continues on `t12-scene-d` (branched from `main` at dac2a21).

### Cause (all in `web/src/scene/index.ts`)

Not a crash: outside the south-pole height map (`polar === false`) the scene deliberately uses a
different view, from pull request #18 and #71.

- `centre()`: the `else` branch makes globe controls (`makeOrbitControls(true, …)`), target the
  Moon's centre, camera 3.5 Moon radii out. So the reset shows the whole Moon, not the site.
- `makeOrbitControls(globeView)` / `onOrbitChange()` / `follow()`: with `orbitGlobe` a drag turns
  the Moon about its centre; pan is off.
- `update()`: `slider.disabled = !polar || mode === '2d'`.
- `patch.ts` `patchGeometry`: the detail patch round a non-polar site (±6°, 385 x 385 points)
  lies flat on the sphere; heights only shade it. So there is nothing for a stretch to raise.
- North of 80 N: `northGeometry` (terrain.ts) is built at stretch 1 and no patch is drawn.

### Planned fix (not started)

1. One orbit behaviour everywhere: drop `orbitGlobe` and the `globeView` parameter. Non-polar
   `centre()`: controls with `up = siteUp(site)`, target = `target`, camera offset in the site's
   own frame (`east*0.6 + up*0.9 - north*1.1`, times a span of about 150 km; `siteNorth` is in
   coordinates.ts, east = north × up). Leave the polar branch as it is.
2. `follow()` for a non-polar site: `up` changes a lot between sites and OrbitControls reads
   `camera.up` only when created. Rotate the camera offset by
   `Quaternion.setFromUnitVectors(orbitCamera.up, newUp)`, dispose and recreate the controls.
3. Stretch: enable the slider whenever `dem` is loaded and mode is 3D.
   - patch.ts: `patchGeometry` keeps flat positions by default (existing tests rely on it) but
     stores in `userData` the flat positions and a per-vertex lift in km:
     `(h - lowest h in the window) / 1000`, times the same smoothstep edge fade the normals use
     (`FADE`), so the patch never dips under the globe and meets it at its edge. Add
     `stretchPatch(geometry, stretch)` (position = flat * (1 + lift * stretch / R), bounding
     volumes recomputed) and `patchLiftAt(geometry, win, index, lat, lon)` (bilinear, 0 outside
     the window, longitude wrapped). Tests for both in patch.test.ts.
   - index.ts: call `stretchPatch` when the patch is built and when the stretch changes; use
     `patchLiftAt` for `target` and for pin heights (`addPin`), add the patch mesh to `pinKey`,
     call `update(getState())` instead of `invalidate()` when a patch arrives and `follow()` when
     the patch changed; count the patch's highest lift in the near-plane `relief`.
   - North cap: give `northGeometry` a stretch argument, rebuild on stretch change (reset
     `northKey` so it is recoloured), use `north.heightAt(-lat, lon)` for `target`.
4. Help text: one 3D line ("drag to orbit · right-drag to pan"); remove "drag to turn the Moon".
5. `browser-check.py` lines 316-370 assert the old behaviour (slider disabled outside the height
   map at line 327, the "globe drag" check, the 'turn the Moon' text). Update them. Pull request
   #76 (`t31-flat-map-c`) also edits this file, in other hunks: agree the merge order first.
6. Records: `docs/ai-use/T12.md`, `docs/sources/T12.md`, the line under "After the merge" here,
   then `npm test` and `npm run build`.

Open point for the human: this replaces the "turn the whole Moon" drag from pull request #18.
The whole Moon is still reachable by zooming out.
