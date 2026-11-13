# T00: Site skeleton

Status: done, in review (pull request #2)

| | |
|---|---|
| Owner | P1 |
| Tier | must |
| Waits for | - |
| Branch | `t00-setup` |

## Goal

After this merges, every engine and UI task can start, and the page shows live numbers on mock
data, so each task can check its own "Done when" list from the first hour.

T20 (mock data), T21 (CI and deploy) and T22 (design) run at the same time on their own
branches. Don't do their work here. Merge this as early as it is usable: four people's code
tasks start from it.

## Files you own

- At the repo root: `.gitignore`, `.gitattributes`, `README.md`, `CLAUDE.md`, `history.md`
- `web/package.json`, `web/package-lock.json`, `web/tsconfig.json`, `web/vite.config.ts`,
  `web/.nvmrc`, `web/index.html`
- `web/src/main.ts`, `web/src/state.ts`, `web/src/state.test.ts`
- `web/src/core/types.ts`, `ephemeris.ts`, `dem.ts`, their tests, and `sites.test.ts`
- `docs/ai-use/T00.md`, `docs/sources/T00.md`, this file's `Status:` line

You also create these, and they change owner when this task merges:

| You create | With | Then owned by |
|---|---|---|
| `web/src/core/geometry.ts` | first pass (contract section 3) | T02 |
| `web/src/core/horizon.ts` | the flat skyline only | T05 |
| `web/src/core/windows.ts` | first pass | T06 |
| `web/src/ui/theme.css`, `layout.css`, `plotTheme.ts` | every name, placeholder values | T19 |
| `index.ts` and an empty CSS file in `web/src/ui/scenarios/`, `readout/`, `compare/`, `timeline/`, `sky/`, `nudge/`, `about/` and in `web/src/scene/` | a placeholder | T08, T08, T09, T10, T11, T13, T16, T12 |

Not yours: `web/public/data/` and `data-prep/` (T20), `.github/` (T21), `docs/design*` (T22).

## Steps

1. Vite + TypeScript (strict) + vitest in `web/`. Install `three`, `plotly.js-dist-min` and their type packages now, so nobody else touches `package.json`. Scripts are named exactly `dev`, `test` (runs once, no watch mode) and `build`: T21's CI calls them.
2. `base: './'` in `vite.config.ts`, and load data with `import.meta.env.BASE_URL + 'data/...'`. The same build then works on GitHub Pages under any repo name and on the mirror.
3. `.gitattributes`: `* text=auto eol=lf`, and `*.bin` and `*.png` marked `binary`. `web/.nvmrc` with `22`, and `"engines": { "node": ">=22" }`. Most of the team is on Windows.
4. `index.html` with the eight slots from contract section 5. `main.ts` mounts every module folder. Each placeholder shows its slot name and one live value from state (the readout placeholder shows the Sun's altitude), which proves the wiring.
5. `types.ts` and `state.ts` exactly as contract sections 3 and 4: the selected-and-live rule, the timeline window, every cached accessor, and the pinned scenarios kept in the page address and restored on load (F17).
6. `ephemeris.ts` and `dem.ts`: `parseEphemeris` and `parseDem` (no network) and the two loaders, with a progress callback for the height map. If a data file is missing, state stays `null` and the page says "Data not loaded". It must not crash: T20 may merge after this.
7. First pass of `geometry.ts` (all three functions) and `windows.ts` (all four), straight from the contract's formulas and wording table, with a few sanity tests. `horizon.ts` returns the flat skyline. Don't polish them: T02, T05 and T06 own them next.
8. `sites.test.ts`: every entry of `web/public/data/sites.json` has the contract's fields and a longitude between -180 and 180. It skips when the file isn't there yet.
9. `theme.css` with every variable and class name from contract section 6 set to plain placeholder values, `layout.css` with a basic grid, and `plotTheme.ts` exporting `plotLayout()` and `themeColor()`. Names must be complete here so no module waits for T19.

## Done when

- [ ] `npm test` passes with `web/public/data/` empty. Tests build their tables and grids in memory with `parseEphemeris` and `parseDem`.
- [ ] With `web/public/data/` empty, `npm run dev` shows the eight labelled placeholders and "Data not loaded", with no console errors.
- [ ] With T20's mock files in place, the readout placeholder shows a Sun altitude that changes when the time changes.
- [ ] A state test: pin two scenarios, rebuild state from the page address, both are back.
- [ ] A state test: `setLiveTime` inside the window keeps `windowStartMs`; outside it, the window restarts.
- [ ] `npm test` and `npm run build` pass.

## Prompt to paste into Claude Code

```text
Read CLAUDE.md, docs/data-contract.md and tasks/T00-setup.md. Do only that task, on branch t00-setup. Edit only the files it lists under "Files you own" and the files it says you create. If the task needs a change anywhere else, or a new package beyond the ones it names, stop and tell me. When you think you're finished, run every line of "Done when" and show me the output for each.
```
