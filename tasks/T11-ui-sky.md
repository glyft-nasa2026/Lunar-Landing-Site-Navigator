# T11: Sky panorama

Status: done (pull request #17)

| | |
|---|---|
| Tier | must |
| Waits for | T05 |
| Branch | `t11-ui-sky` |

## Goal

Spec feature F9.

## Files in scope

- `web/src/ui/sky/`
- `docs/ai-use/T11.md`, `docs/sources/T11.md`, this file's `Status:` line

## Steps

1. Plotly chart: azimuth 0-360 across (labelled N, E, S, W), elevation -5 to +15 degrees up.
2. Skyline from `skylineFor(selected)` as a filled dark shape from the bottom.
3. The Sun's and Earth's paths over the next 30 days as thin lines (from `samplesFor`), and a marker for each at the scenario's time. Colours from `themeColor('--sun')` and `themeColor('--earth')`.
4. Auto-raise the top of the axis when the Sun or Earth is higher than 15 degrees (non-polar sites).
5. Build it from `docs/design/sky.png` if T22 has merged. The CSS file goes to T23 once this merges.

## Done when

- [ ] On the crater floor (contract section 2 says where) the skyline is high all round and the Sun marker is under it.
- [ ] The Sun marker is below the skyline exactly when the readout says the Sun is hidden. Check 5 times by scrubbing.
- [ ] At an Apollo site the chart still shows Earth, high in the sky.
- [ ] `npm test` and `npm run build` pass.

## After the merge

- 14 Nov 2026, audit of the merged tickets: the chart was looked at in headless Chromium on the real table and height map. The three browser lines of "Done when" hold (crater floor, marker state against the readout at 10 times, Apollo 11 with Earth high in the sky), and nine more sites drew correctly, both poles and longitude 180 among them.
- Open, for P2:
  - *cosmetic*: a sliver of Sun reads "0 % of the disc" in the hover while the readout says 1 % (`index.ts`, plain `Math.round`). Seen at -89.5, 0 on 2026-11-22 15:13.
  - *cosmetic*: line widths (1 and 2) are written as numbers in `index.ts`. The rule is no pixel sizes in a module.

## Prompt to paste into Claude Code

```text
Read CLAUDE.md, docs/data-contract.md and tasks/T11-ui-sky.md. Do only that task, on branch t11-ui-sky. Use "Files in scope" as the starting scope; follow CLAUDE.md's coordination rules for any additional files or dependencies. When you think you're finished, run every line of "Done when" and show me the output for each.
```
