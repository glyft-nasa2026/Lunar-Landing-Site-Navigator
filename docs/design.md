# Design: DARKSIGHT

**Mood:** a quiet mission-control screen at night: near-black page, slate panels, one soft-blue
accent, thin lines, pill buttons and lots of empty space.

**Sources:** the DARKSIGHT brief (pasted by P5), `tasks/Quarterly Company News.pdf` (logo,
hero, wireframes for 01 Explore, 02 Comparison and 04 Simulation, Launch Site, flight sequence,
report) and `tasks/Untitled.svg` (13 frames of the earlier "lune" design, red on navy). Where
they disagree, the spec wins on behaviour. **Colours come from `web/src/ui/theme.css` on
`main`**, not from the brief, so the pictures match what the modules already draw; layout, type
and the mock data stay as designed. The SVG frames are the
reference for what goes inside a card (the compare cards and the telemetry panel), recoloured
to the brief.

**Figma:** no Figma link has been shared yet, so no Figma calls were spent. The pictures come
from `docs/design/mockup.html`, rendered with headless Edge (the fallback in
`docs/mcp-and-skills.md` section 3). It uses only contract section 6 names. When the Figma file
exists, paste its link here: _(link to come)_.

## Pictures (`docs/design/`)

| File | What |
|---|---|
| `desktop.png` | Whole screen, 1280 wide |
| `phone.png` | Whole screen, 390 wide, slots stacked in contract order: about, scene, scenarios, readout, nudge, panel, compare, timeline, sky |
| `about.png` `scene.png` `scenarios.png` `readout.png` `nudge.png` `panel.png` `compare.png` `timeline.png` `sky.png` | One per slot, at its desktop width (nine slots) |
| `components.png` | Every state: button (secondary, hover, pressed, focus, selected, disabled), primary, tab, toggle, site chip (filled, selected, empty), info pill, field (focus, error), toast, tooltip on disabled Proceed |
| `loading.png`, `hero.png` | Brief frames 1 and 2. **Proposals only**: they aren't slots (see "Needs P1") |
| `cvd.png` | Scenario, Sun and Earth colours under protanopia, deuteranopia, tritanopia |

Mock-up numbers are made up. Nobody copies an angle or a time from a picture into code.

## Palette

Every colour is the value `main`'s `theme.css` has today. The brief's tokens (Midnight Lapis,
Clear Bamboo, Deep Hanada) are no longer used.

| Variable | Value |
|---|---|
| `--bg` | `#0e1116` |
| `--panel` | `#171b22` |
| `--panel-2` | `#1f2530` |
| `--border` | `#303846` |
| `--text` | `#e6e9ee` |
| `--muted` | `#a3acb9` |
| `--accent` | `#8ab4f8` |
| `--ok` `--warn` `--bad` | `#7bd88f` `#f2c94c` `#ff8a80` |
| `--scn-a` `--scn-b` `--scn-c` | `#E69F00` `#0072B2` `#009E73` (fixed) |
| `--scn-ghost` | `#8a8f98` |
| `--sun` `--earth` | `#F0E442` `#56B4E9` (fixed) |
| `--lit` | `#e6e9ee` |
| `--dark` | `#0e1116` (T19's choice, #23) |
| `--terrain-lo` `--terrain-hi` | `#3a3f47` `#d9dce1` |
| `--radius` | `6px` |
| `--space-1` … `--space-5` | 4, 8, 12, 16, 24 px |

**Strips on `--dark`.** T19 set `--dark` to the page colour `#0e1116`: on main's earlier
`#262c36` scenario B's strip was 2.71 : 1. Now the solid strips are A 8.40, B 3.65, C 5.53, all
above the 3 : 1 that WCAG asks of graphics.

## Type

| Variable | Size | Use |
|---|---|---|
| `--fs-sm` | 12 px | Labels, section titles (mono, upper case), rulers, pills |
| `--fs-md` | 14 px | Body, table, buttons |
| `--fs-lg` | 22 px | Card titles, zoom +/− |
| `--fs-xl` | 32 px | Page title |

`--font` is the system sans stack and `--font-num` the system mono stack. Every number uses
`--font-num` with tabular digits, so nothing jitters as time moves. Nothing is downloaded.

## Rules the pictures follow

- Pins, chips, table columns and strips use the scenario colour plus the letter (A, B, C), so
  colour is never the only clue. The live site uses `--accent` (soft blue).
- Active tab: accent text with a 2 px underline. Inactive: muted. Focus: 2 px accent outline on
  everything you can press.
- Disabled is 40 % opacity, with a tooltip saying why ("Select at least one site").
- The best value in each compare row is `--ok` with a dot.
- Charts: card background, `--border` grid, mono `--muted` ticks, dashed zero line, area below
  the skyline in `--dark`.

## Checks

**Contrast** (WCAG 2.1 relative-luminance formula, own script, semi-transparent text blended
over its background first). All text pairs pass 4.5 : 1:

| Text | on `--bg` | on `--panel` | on `--panel-2` |
|---|---|---|---|
| `--text` | 15.54 | 14.19 | 12.64 |
| `--muted` | 8.25 | 7.53 | 6.71 |
| `--accent` | 8.97 | 8.19 | 7.30 |
| `--ok` | 10.86 | 9.92 | 8.83 |
| `--warn` | 11.92 | 10.88 | 9.69 |
| `--bad` | 8.28 | 7.56 | 6.74 |

`--bg` text on `--accent` (primary button) 8.97; `--bg` on `--text` (hero button, tooltip, pin
label) 15.54. Disabled controls at 40 % fall below 4.5 : 1; WCAG exempts them.

**Colour blindness** (Machado, Oliveira, Fernandes 2009, severity 1.0; `cvd.png`). CIE76 ΔE
between scenario colours:

| | A/B | A/C | B/C |
|---|---|---|---|
| Normal | 120.2 | 88.7 | 70.1 |
| Protanopia | 109.5 | 51.6 | 58.2 |
| Deuteranopia | 121.7 | 66.2 | 55.7 |
| Tritanopia | 79.1 | 83.7 | **17.0** |

All three are told apart in protanopia and deuteranopia. In tritanopia (about 1 in 10 000) B and
C come closest, which is why every pin, chip and strip also carries its letter.

**Typed in by hand.** No colour code appears outside the `:root` block of `mockup.html`. The
pixel values left are line widths (1 px borders, 2 px focus outline and tab underline, toggle
knob inset), the pill rounding in item 1 below, the canvas sizes (1280, 390, 1440 × 900), and
positions in the two proposal frames (loading, hero).

## Needs P1 (asked once, all together)

Values the design needs that the contract doesn't name. Nothing below was given a name.

1. **Pill rounding.** Buttons, pills, chips and toggles are fully round (`999px`); `--radius` is
   the card rounding (6 px). Written as a literal for now.
2. **Brand gradient** `linear-gradient(135deg, --text 12.5%, --accent 37.5%, --border 62.5%,
   --panel 87.5%)` plus 3 % noise: loading bar, hero glow, primary-button hover. Built from
   existing colours, but the gradient itself has no name.
3. **Hero type:** 72 px bold sans and 56 px bold serif. Larger than `--fs-xl`; the serif needs a
   system serif stack (Georgia, 'Times New Roman', serif), and there is no serif variable.
4. **Half-strength Earth bars** (contract section 6) are 1.60 : 1 for B and 2.02 : 1 for C
   against the strip background, below the 3 : 1 that WCAG asks of graphics. Suggest drawing the
   Earth bar at full strength with a hatch, or as a thinner bar.
5. **Not in the spec**, so not a slot (each needs a spec or index.html change, or it stays out):
   - Tabs "01 Explore · 02 Comparison · 03 Launch Site · 04 Simulation". The picture shows them
     in `#about` as links that scroll to `#scene`, `#compare` and `#timeline`. "Launch Site"
     (picking an Earth launch pad, PDF page 6), the flight-sequence page (PDF page 7) and the
     report/print page (PDF page 8) have no feature in the spec.
   - Loading screen and hero (brief frames 1 and 2) with their animations. They would live in
     `main.ts` or `index.html`.
   - A toast area for messages ("Maximum 4 sites…").
6. **Brief versus spec:**
   - Brief: up to 4 chosen sites. Spec F5: live plus 3 pinned. The pictures show both at once:
     4 chips = live + A, B, C.
   - Brief: every pin `#4BE8A0`. Contract: pins use the fixed scenario colours. The pictures use
     the scenario colours; only the live pin uses `--accent`.
   - Brief: an endlessly panning global map with "Google Lunar API". Spec F10: south-pole LOLA
     terrain, top-down camera. The picture shows the rulers, grid, toggles and tile from the brief
     over the spec's terrain.
   - Brief toggles "Day / Night Curve" and "Depth Field Map" map to F14 layers (if time).
   - Brief: Inter or Space Grotesk. Task rule: system fonts only. System fonts are used.
7. **Solar panel and battery (`panel`, T15 and a proposal).**
   - **Arrangement differs from the T19 ticket.** The ticket puts `#panel` under `#nudge`, beside
     `#scenarios` (`'scenarios panel'`). With the battery added the card needs the width for its
     chart, so the picture gives it its own full-width row under Scenarios
     (`'scenarios scenarios' 'panel panel'`), and after Nudge on the phone as before. Not beside
     the scene, so the map card isn't stretched. P1 and T19 to agree; without the battery the
     ticket's place still works.
   - **The battery is not in the spec** (F15 has the two panel percentages only). The picture
     shows three inputs (battery capacity in kWh, power use in W, panel size in kW), three results
     (how long it lasts in the dark, how often and how long it runs flat, how long to fill again
     after sunrise) and a 30-day charge chart with the dark stretches shaded and empty spells in
     `--bad`. Model in the picture: upright Sun-facing panel, starts full, charge += (panel power
     when the Sun is up − use) × time, kept between empty and full. A real version needs a spec
     line, a `core/` function with tests (every number from `core/`), and the inputs in
     `state.ts`; it would use the same Sun samples as the strips. The mock curve is simulated on
     scenario A's made-up Sun strip, so its numbers agree with its chart, not with real data.
   - New pieces with no shared class: the result box (`.stat`, on `--panel-2`; `--bad` border when
     the battery runs flat) and the thin meter bar under each percentage (`--sun` on `--dark`).
