# T05: Terrain skyline: horizon.ts

Status: not started

| | |
|---|---|
| Owner | P2 |
| Tier | must |
| Waits for | T00 (real-data check after T04) |
| Branch | `t05-horizon` |

## Goal

`skylineAt` and `skylineElev` exactly as contract section 3.

## Files you own

- `web/src/core/horizon.ts` (replace the stub), `web/src/core/horizon.test.ts`
- `docs/ai-use/T05.md`, `docs/sources/T05.md`, this file's `Status:` line

## Steps

1. Implement the walk in the contract's Skyline block, using `destination` from `geometry.ts` for each step and `dem.heightAt` for the ground.
2. Tests build small made-up height grids in memory; they don't need the real file.

## Done when

- [ ] Flat grid, eye height 0: all 360 values are between -0.05 and 0 degrees.
- [ ] Flat grid with a wall 1,000 m high, 10 km to the north: the value at azimuth 0 matches the contract formula (about 5.53 degrees) within 0.1; the value at azimuth 180 is about 0.
- [ ] Site north of 85 S, or `dem` null: `terrain` is false and all values are 0.
- [ ] One skyline takes under 100 ms on a laptop (print the timing in the test).
- [ ] After T04: at the centre of Shackleton's floor, the lowest of the 360 values is above 5 degrees.
- [ ] `npm test` and `npm run build` pass.

## Prompt to paste into Claude Code

```text
Read CLAUDE.md, docs/data-contract.md and tasks/T05-horizon.md. Do only that task, on branch t05-horizon. Edit only the files it lists under "Files you own". If the task needs a change anywhere else, or a new package, stop and tell me. When you think you're finished, run every line of "Done when" and show me the output for each.
```
