# T06: Countdowns and percentages: windows.ts

Status: done (pull request #5)

| | |
|---|---|
| Owner | P1 |
| Tier | must |
| Waits for | T00 |
| Branch | `t06-windows` |

## Goal

`series`, `nextFlip`, `summary` and `countdownText` proven by tests. T00 wrote a first pass from the contract; this task adds the real tests and fixes whatever they find.

## Files you own

- `web/src/core/windows.ts` (taken over from T00's first pass), `web/src/core/windows.test.ts`
- `docs/ai-use/T06.md`, `docs/sources/T06.md`, this file's `Status:` line

## Steps

1. Check the first pass against the contract's Visibility block, line by line.
2. `countdownText` returns exactly the wording in the contract's table, one test per row.
3. Keep every name and signature; `state.ts` and three UI modules already call them.
4. Tests build a small made-up table in memory with `parseEphemeris` (a Sun that circles once per 29.53 days), so they don't depend on which data file is in the repo.

## Done when

- [ ] With a made-up skyline of 0 everywhere at the equator, lit time is 50 % within 2 % over 60 days.
- [ ] `nextFlip` lands within 1 minute of the moment `sunFrac` crosses zero in a finely sampled series.
- [ ] A skyline of 30 degrees everywhere gives lit 0 %, and `countdownText` with `neverLit` true reads "Permanently shadowed (2026-2035)".
- [ ] Every row of the contract's wording table has a passing test.
- [ ] `npm test` and `npm run build` pass.

## Notes

The checks on the real Shackleton floor and rim are T24's, once T04 and T05 have merged.

## After the merge

- 14 Nov 2026, pull request #31: "Permanently shadowed" now means no sunlight from the chosen time to the end of the table, and reads "Permanently shadowed (until 2100)". `state.ts` decides it (`neverLitFor`); the wording stays in `windows.ts`.
- 14 Nov 2026, audit of the merged tickets: `windows.ts` was reviewed against the contract and its tests. No defect found.

## Prompt to paste into Claude Code

```text
Read CLAUDE.md, docs/data-contract.md and tasks/T06-windows.md. Do only that task, on branch t06-windows. Edit only the files it lists under "Files you own". If the task needs a change anywhere else, or a new package, stop and tell me. When you think you're finished, run every line of "Done when" and show me the output for each.
```
