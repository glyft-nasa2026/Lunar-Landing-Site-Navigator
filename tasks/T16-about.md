# T16: About page and the Horizons badge

Status: not started

| | |
|---|---|
| Owner | P5 (text), P3 (wiring) |
| Tier | must |
| Waits for | T03 |
| Branch | `t16-about` |

## Goal

Spec feature F13.

## Files you own

- `web/src/ui/about/`
- `docs/ai-use/T16.md`, `docs/sources/T16.md`, this file's `Status:` line

## Steps

1. Badge on the main screen: "Checked against JPL Horizons: largest difference X degrees", read from `validation.json`.
2. About panel, in plain words: what the tool shows, the known limits from spec section 8, why there's no refraction, the data sources (collected from `docs/sources/`), how AI was used (collected from `docs/ai-use/`).

## Done when

- [ ] The badge number equals `max_diff_deg` in the file.
- [ ] Every source in `docs/sources/` appears on the page with its link.
- [ ] `npm test` and `npm run build` pass.

## Prompt to paste into Claude Code

```text
Read CLAUDE.md, docs/data-contract.md and tasks/T16-about.md. Do only that task, on branch t16-about. Edit only the files it lists under "Files you own". If the task needs a change anywhere else, or a new package, stop and tell me. When you think you're finished, run every line of "Done when" and show me the output for each.
```
