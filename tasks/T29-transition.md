# T29: Camera glide

Status: not started

| | |
|---|---|
| Owner | unassigned |
| Tier | if time |
| Waits for | T12, M2 |
| Branch | `t29-transition` |

## Goal

Spec feature F16: the camera glides between the top-down "2D map" and the orbit "3D" view
instead of jumping.

## Files you own

- `web/src/scene/index.ts` and any file you add in `web/src/scene/`, shared with T12's owner: agree with P1 before starting, and only one of you has a branch open on this folder at a time
- `docs/ai-use/T29.md`, `docs/sources/T29.md`, this file's `Status:` line

Not yours: the scene's CSS file (T23).

## Steps

1. When `mode` changes, move the camera from where it is to the other view over about 0.8 seconds, easing in and out.
2. A second change during a glide starts from the camera's current position; it doesn't snap back first.
3. A click on the terrain during a glide either lands on the right point or is ignored. It never sets a wrong site.
4. For someone whose system asks for reduced motion (`prefers-reduced-motion`), jump as before.

## Done when

- [ ] Switching 2D to 3D and back glides with no jump at the start or the end.
- [ ] Switching twice quickly doesn't snap.
- [ ] After a glide, a click still returns latitude and longitude within one grid cell of the true point (T12's own check).
- [ ] With reduced motion switched on, the view jumps.
- [ ] `npm test` and `npm run build` pass.

## Prompt to paste into Claude Code

```text
Read CLAUDE.md, docs/data-contract.md and tasks/T29-transition.md. Do only that task, on branch t29-transition. Edit only the files it lists under "Files you own". If the task needs a change anywhere else, or a new package, stop and tell me. When you think you're finished, run every line of "Done when" and show me the output for each.
```
