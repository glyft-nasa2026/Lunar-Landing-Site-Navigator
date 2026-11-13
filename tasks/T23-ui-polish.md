# T23: UI polish: every module matches the design

Status: not started

| | |
|---|---|
| Owner | P5 (UI designer) |
| Tier | must |
| Waits for | T19, and for each module, that module's own task |
| Branch | `t23-ui-polish`, then `t23-ui-polish-b`, `-c`, ... one small pull request per module |

## Goal

Each module on the built site looks like its picture in `docs/design/`, on desktop and on a
phone. The module's owner made it work; you make it right.

## Files you own

The CSS file inside each module folder, from the moment that module's own task has merged:

| CSS file in | Yours after |
|---|---|
| `web/src/ui/scenarios/`, `web/src/ui/readout/` | T08 |
| `web/src/ui/compare/` | T09 |
| `web/src/ui/timeline/` | T10 |
| `web/src/ui/sky/` | T11 |
| `web/src/scene/` | T12 |
| `web/src/ui/nudge/` | T13 |

- `docs/ai-use/T23.md`, `docs/sources/T23.md`, this file's `Status:` line

Not yours: any `index.ts`. If the design needs different markup or another class name, ask the
module's owner in the chat. `web/src/ui/about/` is already all yours under T16.

## Steps

1. Take one merged module at a time. Open the built site beside `docs/design/<slot id>.png`.
2. Change only that module's CSS file. Use the variables and classes of contract section 6; the one pixel value allowed is the phone breakpoint, `@media (max-width: 800px)`.
3. Check it at 1280 px and at 390 px.
4. One small pull request per module, so the module's owner can keep working on `index.ts` without waiting for you.

## Done when

- [ ] Each of the seven modules above has been compared with its picture at both widths. List them in the pull request with a before and after screenshot.
- [ ] No `#` colour code, font name or pixel size in any module CSS file, apart from the breakpoint.
- [ ] At 390 px wide nothing overlaps and nothing scrolls sideways.
- [ ] `npm test` and `npm run build` pass.

## Prompt to paste into Claude Code

```text
Read CLAUDE.md, docs/data-contract.md section 6, docs/design.md and tasks/T23-ui-polish.md. I'll tell you which module we're doing; read its picture in docs/design/ and its CSS file. Edit only that CSS file. If the design needs a change in index.ts or in the theme, stop and tell me. When you think you're finished, run every line of "Done when" that applies to this module and show me the output.
```
