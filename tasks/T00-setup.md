# T00: Repo skeleton, mock data, deploy

Status: not started

| | |
|---|---|
| Owner | P1 |
| Tier | must |
| Waits for | - |
| Branch | `t00-setup` |

## Goal

After this merges, everyone can run the site on mock data and start their own task without waiting for real data.

## Files you own

- everything at the repo root
- `web/` config files, `web/index.html`, `web/src/main.ts`, `web/src/state.ts`
- `web/src/core/types.ts`, `ephemeris.ts`, `dem.ts` and their tests
- `data-prep/make_mock.py`
- `web/src/ui/theme.css`, `layout.css`, `plotTheme.ts` (placeholders; T19 owns them once this merges)
- `.github/workflows/`
- `docs/ai-use/T00.md`, `docs/sources/T00.md`, this file's `Status:` line

## Steps

1. Vite + TypeScript (strict) + vitest in `web/`. Install `three` and `plotly.js-dist-min` now, so nobody else touches `package.json`.
2. `index.html` with the eight slots from contract section 5. `main.ts` mounts every module folder; each folder gets a placeholder `index.ts` and an empty CSS file.
3. `types.ts` and `state.ts` exactly as the contract says, including the cached `skylineFor`, `samplesFor`, `summaryFor`. `state.ts` also keeps the pinned scenarios in the page address and restores them on load (F17).
4. Stub files `core/geometry.ts`, `core/horizon.ts`, `core/windows.ts` with the contract's exact function names, returning zeros and a flat skyline. T02, T05 and T06 replace the bodies later, so `state.ts` and `main.ts` never need editing again.
5. A test that checks every entry of `sites.json` has the contract's fields and a longitude between -180 and 180.
6. `ephemeris.ts` and `dem.ts` loaders per the contract, with a progress callback for the height map.
7. `data-prep/make_mock.py`: writes a fake `ephemeris.bin/json` (Sun circling once per 29.53 days, tilted 1.5 degrees; Earth near +x with a slow wobble), a fake `dem.bin/json` (flat, one bowl crater, one ridge, small size) and a 3-entry `sites.json`. Same formats as the real files.
8. GitHub Actions: a `test-and-build` job on every pull request (`npm ci`, `npm test`, `npm run build`); deploy `web/dist` to GitHub Pages on push to `main`. Set Vite's `base` for the repo name.
9. `web/src/ui/theme.css` with every variable and class name from contract section 6 set to plain placeholder values, `layout.css` with a basic grid, and `plotTheme.ts` exporting `plotLayout()`. Names must be complete here so no module waits for T19.
10. Branch rule on `main` per `docs/team-workflow.md`.

## Done when

- [ ] Fresh clone, `cd web && npm ci && npm run dev`: the page shows eight labelled placeholders and the console has no errors.
- [ ] `npm test` passes, including one test that loads the mock table and reads row 0, and one that reads a height from the mock grid.
- [ ] The GitHub Pages address opens the same page.
- [ ] A pull request that breaks a test is blocked from merging.
- [ ] `npm test` and `npm run build` pass.

## Prompt to paste into Claude Code

```text
Read CLAUDE.md, docs/data-contract.md and tasks/T00-setup.md. Do only that task, on branch t00-setup. Edit only the files it lists under "Files you own". If the task needs a change anywhere else, or a new package, stop and tell me. When you think you're finished, run every line of "Done when" and show me the output for each.
```
