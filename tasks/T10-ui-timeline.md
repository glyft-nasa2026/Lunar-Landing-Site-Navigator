# T10: Timeline chart with scrubber

Status: not started

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

1. Plotly line chart for the selected scenario: `sunAbove` and `earthAbove` against time, shaded below zero, a vertical marker at the scenario's time.
2. Range buttons 30 days, 90 days, 1 year call `setRange`.
3. Clicking or dragging on the chart calls `setLiveTime`. Throttle it so dragging stays smooth.

## Done when

- [ ] Changing the range redraws within half a second.
- [ ] Dragging moves the marker, and the readout follows.
- [ ] The Sun line crosses zero at the same time the readout's countdown reaches zero.
- [ ] `npm test` and `npm run build` pass.

## Prompt to paste into Claude Code

```text
Read CLAUDE.md, docs/data-contract.md and tasks/T10-ui-timeline.md. Do only that task, on branch t10-ui-timeline. Edit only the files it lists under "Files you own". If the task needs a change anywhere else, or a new package, stop and tell me. When you think you're finished, run every line of "Done when" and show me the output for each.
```
