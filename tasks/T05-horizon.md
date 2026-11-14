# T05: Terrain skyline: horizon.ts

Status: done (pull request #15; tests tightened in #53)

| | |
|---|---|
| Owner | P2 |
| Tier | must |
| Waits for | T00 |
| Branch | `t05-horizon` |

## Goal

`skylineAt` and `skylineElev` exactly as contract section 3.

## Files you own

- `web/src/core/horizon.ts` (taken over from T00's flat skyline), `web/src/core/horizon.test.ts`
- `docs/ai-use/T05.md`, `docs/sources/T05.md`, this file's `Status:` line

## Steps

1. Implement the walk in the contract's Skyline block, using `destination` from `geometry.ts` for each step and `dem.heightAt` for the ground.
2. Tests build small made-up height grids in memory with `parseDem`; they don't need the real file. `destination` already works: T00 wrote it.

## Done when

- [ ] Flat grid, eye height 0: all 360 values are between -0.05 and 0 degrees.
- [ ] Flat grid with a wall 1,000 m high, 10 km to the north: the value at azimuth 0 matches the contract formula (about 5.53 degrees) within 0.1; the value at azimuth 180 is about 0.
- [ ] Site north of 85 S, or `dem` null: `terrain` is false and all values are 0.
- [ ] One skyline takes under 100 ms on a laptop (print the timing in the test).
- [ ] In a made-up grid with a bowl crater 10 km in radius and 3,000 m deep, seen from its centre, the lowest of the 360 values is above 10 degrees.
- [ ] `npm test` and `npm run build` pass.

## Notes

The check on the real Shackleton floor is T24's, once T04 has merged.

## After the merge

- 14 Nov 2026, pull request #53 (`t05-horizon-b`), from the audit of merged tickets. Tests only:
  - The walk test checks that the look-out distance is 150 km. Before, it passed with any distance.
  - The timing test reads the fastest of five runs. The median failed on a busy machine with the code unchanged.
- Pull request #40 (T02, open on 14 Nov 2026) makes `destination()` work from exactly latitude -90, with the rule `horizon.ts` already uses (bearing b runs down longitude lon + b). Once #40 is in, the special case for the pole in `horizon.ts` is no longer needed. It is harmless and stays until P2 removes it.

## Prompt to paste into Claude Code

```text
Read CLAUDE.md, docs/data-contract.md and tasks/T05-horizon.md. Do only that task, on branch t05-horizon. Edit only the files it lists under "Files you own". If the task needs a change anywhere else, or a new package, stop and tell me. When you think you're finished, run every line of "Done when" and show me the output for each.
```
