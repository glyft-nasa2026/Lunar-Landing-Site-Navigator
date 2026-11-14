# AI use: issue #58, the nudge as a panel over the map

No task file: the human asked for the issue to be done in one branch across the owners it names
(T13 nudge, T12 scene, T19 layout, the contract).

| When | Who | Tool | What the AI did | What a person checked |
|---|---|---|---|---|
| 14 Nov 2026 | P3 | Claude Code (Opus 5.5) | Moved `#nudge` out of `index.html`'s side column: the scene now makes the slot inside its map viewport, and `main.ts` (unchanged) mounts the nudge into it. The nudge is an HTML card floating in a corner of the map (`data-corner`), bottom left to start, with a four-arrow corner picker and a fold button (starts folded on a phone). A map control inside the viewport claims a corner with `data-map-corner`; the panel then skips to the next free corner clockwise and that picker button is disabled. Added a distance slider, 0.1 to 10 km in 0.1 km steps, start 1 km; buttons, result ("Ghost: 2.5 km S") and screen-reader labels follow it; the ghost moves when the slider is let go. Distance, labels and corner choice are in `nudge/model.ts` with tests. Contract section 5 and the phone comment in `layout.css` updated | Not yet checked by a person |
| 14 Nov 2026 | P3 | Claude Code (Opus 5.5) | `npm test` (334 pass), `tsc`, `npm run build`. Drove the built page in headless Chromium at 1280 and at 390 (device emulation), on real data: the panel starts bottom left, sits inside the map in all four corners, goes to top left when a fake `data-map-corner="bl"` is added, no sideways scroll, every control is tabbable and labelled, 2.5 km S gives "Ghost: 2.5 km S" and the comparison lines, moving the slider to 5 km remakes the ghost | Not yet checked by a person |

## Choices the AI made that the issue doesn't spell out

- **Corner picker, not dragging**: four buttons work with a keyboard and a screen reader as they are.
- **No animation** when the panel moves, so there is nothing for reduced motion to turn off.
- **Folded by default on a phone**: open, the panel would cover most of an 18rem map.
- **One decimal always** ("1.0 km"), so the slider's value keeps its width.
