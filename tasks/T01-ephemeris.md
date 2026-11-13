# T01: Sun and Earth table from Skyfield

Status: not started

| | |
|---|---|
| Owner | P1 |
| Tier | must |
| Waits for | T00 |
| Branch | `t01-ephemeris` |

## Goal

The real table (contract section 2) and the fixtures that prove the browser maths.

## Files you own

- `data-prep/make_ephemeris.py`, `data-prep/requirements.txt`
- `web/public/data/ephemeris.bin`, `ephemeris.json`
- `web/src/core/__fixtures__/altaz.json`
- `docs/ai-use/T01.md`, `docs/sources/T01.md`, this file's `Status:` line

## Steps

1. Read the Skyfield page "Planetary Reference Frames" (rhodesmill.org/skyfield/planetary.html). It shows how to load the Moon's orientation files and build the `MOON_ME_DE421` frame.
2. For each hour 2026-01-01 to 2036-01-01 UTC: the apparent position of the Sun and of Earth as seen from the Moon's centre, expressed in that frame. Store the Sun as a unit vector and Earth in km.
3. Fixtures: for at least 20 site-and-time cases (a polar site, a mid-latitude site, an equatorial site; times spread over the ten years), ask Skyfield directly for the altitude and azimuth of the Sun and Earth from that point on the Moon's surface. This path must not use our table.
4. Vectorise with NumPy; don't loop hour by hour in Python.

## Done when

- [ ] `ephemeris.bin` is exactly `rows * 24` bytes and `rows` matches `ephemeris.json`.
- [ ] Every Sun vector has length 1 within 0.000001.
- [ ] Earth's distance is between 356,000 and 407,000 km in every row.
- [ ] The Sun's latitude on the Moon, `asin(sun_z)`, stays within +-1.6 degrees in every row.
- [ ] The point on the Moon directly under Earth stays within +-8.2 degrees of longitude and +-6.9 degrees of latitude (Earth's wobble).
- [ ] `altaz.json` has 20 or more cases in the contract's format.
- [ ] `npm test` and `npm run build` pass.

## Notes

Skyfield downloads its own data files (about 20 MB) on first run. Keep them in `data-prep/raw/`, which is git-ignored.

## Prompt to paste into Claude Code

```text
Read CLAUDE.md, docs/data-contract.md and tasks/T01-ephemeris.md. Do only that task, on branch t01-ephemeris. Edit only the files it lists under "Files you own". If the task needs a change anywhere else, or a new package, stop and tell me. When you think you're finished, run every line of "Done when" and show me the output for each.
```
