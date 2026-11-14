# T10: Timeline chart with scrubber

Status: done (pull request #34; time zone, pinned press and "Loading" fixes in #54)

| | |
|---|---|
| Tier | must |
| Waits for | T00 |
| Branch | `t10-ui-timeline` |

## Goal

Spec feature F8.

## Files in scope

- `web/src/ui/timeline/`
- `docs/ai-use/T10.md`, `docs/sources/T10.md`, this file's `Status:` line

## Steps

1. Plotly line chart for the selected scenario, from `timelineFor(selected(), range)`: `sunAbove` and `earthAbove` against time, shaded below zero, a vertical marker at the scenario's time. Line colours from `themeColor('--sun')` and `themeColor('--earth')`.
2. Range buttons 30 days, 90 days, 1 year call `setRange`. Earlier and later buttons call `shiftWindow(-1)` and `shiftWindow(1)`.
3. Clicking or dragging on the chart calls `setLiveTime`. Throttle it so dragging stays smooth. The window stays put during a drag (contract section 4), so the marker moves and the chart doesn't.
4. Build it from `docs/design/timeline.png` if T22 has merged. The CSS file goes to T23 once this merges.

## Done when

- [ ] Changing the range redraws within half a second.
- [ ] Dragging moves the marker left and right while the lines stay still, and the readout follows.
- [ ] With a pinned scenario selected, a click on the chart changes the live scenario and selects it; the pinned one is unchanged.
- [ ] The Sun line crosses zero at the same time the readout's countdown reaches zero.
- [ ] `npm test` and `npm run build` pass.

## After the merge

- 14 Nov 2026, pull request #54 (`t10-ui-timeline-b`): three defects found by the audit of merged tickets.
  - The axis and the hover showed the browser's local time under the label UTC (8 hours ahead in Malaysia). Plotly now gets UTC times as strings with no zone, which it shows as written.
  - With a pinned scenario selected, a press on the chart followed by any pointer move threw the live time by up to the whole range. Such a press now sets the live time once and never starts a drag; the third "Done when" line holds with or without movement.
  - With the table loaded, a window with fewer than two samples said "Loading" for good (from 2100-12-31 23:00, and in a decade whose file failed to download). The module now says the window is outside the table, or that the table ends within two hours.

## Prompt to paste into Claude Code

```text
Read CLAUDE.md, docs/data-contract.md and tasks/T10-ui-timeline.md. Do only that task, on branch t10-ui-timeline. Use "Files in scope" as the starting scope; follow CLAUDE.md's coordination rules for any additional files or dependencies. When you think you're finished, run every line of "Done when" and show me the output for each.
```
