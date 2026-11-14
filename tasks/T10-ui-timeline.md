# T10: Timeline chart with scrubber

Status: done, pull request open

| | |
|---|---|
| Owner | P3 |
| Tier | must |
| Waits for | T00 |
| Branch | `t10-ui-timeline` |

## Goal

Spec feature F8.

## Files you own

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

## Prompt to paste into Claude Code

```text
Read CLAUDE.md, docs/data-contract.md and tasks/T10-ui-timeline.md. Do only that task, on branch t10-ui-timeline. Edit only the files it lists under "Files you own". If the task needs a change anywhere else, or a new package, stop and tell me. When you think you're finished, run every line of "Done when" and show me the output for each.
```
