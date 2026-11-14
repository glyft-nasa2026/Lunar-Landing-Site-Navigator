# T31: A true flat 2D map

Status: done (first delivery #59; zoom and pan limits for issue #65, #69; the whole Moon's relief, #71; browser check past the main page, #76); 18 of 18 browser checks pass on fixture and real data

| | |
|---|---|
| Tier | must |
| Waits for | T12 (all its pull requests, the last being #52) |
| Branch | `t31-flat-map` |

## Goal

Issue #39. The "2D map" was the 3D scene seen through a second, orthographic camera: an
orthographic azimuthal view, foreshortened toward the edge, with no grid you could read a
coordinate from, and carrying the whole 3D pipeline (shadow map, raycasting, depth buffer) for a
"flat" view. Replace it with a real flat map in two projections, as LROC QuickMap does:

- **Polar view** (the selected site is on the height map): the height map drawn flat in its own
  south polar stereographic grid (contract section 2, `dem.bin`), pixel for pixel, no
  reprojection.
- **Global view** (anywhere else): equidistant cylindrical (plate carrée),
  `x = R (lon - lon0) cos(lat_ts)`, `y = R lat`, with `lat_ts = 0` and longitude -180 to 180.

Both drawn on a plain 2D canvas: no three.js, no WebGL, no shadow map, no raycaster. A click
turns into latitude and longitude through the inverse projection in `core/`.

## Files in scope

- `web/src/core/projection.ts`, `web/src/core/projection.test.ts` (new): forward and inverse for
  both projections, and the screen view (pan and zoom) on top of them
- `web/src/core/shade.ts`, `web/src/core/shade.test.ts` (new): the illustrative light layers,
  so the map computes no Sun angle itself
- `web/src/map/` (new): the flat map, `index.ts` exporting `mount(el)`, and `map.css`
- `web/src/scene/index.ts` and `web/src/scene/browser-check.py`; coordinate overlapping files
  with active scene and map work before editing
- `docs/ai-use/T31.md`, `docs/sources/T31.md`, this file's `Status:` line

Integration files in this task's scope: `SPEC.md` (F10 and F16 wording),
`docs/decisions.md` (one line), `docs/data-contract.md` (the two new `core/` files),
`tasks/README.md` (this task on the board), `tasks/T29-transition.md` (what the glide means now).

T23 covers the scene's CSS polish; include changes to `web/src/scene/scene.css` here only if
needed for the map, and coordinate any active T23 delivery. The map is mounted by the scene
module inside its own `#scene` slot, so this implementation needs no `main.ts` or `index.html`
change.

## Steps

1. `core/projection.ts`: `polarForward`/`polarInverse` (the contract's formulas, metres),
   `cylForward`/`cylInverse` (km, `lon0` the centre longitude, longitudes wrapped to -180..180),
   and a `MapView` (centre, scale, canvas size) with `viewToScreen` / `screenToView`, so a
   screen point goes to latitude and longitude through pure functions.
2. `core/shade.ts`: for the polar view, a grid the size of the height map (or a stride of it)
   giving the fraction of the Sun's disc above the terrain at each cell (a sweep toward the
   Sun, curvature included) and the cosine of the Sun's incidence on the slope. For the global
   view, the cosine of the Sun's zenith angle over a latitude-longitude grid, and the sub-solar
   and sub-Earth points.
3. `map/`: draw the polar view as the height colours (`--terrain-lo` to `--terrain-hi`) dimmed
   by the light layer, with a graticule (parallels as circles, meridians as straight lines).
   Draw the global view as day and night from the Sun, the polar cap's heights, a straight
   graticule, and markers for the sub-solar and sub-Earth points. Pins as in the scene. Drag
   pans, wheel and pinch zoom, a click picks a pin or a point.
4. `scene/index.ts`: in 2D mode hide the WebGL canvas and show the map; drop the orthographic
   camera, its controls and every 2D branch (shadow box, pin size, picking). The mode buttons,
   "Centre selected site" and the stretch slider (3D only) stay in the scene's toolbar. If WebGL
   is missing, the 2D map still works.
5. Update `browser-check.py` for the new map.

## Done when

- [ ] 2D mode draws no three.js globe and uses no shadow map: the 3D renderer does not render
      while the map shows.
- [ ] Clicking the 2D map returns latitude and longitude from the inverse projection in `core/`,
      within one grid cell of the mock crater centre (-88.0, 45.0) (tested in vitest and in the browser).
- [ ] The global view is equidistant cylindrical with a straight latitude-longitude graticule.
- [ ] The polar view shows the height map in its native polar stereographic grid.
- [ ] At a time when the readout says "Sun hidden" for the crater floor, the floor is dark on
      the map.
- [ ] The 2D/3D switch works and keeps the same site selected.
- [ ] `npm test` and `npm run build` pass.

## Notes

The light layer is an illustration, like the 3D scene's shadows: the lit/dark answer still comes
from `windows.ts` through the readout. It is computed on the height map's grid (or a stride of
it), not by the skyline walk, so near a shadow's edge the two may differ by a cell.

Since issue #66 (14 Nov 2026, branch `issue-66-moon-model`) the whole-Moon map is no longer grey
outside the polar grid: it is coloured by height from `globe.bin` (contract section 2) and its
relief is lit, with slopes drawn 6 times steeper as on the 3D globe. Day and night still come
from `shadeGlobal`; daylight comes in over the first 5 degrees of Sun. Without `globe.bin` the
map is as before. The reading code is `web/src/scene/globeHeights.ts`, which has no three.js.

F16 (T29) used to be a camera glide between the two cameras. With a flat map there is no camera
to glide; T29 becomes a cross-fade. P1 chose the flat map over the easy glide.

## After the merge

14 Nov 2026, audit of the merged tickets, in headless Chromium on the real data. **Measured on `main` before #71** (the whole Moon's relief), which changed `web/src/map/index.ts` and `core/shade.ts`; nothing below was looked at again after it.

Checked and correct: "Done when" lines 1 to 6; no WebGL call in 2D; 49 clicks at 1280 and 390 px against a separate projection, the worst 0.38 px off (poles, both sides of 180°, the equator, the edges, after wheel, drag, pinch, resize and arrow keys); longitude always within -180 to 180; east right, north up; the zoom and pan limits of #69; 26 pins and both overhead markers at the predicted pixels; whole-Moon day and night 306 of 306 against `sunAltAz`; south of 85° S the shadow layer matches the readout's rule at 1011 of 1015 cells.

Open, for whoever works on the map next. Not fixed here: `web/src/map/index.ts` was being changed by #71.

- *costs time*: **between 80° S and 85° S the map draws terrain shadow where the readout says the Sun is up.** The map shades wherever the height map covers (to 80° S); the engine uses a flat skyline north of 85° S. 174 of 573 sampled cells were dark with the Sun up by the readout's rule, none the other way. Seen at -83.2103, 22.235: caption "Sun visible", readout "Disc visible 100 %", 38 of 40 cells round the pin dark. One limit for both, or no cast shadows in that band.
- *cosmetic*: a click on the bare background beside the polar map picks a site (30 px left of the square, zoomed right out: live became -78.62, -89.98 and the view jumped to the whole Moon).
- *cosmetic*: a pinned scenario that sits on a curated site can't be selected from the map: the curated pin is tested first and wins the tie.
- *cosmetic*: without WebGL the map never shows the "outside the table" message, and the caption stays as it was.
- *cosmetic*: five changes to `core/shade.ts` that break it pass its tests (all 26 to `projection.ts` are caught): `shadeGlobal` mirrored east to west, a Sun of radius 0, the disc's upper limb only, `rise` without the diagonal, `cosI` not normalised. A Sun at 90° E and a half-disc test would catch four of them.
- *cosmetic*: at 1920 px the whole-Moon map shows 1.46 Moons with pins on one copy; at 390 px the labels "90°W" and "90°E" are cut by 6 to 8 px; map labels are faint on lit ground (see T19).
- The status line said 19 browser checks. `browser-check.py` has 18.

## Prompt to paste into Claude Code

```text
Read CLAUDE.md, docs/data-contract.md and tasks/T31-flat-map.md. Do only that task, on branch t31-flat-map. Use "Files in scope" as the starting scope; follow CLAUDE.md's coordination rules for any additional files or dependencies. When you think you're finished, run every line of "Done when" and show me the output for each.
```
