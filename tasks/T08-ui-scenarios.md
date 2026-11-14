# T08: Scenario panel, readout, share link

Status: done (pull requests #14, #20); follow-up on t08-ui-scenarios-c

| | |
|---|---|
| Owner | P3 |
| Tier | must |
| Waits for | T00 |
| Branch | `t08-ui-scenarios` |

## Goal

Spec features F1 (list and typed coordinates), F2 (time box), F3, F4 and F5.

## Files you own

- `web/src/ui/scenarios/`, `web/src/ui/readout/`
- `docs/ai-use/T08.md`, `docs/sources/T08.md`, this file's `Status:` line

## Steps

1. Scenarios panel: curated-site dropdown grouped by `group`, latitude and longitude boxes, UTC date-time box, the Pin button, one card per pinned scenario (colour dot, label, time, x to remove), click to select.
2. Readout: Sun and Earth lines for the selected scenario (`selected()`), and the two countdowns from `flipFor`, `neverLitFor` and `countdownText`. Say "smooth Moon, no terrain" when `skylineFor(...).terrain` is false, and whose numbers these are when a pinned scenario is selected.
3. Reject bad input with a message next to the box: latitude outside +-90, longitude outside +-180, time outside the table.
4. Build the insides from `docs/design/scenarios.png` and `docs/design/readout.png` if T22 has merged; if not, use the shared classes plainly. The CSS files go to T23 once this merges.

## Done when

- [ ] Choosing a site, typing coordinates and changing the time each update the readout.
- [ ] Pin three scenarios; the fourth Pin is disabled. Colours are A orange, B blue, C green.
- [ ] Reloading the page keeps the pinned scenarios (`state.ts` does this; check the cards redraw from it).
- [ ] Typing latitude 95 shows a message and changes nothing.
- [ ] Selecting a pinned card shows its numbers in the readout; typing a new time afterwards changes the live scenario and selects it.
- [ ] Works on mock data today; nothing in these folders needs changing when real data lands.
- [ ] `npm test` and `npm run build` pass.

## Prompt to paste into Claude Code

```text
Read CLAUDE.md, docs/data-contract.md and tasks/T08-ui-scenarios.md. Do only that task, on branch t08-ui-scenarios. Edit only the files it lists under "Files you own". If the task needs a change anywhere else, or a new package, stop and tell me. When you think you're finished, run every line of "Done when" and show me the output for each.
```
