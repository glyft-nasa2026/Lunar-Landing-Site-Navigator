# T31: A true flat 2D map

Status: done (zoom-out limit for issue #65, pull request #69, in review; first delivery #59); 18 of 18 browser checks pass on fixture and real data

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

F16 (T29) used to be a camera glide between the two cameras. With a flat map there is no camera
to glide; T29 becomes a cross-fade. P1 chose the flat map over the easy glide.

## Prompt to paste into Claude Code

```text
Read CLAUDE.md, docs/data-contract.md and tasks/T31-flat-map.md. Do only that task, on branch t31-flat-map. Use "Files in scope" as the starting scope; follow CLAUDE.md's coordination rules for any additional files or dependencies. When you think you're finished, run every line of "Done when" and show me the output for each.
```
