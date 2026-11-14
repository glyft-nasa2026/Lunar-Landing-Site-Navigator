# T02: Angles for any site: geometry.ts

Status: done (pull request #26; `destination` from a pole fixed in #40)

| | |
|---|---|
| Tier | must |
| Waits for | T00, T01 |
| Branch | `t02-geometry` |

## Goal

`sunAltAz`, `earthAltAz` and `destination` proven against Skyfield. T00 wrote a first pass from the contract's formulas; this task adds the real tests and fixes whatever they find.

## Files in scope

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

## After the merge

- 14 Nov 2026, pull request #31: `altaz.json` grew to 30 cases across 1900-2100, and the tests read every decade of the table through `realTable.testutil.ts`.
- 14 Nov 2026, pull request #40 (`t02-geometry-b`): `destination` works from a start exactly at latitude -90 or 90. Bearings there are measured from the meridian of the longitude the site was given: bearing b from the south pole heads down longitude lon + b. Step 2's formula divides 0 by 0 at a pole, so the code turns the site's "up" vector instead; the formula is now what the tests check it against.

## Prompt to paste into Claude Code

```text
Read CLAUDE.md, docs/data-contract.md and tasks/T02-geometry.md. Do only that task, on branch t02-geometry. Use "Files in scope" as the starting scope; follow CLAUDE.md's coordination rules for any additional files or dependencies. When you think you're finished, run every line of "Done when" and show me the output for each.
```
