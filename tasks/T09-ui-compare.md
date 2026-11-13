# T09: Compare table and strips

Status: not started

| | |
|---|---|
| Owner | P3 |
| Tier | must |
| Waits for | T00 |
| Branch | `t09-ui-compare` |

## Goal

Spec features F6 and F7.

## Files you own

- `web/src/ui/compare/`
- `docs/ai-use/T09.md`, `docs/sources/T09.md`, this file's `Status:` line

## Steps

1. Table: first column is row names, then one column per pinned scenario in its colour. Rows and order exactly as F6, from `samplesFor`, `summaryFor`, `flipFor` and `countdownText`. Highlight the better value in each row.
2. Strips (Plotly): two bars per scenario, Sun and Earth, on one axis of days 0-30 since each scenario's own time. Filled where `sunFrac > 0` or `earthUp`. Bar colours come from `themeColor(sc.color)`; the Earth bar is the same colour at half opacity.
3. With nothing pinned, show one line: "Pin a scenario to compare".
4. Build the insides from `docs/design/compare.png` if T22 has merged; if not, use the shared classes plainly. The CSS file goes to T23 once this merges.

## Done when

- [ ] Two pinned scenarios give two filled columns and four bars.
- [ ] The point where a Sun bar ends equals the "sunset in" value in the same column.
- [ ] Unpinning removes the column and bars with no leftover gap.
- [ ] Readable at 1280 px wide with three scenarios.
- [ ] `npm test` and `npm run build` pass.

## Prompt to paste into Claude Code

```text
Read CLAUDE.md, docs/data-contract.md and tasks/T09-ui-compare.md. Do only that task, on branch t09-ui-compare. Edit only the files it lists under "Files you own". If the task needs a change anywhere else, or a new package, stop and tell me. When you think you're finished, run every line of "Done when" and show me the output for each.
```
