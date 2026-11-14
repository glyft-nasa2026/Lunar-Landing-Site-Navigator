# T24: Real-data checks

Status: not started

| | |
|---|---|
| Tier | must |
| Waits for | T01, T04, T05, T06, T07 |
| Branch | `t24-real-data-checks` |

## Goal

The terrain checks of spec section 7, run on the real table and the real height map, as tests
that keep running on every pull request. These checks used to sit in T05 and T06 as "after T04"
lines that nobody owned once those tasks had merged.

## Files in scope

- `web/src/core/realdata.test.ts`
- `docs/ai-use/T24.md`, `docs/sources/T24.md`, this file's `Status:` line

## Steps

1. The test reads `web/public/data/` from disk and builds the table and the grid with `parseEphemeris` and `parseDem`. It skips, with a printed reason, when either file says `"source": "mock"`.
2. It takes `shackleton-floor` and `shackleton-rim` from `sites.json` by id.
3. The checks:
   - Floor: the lowest of the 360 skyline values is above 5 degrees.
   - Floor: never lit in the whole table (`sunFrac` is 0 in every hourly sample, 2026-2035).
   - Rim: lit more than half of the whole table.
   - One real skyline takes under 100 ms (print the timing).
4. If a check fails, keep the check and report the numbers with the affected area: `horizon.ts` (T05), `windows.ts` (T06), or the rim coordinates (T07). Anyone can claim a separate, coordinated fix; keep this test delivery independent of the fix.

## Done when

- [ ] All four checks pass on the real files, with the printed numbers pasted into the pull request.
- [ ] With the mock files put back, the test skips and says why.
- [ ] `npm test` and `npm run build` pass.

## Prompt to paste into Claude Code

```text
Read CLAUDE.md, docs/data-contract.md and tasks/T24-real-data-checks.md. Do only that task, on branch t24-real-data-checks. Use "Files in scope" as the starting scope; follow CLAUDE.md's coordination rules for any additional files or dependencies. If a check fails, show me the numbers and stop; don't change any other file to make it pass. When you think you're finished, run every line of "Done when" and show me the output for each.
```
