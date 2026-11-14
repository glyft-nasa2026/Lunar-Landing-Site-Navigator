# T14: Map layers

Status: not started

| | |
|---|---|
| Tier | if time |
| Waits for | M2 |
| Branch | `t14-layers` |

## Goal

Spec feature F14: overlays for lit %, Earth-visible %, never lit and height, with on/off and transparency.

## Files in scope

- `data-prep/make_layers.py`, `web/public/data/layers/`, `web/src/ui/layers/`
- The layer slot and mount in `web/index.html` and `web/src/main.ts`, scene hooks in
  `web/src/scene/`, and their entries in `docs/data-contract.md`; coordinate with active scene
  and layout work before editing
- `docs/ai-use/T14.md`, `docs/sources/T14.md`, this file's `Status:` line

## Steps

1. First check whether the LOLA team has already published average-sunlight maps of the south pole. If so, use and cite them.
2. Otherwise compute in Python at low resolution (about 1 km cells, 72 directions) over one year.
3. Include the slot, mount, scene hook and contract update in this task; coordinate their integration with any active scene or layout task before starting.

## Done when

- [ ] Each layer toggles and fades.
- [ ] The never-lit layer covers Shackleton's floor.
- [ ] `npm test` and `npm run build` pass.

## Prompt to paste into Claude Code

```text
Read CLAUDE.md, docs/data-contract.md and tasks/T14-layers.md. Do only that task, on branch t14-layers. Use "Files in scope" as the starting scope; follow CLAUDE.md's coordination rules for any additional files or dependencies. When you think you're finished, run every line of "Done when" and show me the output for each.
```
