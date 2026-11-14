# T25: Example on first open

Status: not started

| | |
|---|---|
| Owner | P1 |
| Tier | must |
| Waits for | T00 |
| Branch | `t25-first-open` |

## Goal

Spec feature F19. Someone who opens the plain link, with no scenarios in it, sees a finished
comparison: the crater rim against the crater floor. Without this a judge's first view is one
arbitrary point, nothing pinned, and "Pin a scenario to compare".

## Files you own

- `web/src/state.ts`, `web/src/state.test.ts`
- `docs/ai-use/T25.md`, `docs/sources/T25.md`, this file's `Status:` line

## Steps

1. The rule is in contract section 4, "First open". The example is built when two things are both true: the page address names no scenario (no live one, none pinned), and the site list has arrived with a crater rim and a crater floor in it.
2. The two sites are found by id: `shackleton-rim` and `shackleton-floor`, or `mock-rim` and `mock-floor` on mock data (contract section 2). Don't write their coordinates into the code.
3. The example: live at the rim, the rim pinned as A, the floor pinned as B, all at the current hour, live selected.
4. An address that names any scenario opens exactly what it says, with no example added. So a share link is never changed, and someone who unpins everything and reloads stays unpinned.
5. If the site list never arrives, or has neither pair of ids, nothing happens and nothing crashes.

## Done when

- [ ] A state test: empty address, then a site list with `shackleton-rim` and `shackleton-floor`: live is at the rim, A is the rim, B is the floor, live is selected.
- [ ] A state test: the same with `mock-rim` and `mock-floor`.
- [ ] A state test: an address with one pinned scenario, then the site list: state is unchanged.
- [ ] A state test: empty address, then a site list with neither pair: nothing pinned, no error.
- [ ] On `npm run dev` with the plain address, the compare slot shows two columns. Unpin both, reload: nothing is pinned.
- [ ] `npm test` and `npm run build` pass.

## Notes

Until T07 merges, `sites.json` is the mock list, and on the real height map `mock-rim` and
`mock-floor` are two ordinary points, not a rim and a floor. The example tells the
rim-against-floor story only once T07's `shackleton-rim` and `shackleton-floor` are in. The
code needs nothing from T07: it uses whichever pair is there.

The example's three scenarios are at the current hour, so they need only the decade the page
loads first (contract section 4, "Decades").

## Prompt to paste into Claude Code

```text
Read CLAUDE.md, docs/data-contract.md and tasks/T25-first-open.md. Do only that task, on branch t25-first-open. Edit only the files it lists under "Files you own". If the task needs a change anywhere else, or a new package, stop and tell me. When you think you're finished, run every line of "Done when" and show me the output for each.
```
