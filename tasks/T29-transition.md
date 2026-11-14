# T29: Map and scene cross-fade

Status: not started

| | |
|---|---|
| Tier | if time |
| Waits for | T12, T31, M2 |
| Branch | `t29-transition` |

## Goal

Spec feature F16: switching between the flat "2D map" and the orbit "3D" view fades from one to
the other instead of jumping. Since T31 the map is a flat 2D canvas, not a camera, so there is no
camera path between them: the map fades out while the 3D camera eases down onto the site, and
the reverse.

## Files in scope

- `web/src/scene/index.ts`, `web/src/map/index.ts` and any file you add in either folder; coordinate overlapping files with active T12, T14, T31 or other scene and map work before starting
- `docs/ai-use/T29.md`, `docs/sources/T29.md`, this file's `Status:` line

T23 covers the scene's CSS polish; include CSS here only if the transition needs it, and
coordinate with any active T23 delivery.

## Steps

1. When `mode` changes, cross-fade the map and the 3D canvas over about 0.8 seconds, easing in and out; going to 3D, the camera eases from above the site down to its orbit view.
2. A second change during a fade starts from where the fade is; it doesn't snap back first.
3. A click during a fade either lands on the right point or is ignored. It never sets a wrong site.
4. For someone whose system asks for reduced motion (`prefers-reduced-motion`), jump as before.

## Done when

- [ ] Switching 2D to 3D and back fades with no jump at the start or the end.
- [ ] Switching twice quickly doesn't snap.
- [ ] After a fade, a click still returns latitude and longitude within one grid cell of the true point (T31's own check).
- [ ] With reduced motion switched on, the view jumps.
- [ ] `npm test` and `npm run build` pass.

## Prompt to paste into Claude Code

```text
Read CLAUDE.md, docs/data-contract.md and tasks/T29-transition.md. Do only that task, on branch t29-transition. Use "Files in scope" as the starting scope; follow CLAUDE.md's coordination rules for any additional files or dependencies. When you think you're finished, run every line of "Done when" and show me the output for each.
```
