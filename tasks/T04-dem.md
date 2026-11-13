# T04: South-pole height map from LOLA

Status: not started

| | |
|---|---|
| Owner | P2 |
| Tier | must |
| Waits for | T00, T20 |
| Branch | `t04-dem` |

## Goal

The real height grid in our own projection and format (contract section 2).

## Files you own

- `data-prep/make_dem.py`
- `web/public/data/dem.bin`, `dem.json` (taken over from T20's mock)
- `docs/ai-use/T04.md`, `docs/sources/T04.md`, this file's `Status:` line

## Steps

1. Find a LOLA south-polar gridded height product that reaches 80 S at about 240 m per cell, on NASA's PDS Geosciences Node (LOLA gridded data, polar). A product named `LDEM_75S_240M` is expected to exist; **that name is from memory, so confirm it before relying on it.**
2. Read the product's label file first. Take from it: height scale and offset, projection, cell size, which way rows and columns run. Don't assume any of them.
3. Resample into our grid as defined in the contract (our projection formulas, our row order, int16 at 0.5 m).
4. Keep the download in `data-prep/raw/` (git-ignored). If the file is over about 200 MB, download it through Google Colab to Drive instead of on a slow connection.
5. Record the exact product name, version and link in `dem.json` (`source`) and in `docs/sources/T04.md`. That replaces the mock marker, and the real-data tests switch themselves on.
6. The packages are already in `data-prep/requirements.txt` (T20). Start the download at kickoff, before this task's branch exists: it is the slow part. T05 doesn't need the real file, so do T05 while it downloads.

## Done when

- [ ] `dem.bin` is exactly `size * size * 2` bytes and is 15 MB or less.
- [ ] Heights span roughly -9,000 to +8,000 m with no stripes or blocks when saved as a grey image (attach it to the pull request).
- [ ] The centre of Shackleton crater (take its coordinates from a cited source, not from memory) reads at least 2,500 m lower than a point on its rim. Post both points in the chat for T07's `shackleton-floor` and `shackleton-rim`.
- [ ] Reading a height at the exact south pole and at 85 S, longitude 0 / 90 / 180 / -90, gives a number, not no-data.
- [ ] The image is the right way round: compare crater positions with Quickmap's south-pole view.
- [ ] `npm test` and `npm run build` pass.

## Prompt to paste into Claude Code

```text
Read CLAUDE.md, docs/data-contract.md and tasks/T04-dem.md. Do only that task, on branch t04-dem. Edit only the files it lists under "Files you own". If the task needs a change anywhere else, or a new package, stop and tell me. When you think you're finished, run every line of "Done when" and show me the output for each.
```
