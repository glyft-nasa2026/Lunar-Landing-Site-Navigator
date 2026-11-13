# T14: Map layers

Status: not started

| | |
|---|---|
| Owner | unassigned |
| Tier | if time |
| Waits for | M2 |
| Branch | `t14-layers` |

## Goal

Spec feature F14: overlays for lit %, Earth-visible %, never lit and height, with on/off and transparency.

## Files you own

- `data-prep/make_layers.py`, `web/public/data/layers/`, `web/src/ui/layers/`
- `docs/ai-use/T14.md`, `docs/sources/T14.md`, this file's `Status:` line

## Steps

1. First check whether the LOLA team has already published average-sunlight maps of the south pole. If so, use and cite them.
2. Otherwise compute in Python at low resolution (about 1 km cells, 72 directions) over one year.
3. Needs a slot in `index.html` and a hook in the scene: agree both with P1 before starting.

## Done when

- [ ] Each layer toggles and fades.
- [ ] The never-lit layer covers Shackleton's floor.
- [ ] `npm test` and `npm run build` pass.

## Prompt to paste into Claude Code

```text
Read CLAUDE.md, docs/data-contract.md and tasks/T14-layers.md. Do only that task, on branch t14-layers. Edit only the files it lists under "Files you own". If the task needs a change anywhere else, or a new package, stop and tell me. When you think you're finished, run every line of "Done when" and show me the output for each.
```
