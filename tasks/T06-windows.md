# T06: Countdowns and percentages: windows.ts

Status: not started

| | |
|---|---|
| Owner | P1 |
| Tier | must |
| Waits for | T02 |
| Branch | `t06-windows` |

## Goal

`series`, `nextFlip`, `summary`, `countdownText` exactly as contract section 3.

## Files you own

- `web/src/core/windows.ts` (replace the stub), `web/src/core/windows.test.ts`
- `docs/ai-use/T06.md`, `docs/sources/T06.md`, this file's `Status:` line

## Steps

1. Implement the contract's Visibility block.
2. `countdownText` returns the F4 wording from the spec, including the four special cases.
3. T00 left this file as a stub with the right function names; replace the bodies, keep the names, and `state.ts` picks them up unchanged.

## Done when

- [ ] With a made-up skyline of 0 everywhere at the equator, lit time is 50 % within 2 % over 60 days.
- [ ] `nextFlip` lands within 1 minute of the moment `sunFrac` crosses zero in a finely sampled series.
- [ ] A skyline of 30 degrees everywhere gives lit 0 % and the text "Permanently shadowed" when no rise is found.
- [ ] After T04 and T05: Shackleton's floor is never lit across 2026-2035, and a rim point is lit more than half the time.
- [ ] `npm test` and `npm run build` pass.

## Prompt to paste into Claude Code

```text
Read CLAUDE.md, docs/data-contract.md and tasks/T06-windows.md. Do only that task, on branch t06-windows. Edit only the files it lists under "Files you own". If the task needs a change anywhere else, or a new package, stop and tell me. When you think you're finished, run every line of "Done when" and show me the output for each.
```
