# T12: 3D scene and map

Status: implemented, in review (pull request #7); merged T20 integration verified; laptop FPS verification pending

| | |
|---|---|
| Owner | P1 |
| Tier | must |
| Waits for | T00 |
| Branch | `t12-scene` |

## Goal

Spec feature F10, and F1's click-to-pick.

## Files you own

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

## Prompt to paste into Claude Code

```text
Read CLAUDE.md, docs/data-contract.md and tasks/T12-scene.md. Do only that task, on branch t12-scene. Edit only the files it lists under "Files you own". If the task needs a change anywhere else, or a new package, stop and tell me. When you think you're finished, run every line of "Done when" and show me the output for each.
```
