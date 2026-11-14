# T23: UI polish: every module matches the design

Status: not started

| | |
|---|---|
| Tier | must |
| Waits for | T19, and for each module, that module's own task |
| Branch | `t23-ui-polish`, then `t23-ui-polish-b`, `-c`, ... one small pull request per module, one open at a time |

## Goal

Each module on the built site looks like its picture in `docs/design/`, on desktop and on a
phone. Anyone can take this polish after the module's implementation has merged.

## Files in scope

The CSS file inside each module folder, from the moment that module's own task has merged:

| CSS file in | Ready after |
|---|---|
| `web/src/ui/scenarios/`, `web/src/ui/readout/` | T08 |
| `web/src/ui/compare/` | T09 |
| `web/src/ui/timeline/` | T10 |
| `web/src/ui/sky/` | T11 |
| `web/src/scene/` | T12 |
| `web/src/ui/nudge/` | T13 |

- `docs/ai-use/T23.md`, `docs/sources/T23.md`, this file's `Status:` line

Start with CSS. If the design needs different markup or another class name, include the
necessary `index.ts` change in the declared scope and coordinate any active work on it.
The About module is covered by T16; anyone can take that task too.

## Steps

1. Take one merged module at a time. Open the built site beside `docs/design/<slot id>.png`.
2. Change that module's CSS, plus any coordinated markup changes needed for the design. Use the variables and classes of contract section 6; the one pixel value allowed is the phone breakpoint, `@media (max-width: 800px)`.
3. Check it at 1280 px and at 390 px.
4. One small pull request per module, so other contributors can work on separate files. Make the next branch only after the one before has merged: each of them edits `docs/ai-use/T23.md`, `docs/sources/T23.md` and the `Status:` line, so two open together would conflict with each other.

## Done when

- [ ] Each of the seven modules above has been compared with its picture at both widths. List them in the pull request with a before and after screenshot.
- [ ] No `#` colour code, font name or pixel size in any module CSS file, apart from the breakpoint.
- [ ] At 390 px wide nothing overlaps and nothing scrolls sideways.
- [ ] `npm test` and `npm run build` pass.

## Prompt to paste into Claude Code

```text
Read CLAUDE.md, docs/data-contract.md section 6, docs/design.md and tasks/T23-ui-polish.md. I'll tell you which module we're doing; read its picture in docs/design/ and its CSS file. Start with that CSS file, and T23's AI-use notes, sources and Status line. Follow CLAUDE.md's coordination rules for any additional markup or theme changes. When you think you're finished, run every line of "Done when" that applies to this module and show me the output.
```
