# T15: Solar panel choice

Status: done (pull request #36)

| | |
|---|---|
| Tier | if time |
| Waits for | M2 |
| Branch | `t15-panel` |

## Goal

Spec feature F15: flat panel or upright Sun-facing panel, with relative power.

## Files in scope

- `web/src/ui/panel/`
- `web/src/core/panel.ts`, `web/src/core/panel.test.ts`
- The `#panel` slot in `web/index.html`, its line in `web/src/main.ts`, and the `panel.ts`
  and `#panel` rows of `docs/data-contract.md`
- `docs/ai-use/T15.md`, `docs/sources/T15.md`, this file's `Status:` line

## Steps

1. Flat: power = `sunFrac * sin(sun altitude)`. Upright and turning to face the Sun: power = `sunFrac * cos(sun altitude)`.
   The formulas live in `core/panel.ts`, since every number the user sees comes from `core/`.
2. Show both as percentages of full power, now and averaged over the next 30 days, and one sentence on why flat panels are nearly useless at the pole.
3. The module goes in the `#panel` slot, under `#nudge`.

## Done when

- [ ] At a polar site with the Sun 1 degree up, flat shows about 2 % and upright about 100 %.
- [ ] `npm test` and `npm run build` pass.

## Prompt to paste into Claude Code

```text
Read CLAUDE.md, docs/data-contract.md and tasks/T15-panel.md. Do only that task, on branch t15-panel. Use "Files in scope" as the starting scope; follow CLAUDE.md's coordination rules for any additional files or dependencies. When you think you're finished, run every line of "Done when" and show me the output for each.
```
