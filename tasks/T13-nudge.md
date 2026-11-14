# T13: Nudge: small move, big change

Status: done

| | |
|---|---|
| Owner | P3 |
| Tier | must |
| Waits for | T00, T05 |
| Branch | `t13-nudge` |

## Goal

Spec feature F11.

## Files you own

- `web/src/ui/nudge/`
- `docs/ai-use/T13.md`, `docs/sources/T13.md`, this file's `Status:` line

## Steps

1. Six buttons: 1 km north, south, east, west (using `destination`), +1 day, -1 day. Each builds a ghost scenario with `setGhost`.
2. Compare `summaryFor(ghost)` with `summaryFor(live)`, and `flipFor(ghost, ...)` with `flipFor(live, ...)`, and write the difference in plain words: hours of sunlight gained or lost over 30 days, change in sunset time, change in Earth contact.
3. Buttons: "Keep" (calls `setLiveSite` and `setLiveTime` with the ghost's values, then clears the ghost) and "Discard".
4. Build it from `docs/design/nudge.png` if T22 has merged. The CSS file goes to T23 once this merges.

## Done when

- [ ] On the real height map, starting at -89.45, -137.3 at 2027-03-01T00:00Z and nudging 1 km south, reports a large loss of sunlight (days, not hours).
- [ ] At a site north of 85 S (no terrain), a 1 km move reports "no meaningful change" and says terrain isn't modelled there.
- [ ] +1 day changes the countdowns by about 24 hours.
- [ ] Discard leaves the live scenario exactly as it was.
- [ ] `npm test` and `npm run build` pass.

## Prompt to paste into Claude Code

```text
Read CLAUDE.md, docs/data-contract.md and tasks/T13-nudge.md. Do only that task, on branch t13-nudge. Edit only the files it lists under "Files you own". If the task needs a change anywhere else, or a new package, stop and tell me. When you think you're finished, run every line of "Done when" and show me the output for each.
```
