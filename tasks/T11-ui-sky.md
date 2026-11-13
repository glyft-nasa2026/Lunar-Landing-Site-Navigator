# T11: Sky panorama

Status: not started

| | |
|---|---|
| Owner | P2 |
| Tier | must |
| Waits for | T05 |
| Branch | `t11-ui-sky` |

## Goal

Spec feature F9.

## Files you own

- `web/src/ui/sky/`
- `docs/ai-use/T11.md`, `docs/sources/T11.md`, this file's `Status:` line

## Steps

1. Plotly chart: azimuth 0-360 across (labelled N, E, S, W), elevation -5 to +15 degrees up.
2. Skyline from `skylineFor(selected)` as a filled dark shape from the bottom.
3. The Sun's and Earth's paths over the next 30 days as thin lines, and a marker for each at the scenario's time.
4. Auto-raise the top of the axis when the Sun or Earth is higher than 15 degrees (non-polar sites).

## Done when

- [ ] On the mock crater floor the skyline is high all round and the Sun marker is under it.
- [ ] The Sun marker is below the skyline exactly when the readout says the Sun is hidden. Check 5 times by scrubbing.
- [ ] At an Apollo site the chart still shows Earth, high in the sky.
- [ ] `npm test` and `npm run build` pass.

## Prompt to paste into Claude Code

```text
Read CLAUDE.md, docs/data-contract.md and tasks/T11-ui-sky.md. Do only that task, on branch t11-ui-sky. Edit only the files it lists under "Files you own". If the task needs a change anywhere else, or a new package, stop and tell me. When you think you're finished, run every line of "Done when" and show me the output for each.
```
