# T01: Sun and Earth table from Skyfield

Status: done (pull request #16; the table was replaced by the 1900-2100 one in #31)

| | |
|---|---|
| Tier | must |
| Waits for | T20 |
| Branch | `t01-ephemeris` |

## Goal

The real table (contract section 2) and the fixtures that prove the browser maths.

## Files in scope

- `data-prep/make_ephemeris.py`
- `web/public/data/ephemeris.bin`, `ephemeris.json` (taken over from T20's mock)
- `web/src/core/__fixtures__/altaz.json`
- `docs/ai-use/T01.md`, `docs/sources/T01.md`, this file's `Status:` line

## Steps

1. Read the Skyfield page "Planetary Reference Frames" (rhodesmill.org/skyfield/planetary.html). It shows how to load the Moon's orientation files and build the `MOON_ME_DE421` frame.
2. For each hour 2026-01-01 to 2036-01-01 UTC: the apparent position of the Sun and of Earth as seen from the Moon's centre, expressed in that frame. Store the Sun as a unit vector and Earth in km.
3. Fixtures: for at least 20 site-and-time cases (a polar site, a mid-latitude site, an equatorial site; times spread over the ten years), ask Skyfield directly for the altitude and azimuth of the Sun and Earth from that point on the Moon's surface. This path must not use our table.
4. Vectorise with NumPy; don't loop hour by hour in Python.
5. `ephemeris.json` carries `"source": "JPL DE421 via Skyfield"`. That replaces the mock marker, and the real-data tests switch themselves on.

## Done when

- [ ] `ephemeris.bin` is exactly `rows * 24` bytes and `rows` matches `ephemeris.json`.
- [ ] Every Sun vector has length 1 within 0.000001.
- [ ] Earth's distance is between 356,000 and 407,000 km in every row.
- [ ] The Sun's latitude on the Moon, `asin(sun_z)`, stays within +-1.6 degrees in every row.
- [ ] The point on the Moon directly under Earth stays within +-8.2 degrees of longitude and +-6.9 degrees of latitude (Earth's wobble).
- [ ] `altaz.json` has 20 or more cases in the contract's format.
- [ ] If T00 has merged: `npm test` and `npm run build` pass.

## Notes

Skyfield downloads its own data files (about 20 MB) on first run. Keep them in `data-prep/raw/`, which is git-ignored.

The packages are already in `data-prep/requirements.txt` (T20). While T20 is still open, set up Python, read the Skyfield page and start that download; make the branch once T20 has merged.

T02 waits for the fixtures. Merge this as soon as its checks pass.

## After the merge

- 14 Nov 2026, pull request #31: the table became 1900-2100 on DE440 (frame `MOON_ME_DE440_ME421`), one row every 3 hours, in 20 decade files with an index (`ephemeris.json` plus `ephemeris/<decade>.bin`). `make_ephemeris.py` was rewritten there, and `altaz.json` grew to 30 cases. The steps above describe the first table (2026-2035, hourly, DE421, one file).
- 14 Nov 2026, audit of the merged tickets: `make_ephemeris.py` was run again from the cached kernels. All 20 decade files, the index and `altaz.json` came out byte for byte the same as the shipped ones. No defect found.

## Prompt to paste into Claude Code

```text
Read CLAUDE.md, docs/data-contract.md and tasks/T01-ephemeris.md. Do only that task, on branch t01-ephemeris. Use "Files in scope" as the starting scope; follow CLAUDE.md's coordination rules for any additional files or dependencies. When you think you're finished, run every line of "Done when" and show me the output for each.
```
