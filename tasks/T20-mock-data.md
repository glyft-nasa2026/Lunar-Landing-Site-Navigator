# T20: Mock data

Status: done (pull request #12; guard against replacing real data in #46)

| | |
|---|---|
| Owner | P2 |
| Tier | must |
| Waits for | - |
| Branch | `t20-mock-data` |

## Goal

Fake data files in the real formats, in the repo within the first half hour, so the site runs
and every task can be checked before the real data exists. Runs at the same time as T00.

## Files you own

- `data-prep/make_mock.py`
- `data-prep/requirements.txt`
- `web/public/data/ephemeris.bin`, `ephemeris.json`, `dem.bin`, `dem.json`, `sites.json`, `validation.json` (the mock versions; T01, T04, T07 and T03 each replace theirs later)
- `docs/ai-use/T20.md`, `docs/sources/T20.md`, this file's `Status:` line

## Steps

1. `requirements.txt` lists every package any data-prep task will need, so nobody edits it again: `skyfield`, `numpy`, `rasterio`, `requests`, `pillow`. Pin each to the version that installs today.
2. `make_mock.py` uses NumPy only and writes all six files exactly as contract section 2, "Mock data": the grid size, the crater, its rim, the ridge, the Sun and Earth motion, the three sites, and the mock markers (`"source": "mock"`, `"checked_at": null`).
3. The mock table covers the same dates as the real one (2026-01-01 to 2036-01-01, hourly), so date limits behave the same.
4. At the end, the script reads its own files back and prints the checks below.

## Done when

- [ ] `ephemeris.bin` is exactly `rows * 24` bytes; `dem.bin` is exactly `size * size * 2` bytes.
- [ ] Read back through the contract's projection: the height at (-88.0, 45.0) is -3,000 m within 50; at (-87.67, 45.0) it is +500 m within 100; at (-89.5, 0) it is 0.
- [ ] Every Sun vector has length 1 within 0.000001.
- [ ] `sites.json` has the three mock sites with every field of the contract.
- [ ] All the mock markers are present.
- [ ] If T00 has merged: `npm test` and `npm run build` pass.

## Notes

No download and no real data here. Start the LOLA download for T04 in another window while this
runs: it is the slow part of your next task.

If this merges before T21, its pull request has no `test-and-build` check. The printed checks
above, pasted in, are the review (`docs/team-workflow.md`, "The first three merges").

## After the merge

- 14 Nov 2026: T04 (#13), T01 (#16) and T03 (#30) replaced their mock files with real ones. `sites.json` is still this task's mock until T07 merges.
- 14 Nov 2026, pull request #31: the real table is now 1900-2100, one row every 3 hours, one file per decade. The mock stays hourly, 2026-2035, in one `ephemeris.bin`, which still loads. So step 3's "same dates as the real one" no longer holds.
- 14 Nov 2026, pull request #46 (`t20-mock-data-b`): `make_mock.py` lists any real file in `web/public/data/`, changes nothing and exits 2. `--force` writes the mock files over them.

## Prompt to paste into Claude Code

```text
Read CLAUDE.md, docs/data-contract.md and tasks/T20-mock-data.md. Do only that task, on branch t20-mock-data. Edit only the files it lists under "Files you own". If the task needs a change anywhere else, stop and tell me. When you think you're finished, run every line of "Done when" and show me the output for each.
```
