# T16: About bar, About panel and the Horizons badge

Status: not started

| | |
|---|---|
| Owner | P5 (UI designer) |
| Tier | must |
| Waits for | T00 |
| Branch | `t16-about` |

## Goal

Spec feature F13, built and written by one person.

## Files you own

- `web/src/ui/about/` (taken over from T00's placeholder; all of it, CSS included)
- `docs/ai-use/T16.md`, `docs/sources/T16.md`, this file's `Status:` line

## Steps

1. The `#about` slot is a thin bar across the top: the product name, the badge, and an About button that opens a panel.
2. Badge: "Checked against JPL Horizons: largest difference X degrees", read from `validation.json`. While `checked_at` is `null` (mock data), it says "Horizons check pending".
3. About panel, in plain words: what the tool shows, the known limits from spec section 8, why there's no refraction, the data sources (collected from `docs/sources/`), how AI was used (collected from `docs/ai-use/`). Keep the text in one place at the top of the file, so it's easy to update at the freeze.
4. Collect the sources and AI-use text twice: once now, and again at M3, when every task has filled in its files.

## Done when

- [ ] On mock data the badge says "Horizons check pending"; after T03 its number equals `max_diff_deg` in the file.
- [ ] Every source in `docs/sources/` appears on the page with its link.
- [ ] The panel opens and closes on desktop and at 390 px wide.
- [ ] `npm test` and `npm run build` pass.

## Prompt to paste into Claude Code

```text
Read CLAUDE.md, docs/data-contract.md, docs/design.md and tasks/T16-about.md. Do only that task, on branch t16-about. Edit only the files it lists under "Files you own". If the task needs a change anywhere else, or a new package, stop and tell me. When you think you're finished, run every line of "Done when" and show me the output for each.
```
