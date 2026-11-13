# T03: Check our numbers against JPL Horizons

Status: not started

| | |
|---|---|
| Owner | P4 |
| Tier | must |
| Waits for | T00, T01 |
| Branch | `t03-horizons-check` |

## Goal

Independent proof that our Sun and Earth angles are right: the Python numbers in the contract's `validation.json` format, and a test that holds the browser's own maths to the same Horizons numbers.

## Files you own

- `data-prep/check_horizons.py`
- `web/public/data/validation.json` (taken over from T20's mock)
- `web/src/core/__fixtures__/horizons.json`, `web/src/core/horizons.test.ts`
- `docs/ai-use/T03.md`, `docs/sources/T03.md`, this file's `Status:` line

## Steps

1. Read the Horizons API page (ssd-api.jpl.nasa.gov/doc/horizons.html), about 10 minutes. Find: how to put the observer at a longitude, latitude and height on another body (the Moon is body 301), how to ask for azimuth and elevation in an observer table, and that refraction stays off.
2. Pick 3 sites (one near the south pole, one mid-latitude, one equatorial) and 3 times each, 2026-2035.
3. For each, ask Horizons for the Sun (body 10) and Earth (body 399). Compute ours with the same method T01 uses for the fixtures.
4. Write every case and the largest difference to `validation.json`, and the Horizons values alone to `__fixtures__/horizons.json` (contract section 2).
5. `horizons.test.ts`: build the real table with `parseEphemeris`, run `sunAltAz` and `earthAltAz` on every case with ground 0 and `eye_m` 0, and fail above 0.1 degrees. It skips when the table says `"source": "mock"`.
6. Be gentle with JPL's server: one request per site and body, with a pause between requests.

## Done when

- [ ] `validation.json` has 18 cases (3 sites x 3 times x 2 bodies) in the contract's format.
- [ ] `horizons.test.ts` passes on the real table: the browser's maths is within 0.1 degrees of Horizons on all 18.
- [ ] `max_diff_deg` is under 0.1. If it isn't, don't adjust anything to make it pass: post the numbers in the chat. A constant offset usually means a longitude sign or frame mix-up.
- [ ] One case re-checked by hand in the Horizons web app, with a screenshot in the pull request.
- [ ] `npm test` and `npm run build` pass.

## Notes

Horizons knows a smooth Moon only. This task checks angles, never terrain.

These request settings were tried on 14 Nov 2026 and returned an azimuth and elevation for a
site on the Moon (address `https://ssd.jpl.nasa.gov/api/horizons.api`):

| Setting | Value | Meaning |
|---|---|---|
| `COMMAND` | `'10'` or `'399'` | Sun or Earth |
| `EPHEM_TYPE` | `'OBSERVER'` | |
| `CENTER` | `'coord@301'` | A point on the Moon |
| `COORD_TYPE` | `'GEODETIC'` | |
| `SITE_COORD` | `'lon,lat,height_km'` | East longitude first, then latitude |
| `TLIST` | `'2027-01-01 00:00'` | UTC |
| `QUANTITIES` | `'4'` | Azimuth and elevation |
| `APPARENT` | `'AIRLESS'` | No refraction |

The reply's header said Horizons uses the same frame and radius we do (`MEAN_ME`, 1737.4 km,
east-longitude positive) and its own newer table (DE441, ours is DE421). Read the header of your
own replies to confirm.

## Prompt to paste into Claude Code

```text
Read CLAUDE.md, docs/data-contract.md and tasks/T03-horizons-check.md. Do only that task, on branch t03-horizons-check. Edit only the files it lists under "Files you own". If the task needs a change anywhere else, or a new package, stop and tell me. When you think you're finished, run every line of "Done when" and show me the output for each.
```
