# T19: Look and feel: theme, layout, chart style

Status: not started

| | |
|---|---|
| Owner | P5 |
| Tier | must |
| Waits for | T00 |
| Branch | `t19-ui-design` |

## Goal

One look across the whole site, so five people's modules read as one product. This task sets the
values; every other UI task only uses the names (contract section 6).

## Files you own

- `web/src/ui/theme.css` (T00 creates it with placeholder values; from here it's yours)
- `web/src/ui/layout.css` (same)
- `web/src/ui/plotTheme.ts` (same)
- `docs/design.md`
- `docs/ai-use/T19.md`, `docs/sources/T19.md`, this file's `Status:` line

## Steps

1. Write `docs/design.md`, one page: the mood in one sentence, the palette, the type sizes, and a sketch of the screen at desktop and phone width. Get a yes from the team before step 2. Keep it short; this is the only part other people need to read.
2. `theme.css`: set every variable named in contract section 6. Dark background (it's space, and the 3D view sits better on dark). **Don't rename or remove a variable; other modules depend on the names.** A new variable needs P1 to add it to the contract first.
3. Colours that are fixed and must not change: scenario A `#E69F00`, B `#0072B2`, C `#009E73` (chosen to stay distinct for colour-blind users). The Sun is yellow `#F0E442` and Earth is light blue `#56B4E9` in the charts.
4. `layout.css`: the page grid from spec section 3 for the slots in `index.html`. Desktop from 1280 px wide. Below 800 px, the slots stack in this order: scene, readout, scenarios, compare, timeline, sky.
5. Shared pieces as classes in `theme.css`: `.card`, `.btn`, `.btn-primary`, `.field`, `.table`, `.badge`, `.muted`. Numbers in readouts and tables use fixed-width digits so they don't jitter as time moves.
6. `plotTheme.ts`: export one `plotLayout()` that every Plotly chart spreads into its layout (background, grid lines, fonts, margins), reading the same colours.
7. Use the system font stack. No web-font download.
8. Take two screenshots of the deployed site, desktop and phone, for the pitch (T17 uses the same palette for the slides).

## Done when

- [ ] `docs/design.md` exists and the team said yes in the chat.
- [ ] Every variable in contract section 6 is set; none renamed or removed.
- [ ] Text against its background passes a contrast check of 4.5 to 1 or better (name the checker used in the pull request).
- [ ] Searching `web/src/ui/` and `web/src/scene/` for `#` colour codes finds them only in `theme.css` and `plotTheme.ts`. List any others in the pull request for their owners to fix.
- [ ] At 1280 px wide nothing overlaps or scrolls sideways; at 390 px wide every slot is reachable by scrolling down.
- [ ] The three scenario colours are told apart in a colour-blind simulator (screenshot in the pull request).
- [ ] `npm test` and `npm run build` pass.

## Notes

This task changes values in three files and nothing else. If a module looks wrong because it
hard-coded a colour or a size, that's a fix in the module, by its owner.

## Prompt to paste into Claude Code

```text
Read CLAUDE.md, docs/data-contract.md and tasks/T19-ui-design.md. Do only that task, on branch t19-ui-design. Edit only the files it lists under "Files you own". If the task needs a change anywhere else, or a new package, stop and tell me. When you think you're finished, run every line of "Done when" and show me the output for each.
```
