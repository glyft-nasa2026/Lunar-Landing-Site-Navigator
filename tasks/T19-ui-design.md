# T19: Theme, layout, chart style

Status: done (pull request #23). Palette from docs/design.md, --dark #0e1116, #panel placed beside scenarios, chart animation opt-in. "Done when" line 2 (contrast on the built site) does not pass: see "After the merge"

| | |
|---|---|
| Tier | must |
| Waits for | T00, T22 |
| Branch | `t19-ui-design` |

## Goal

The design from T22, built into the three shared files, so five people's modules read as one
product. This task sets the values; every other UI task only uses the names (contract
section 6). **Before starting, read `docs/mcp-and-skills.md` section 3.**

## Files in scope

- `web/src/ui/theme.css`, `web/src/ui/layout.css`, `web/src/ui/plotTheme.ts` (taken over from T00, which made them with placeholder values)
- `docs/ai-use/T19.md`, `docs/sources/T19.md`, this file's `Status:` line

## Steps

1. `theme.css`: set every variable named in contract section 6 to the value in `docs/design.md` (or pull them from Figma with `get_variable_defs`). **Don't rename or remove a variable; other modules depend on the names.** If a new variable is needed, agree its name with the team and include the contract update in this task's scope.
2. Colours that are fixed and must not change: scenario A `#E69F00`, B `#0072B2`, C `#009E73` (chosen to stay distinct for colour-blind users). The Sun is yellow `#F0E442` and Earth is light blue `#56B4E9` in the charts.
3. `layout.css`: the page grid from spec section 3 for the slots in `index.html`. Desktop from 1280 px wide. Below 800 px, the slots stack in this order: about, scene, scenarios, readout, nudge, panel, compare, timeline, sky.
   - `#panel` is T15's Solar panel card (pull request #36), inside `#side` right after `#nudge` in `index.html`. Give it its own place in the grid like the other slots: on desktop in the right-hand column under `#nudge`, beside `#scenarios`; on phone after `#nudge`. If the grid places slots by name (`grid-template-areas`, with `#side` as `display: contents`), that means the Scenarios row becomes `'scenarios panel'`, `panel` comes after `nudge` on phone, and `#panel { grid-area: panel; }`. Not a row of its own beside the scene: that stretches the map card, whose viewport has a fixed height, and leaves an empty band under the map. Without an area of its own the card is auto-placed at the top of the page, above the map.

     The changes to `layout.css`, also posted on pull request #23 as suggestions (tested on that
     branch merged with `main`):

     ```css
     /* #app, desktop grid-template-areas: the Scenarios row */
         'scenarios panel'

     /* beside the #nudge rule */
     #panel {
       grid-area: panel;
       align-self: start;
     }

     /* add #panel to the list of slots that get min-width: 0 */
     #nudge,
     #panel,

     /* @media (max-width: 800px), #app grid-template-areas: after 'nudge' */
           'panel'
     ```

     Also add `panel` after `nudge` in the phone-order comment above the media query.
4. Shared pieces as classes in `theme.css`: `.card`, `.btn`, `.btn-primary`, `.field`, `.table`, `.badge`, `.muted`. Numbers in readouts and tables use fixed-width digits so they don't jitter as time moves.
5. `plotTheme.ts`: `plotLayout()`, which every Plotly chart spreads into its layout (background, grid lines, fonts, margins), and `themeColor()`, both reading the same variables. No second copy of a colour.
6. Use the system font stack. No web-font download.
7. Take two screenshots of the deployed site, desktop and phone, and post them in the chat for the pitch (T17 uses the same palette for the slides).

## Done when

- [x] Every variable in contract section 6 is set; none renamed or removed.
- [ ] On the built site, text against its background passes a contrast check of 4.5 to 1 or better (name the checker used in the pull request).
- [x] Searching `web/src/ui/` and `web/src/scene/` for `#` colour codes finds them only in `theme.css`. List any others in the pull request so someone can claim the module fix.
- [x] At 1280 px wide nothing overlaps or scrolls sideways; at 390 px wide every slot is reachable by scrolling down.
- [x] `#panel` sits under `#nudge` in the right-hand column, beside `#scenarios`, at 1280 px, and after `#nudge` at 390 px.
- [x] `npm test` and `npm run build` pass.

## Notes

This task focuses on the three shared theme files. If a module hard-codes a colour or size,
record a focused module fix or include it in a declared scope expansion after checking for
overlap. T23 covers the CSS polish after each module merges; anyone can take that work.

## After the merge

14 Nov 2026, audit of the merged tickets, measured on the built site in headless Chromium.

Checked and correct: all 32 variables and 7 classes of contract section 6 are set, and no module uses a name that isn't; no colour code outside `theme.css`; no sideways scroll or card overlap in 24 cases (five widths, plus 801 and 900 px, with 0 to 3 pins); `#panel` beside Scenarios at 1280 and after Readout on a phone; all three charts use `plotLayout()`; chart animation is off unless asked for and absent under reduced motion; a focus ring shows on every tab stop (34 at 1280 px).

Open, for the theme's owner and the team. Nothing was changed: each of these changes how the whole site looks.

- *costs time*: **every type size is one eighth smaller than the theme says.** `theme.css` sets `font-size: var(--fs-md)` on `html` as well as `body`, so the root is 14 px and every `rem` shrinks with it. Measured: 10.5, 12.25, 19.25 and 28 px for `--fs-sm` to `--fs-xl`, where the file's own comment and `docs/design.md` say 12, 14, 22 and 32. Chart tick labels are 10.5 px. Setting the size on `body` alone gives the documented sizes; `layout.css` then needs a look at every width, because all text grows by a seventh.
- *costs time*: **the timeline's "Hidden (below skyline)" band can't be seen.** It is drawn in `--dark`, which is now the same colour as `--bg`: 1.04 to 1 against the card (the legend swatch 1.10 to 1).
- *costs time*: **"Done when" line 2 fails for text drawn over the map.** Map labels are 2.9 to 3.3 to 1 on lit ground ("89°S", "60°E", "Sun overhead"), and the out-of-table message over the map is under 4.5 to 1 on 31 % of its pixels. The pull request checked the palette's pairs only. An outline in `--bg` round map text, and a card background behind the message, would fix both (`web/src/map/index.ts`, `web/src/scene/scene.css`).
- *cosmetic*: the empty time box's placeholder is the browser's grey, 4.10 to 1; `.field::placeholder { color: var(--muted) }` fixes it.
- *cosmetic*: graphics under 3 to 1: scenario B's dot and bar on its card (2.97), the field outline (1.46), map pins for B and C on some ground (2.77, 1.76; the pins carry no letters), the half-strength Earth strips (item 4 of "Needs team decision" in `docs/design.md`).
- *cosmetic*: a chart that sets an axis title loses the theme's title style (`title: { text }` replaces `title.font`): the sky chart's and the compare strips' titles are 13 px in `--text`, the ticks 10.5 px in `--muted`.
- *cosmetic*: at 801 px the nudge panel covers 288 px of a 399 px map; at 1280 × 600 there is a 101 px empty band under the map captions.
- *cosmetic*: pixel values left in modules: `1px` borders in `nudge.css` and `timeline.css`, pixel numbers handed to Plotly in `ui/timeline/index.ts` and `ui/sky/index.ts`, a `'sans-serif'` fallback and 12 and 4 px defaults in `map/index.ts`.
- Not checked: any browser but Chromium, a real phone.

## Prompt to paste into Claude Code

```text
Read CLAUDE.md, docs/data-contract.md, docs/design.md, docs/mcp-and-skills.md section 3 and tasks/T19-ui-design.md. Do only that task, on branch t19-ui-design. Use "Files in scope" as the starting scope; follow CLAUDE.md's coordination rules for any additional files or dependencies. When you think you're finished, run every line of "Done when" and show me the output for each.

Figma rules for this repo:
- Fetch one frame per call, from the link I give you. Don't walk the whole file: read calls are limited to 200 a day.
- get_design_context returns React and Tailwind by default. This repo uses neither. Ask for plain HTML and CSS, and treat the result as a picture of the design, not as code to paste.
- Write no colour code, font or pixel size outside theme.css. Map every value to a variable from contract section 6. If none fits, stop and tell me.
- Don't download fonts or add packages. Don't write design-system rules into CLAUDE.md, and don't use the Code Connect tools.
```
