# T02: Angles for any site: geometry.ts

Status: done, in review (pull request #26)

| | |
|---|---|
| Owner | P1 |
| Tier | must |
| Waits for | T00, T01 |
| Branch | `t02-geometry` |

## Goal

`sunAltAz`, `earthAltAz` and `destination` proven against Skyfield. T00 wrote a first pass from the contract's formulas; this task adds the real tests and fixes whatever they find.

## Files you own

- `web/src/core/geometry.ts` (taken over from T00's first pass), `web/src/core/geometry.test.ts`
- `docs/ai-use/T02.md`, `docs/sources/T02.md`, this file's `Status:` line

## Steps

1. Check the first pass against the contract's Geometry block, line by line. Keep every name and signature.
2. `destination` is the standard great-circle "start point, bearing, distance" formula on a sphere of radius R.
3. Tests read `__fixtures__/altaz.json` and compare, using the real table built with `parseEphemeris`.
4. If T01 isn't merged yet, do T06 or T12 first and come back.

## Done when

- [ ] Every fixture case matches within 0.02 degrees in altitude, and in azimuth wherever altitude is below 89 degrees.
- [ ] At latitude -90, the Sun's altitude is within +-1.6 degrees for 1,000 random times in the table.
- [ ] `destination(lat, lon, 0, 1000)` moves 1 km north: latitude rises by 0.03298 degrees within 0.0001, longitude unchanged.
- [ ] `npm test` and `npm run build` pass.

## Prompt to paste into Claude Code

```text
Read CLAUDE.md, docs/data-contract.md and tasks/T02-geometry.md. Do only that task, on branch t02-geometry. Edit only the files it lists under "Files you own". If the task needs a change anywhere else, or a new package, stop and tell me. When you think you're finished, run every line of "Done when" and show me the output for each.
```
