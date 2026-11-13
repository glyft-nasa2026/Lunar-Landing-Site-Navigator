# T15: Solar panel choice

Status: not started

| | |
|---|---|
| Owner | unassigned |
| Tier | if time |
| Waits for | M2 |
| Branch | `t15-panel` |

## Goal

Spec feature F15: flat panel or upright Sun-facing panel, with relative power.

## Files you own

- `web/src/ui/panel/`
- `docs/ai-use/T15.md`, `docs/sources/T15.md`, this file's `Status:` line

## Steps

1. Flat: power = `sunFrac * sin(sun altitude)`. Upright and turning to face the Sun: power = `sunFrac * cos(sun altitude)`.
2. Show both as percentages of full power, and one sentence on why flat panels are nearly useless at the pole.
3. Needs a slot in `index.html`: agree with P1.

## Done when

- [ ] At a polar site with the Sun 1 degree up, flat shows about 2 % and upright about 100 %.
- [ ] `npm test` and `npm run build` pass.

## Prompt to paste into Claude Code

```text
Read CLAUDE.md, docs/data-contract.md and tasks/T15-panel.md. Do only that task, on branch t15-panel. Edit only the files it lists under "Files you own". If the task needs a change anywhere else, or a new package, stop and tell me. When you think you're finished, run every line of "Done when" and show me the output for each.
```
