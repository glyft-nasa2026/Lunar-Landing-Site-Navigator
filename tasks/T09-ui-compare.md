# T09: Compare table and strips

Status: done (first delivery #21; Live column #47; resize fix for issue #49, #64; cut-short window and sliver fixes #74)

| | |
|---|---|
| Tier | must |
| Waits for | T00 |
| Branch | `t09-ui-compare` |

## Goal

Spec features F6 and F7.

## Files in scope

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

## After the merge

- 14 Nov 2026, pull request #47 (issue #45): a Live column comes first, before the pinned ones. Steps 1 and 2 above say "one column per pinned scenario"; `SPEC.md` F6 and F7 still say so too (issue #51, waiting on P1).
- 14 Nov 2026, pull request #64 (issue #49): the strips are redrawn at the box's width on every draw and on every change of width.
- 14 Nov 2026, pull request #74 (`t09-ui-compare-d`), from the audit of merged tickets:
  - A scenario with fewer than 30 days of table after it shows a dash in the five 30-day rows, and its strip stops where the data stops. Before, the short window was ranked as if whole.
  - One value beside a dash is not marked best.
  - "Sun now" rounds the disc as the readout does: a sliver reads 1 %, not 0 %.

## Prompt to paste into Claude Code

```text
Read CLAUDE.md, docs/data-contract.md and tasks/T09-ui-compare.md. Do only that task, on branch t09-ui-compare. Use "Files in scope" as the starting scope; follow CLAUDE.md's coordination rules for any additional files or dependencies. When you think you're finished, run every line of "Done when" and show me the output for each.
```
