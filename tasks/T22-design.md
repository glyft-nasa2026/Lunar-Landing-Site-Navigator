# T22: Design in Figma

Status: done (pull request #22). The team said yes, confirmed by P1 on 14 Nov 2026. No Figma link: the pictures were made from the brief

| | |
|---|---|
| Tier | must |
| Waits for | - |
| Branch | `t22-design` |

## Goal

The look of the whole screen, decided in Figma and handed to the team as pictures, early enough
that module contributors build to it instead of guessing. Runs from kickoff, at the same time as
T00. **Before starting, read `docs/mcp-and-skills.md` section 3.**

## Files in scope

- `docs/design.md`
- `docs/design/` (one exported picture per slot)
- `docs/ai-use/T22.md`, `docs/sources/T22.md`, this file's `Status:` line

## Steps

1. Check your Figma seat first (ask Claude to run Figma's `whoami` tool). You need a Full or Dev seat on Professional or Education for 200 read calls a day. On Starter, follow the fallback in `docs/mcp-and-skills.md`: export pictures by hand and spend no calls.
2. In Figma, create one variable for every name in contract section 6, with the same name minus the dashes (`bg`, `panel`, `scn-a`, `space-3`, `fs-md`). Enter the fixed colours first and leave them alone: scenarios `#E69F00`, `#0072B2`, `#009E73`; Sun `#F0E442`; Earth `#56B4E9`. Dark background: it's space, and the 3D view sits better on dark.
3. Two frames, 1280 wide and 390 wide, laid out as spec section 3, with one layer per slot named by its slot id: `about`, `scene`, `scenarios`, `readout`, `nudge`, `compare`, `timeline`, `sky`. On the phone they stack in that order.
4. Design the inside of each slot from the spec's feature table (F1 to F13). Use only the shared pieces: card, button, primary button, field, table, badge, muted text. Numbers use fixed-width digits so they don't jitter as time moves. System fonts only.
5. Export one PNG per slot into `docs/design/`, named by slot id (`compare.png`), plus `desktop.png` and `phone.png` for the whole screen.
6. `docs/design.md`, one page: the mood in one sentence, the palette as a table (variable, value), the type sizes, the link to the Figma file, and a list of any variable the design needs that the contract doesn't have. Agree the new names with the team together, and coordinate the contract and theme updates.
7. Get a yes from the team in the chat. Open the pull request within the first two hours even if it's rough: a rough picture now helps module contributors more than a finished one tonight. Later changes go in a new small pull request (`t22-design-b`).

## Done when

- [ ] `docs/design/` has one picture for each of the eight slots, and the two whole-screen pictures.
- [ ] `docs/design.md` exists and the team said yes in the chat.
- [ ] Text against its background passes a contrast check of 4.5 to 1 or better (name the checker in the pull request).
- [ ] The three scenario colours are told apart in a colour-blind simulator (screenshot in the pull request).
- [ ] Every colour, size and gap in the frames is a variable from step 2. Nothing is typed in by hand.

## Notes

Mock-up numbers are made up. Nobody copies an angle or a time from a picture into code: every
number on the real site comes from `web/src/core/`.

## After the merge

- 14 Nov 2026: P1 confirmed that everyone on the team said yes to the design.
- 14 Nov 2026, audit of the merged tickets: every contrast and colour-blindness figure in `docs/design.md` was worked out again and matches. `mockup.html` uses only the contract's variable names. No defect found. Open, for P5 and P1:
  - *costs time*: the six items under "Needs P1" in `docs/design.md` have no answer yet. T19 and T23 need them. The section is now titled "Needs team decision".
  - *cosmetic*: there is no picture for `#panel`, the ninth slot, added later by T15.
  - *cosmetic*: `docs/design.md`, under "Rules the pictures follow", calls the live colour "the accent green". `--accent` is blue, in the palette table and in the pictures.

## Prompt to paste into Claude Code

```text
Read CLAUDE.md, docs/data-contract.md section 6, docs/mcp-and-skills.md section 3 and tasks/T22-design.md. Do only that task, on branch t22-design. Use "Files in scope" as the starting scope; follow CLAUDE.md's coordination rules for any additional files or dependencies. I design in Figma; you help me check the frames against the contract and write docs/design.md.

Figma rules for this repo:
- Fetch one frame per call, from the link I give you. Don't walk the whole file: read calls are limited to 200 a day.
- get_design_context returns React and Tailwind by default. This repo uses neither. Treat the result as a picture of the design, not as code to paste.
- Map every value to a variable from contract section 6. If none fits, list it for me; don't invent a name.
- Don't download fonts or add packages. Don't write design-system rules into CLAUDE.md, and don't use the Code Connect tools.
```
