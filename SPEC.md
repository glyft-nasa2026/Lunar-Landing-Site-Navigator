# Spec: Darksight

Written 14 Nov 2026. Changes go in `docs/decisions.md`.

## 1. What we build

A website where a mission planner picks lunar sites and dates and sees, side by side, when each
has sunlight and a line to Earth, measured against the real terrain skyline.

**The one thing it does better than Horizons or Quickmap:** comparing two or three scenarios in
seconds, and showing how much a 1 km move or a 1 day slip changes the answer.

| User | What they get |
|---|---|
| Mission planner | Countdown to sunset and Earthset, hours of light and radio contact, 2-3 scenarios compared |
| Educator, public | A 3D view where dragging time moves the Sun and the shadows, and Earth bobs at the horizon |

## 2. Cut line

| Must ship | If time (not before milestone M2) | Out |
|---|---|---|
| F1-F13, F17, F18, F19 below | F14 map layers | Atmospheric refraction (the Moon has none) |
| | F15 solar panel choice | GPS, relay satellites, constellations |
| | F16 animated 2D to 3D transition | Landing trajectories, thermal models |
| | | Server, database, accounts |

## 3. Screen

```
+--------------------------------------------------------------------+
|  ABOUT BAR: name · "Checked against JPL Horizons" badge · [About]  |
+--------------------------------------------------+-----------------+
|                                                  | SCENARIOS       |
|            MAP / 3D VIEW  (one scene)            | (o) Live  ...   |
|         pins: A orange, B blue, C green          | (o) A  ...      |
|   [2D|3D]                                        | [ + Pin this ]  |
+--------------------------------------------------+ READOUT         |
|  COMPARE: table, one column per scenario         | Sun, Earth,     |
|  STRIPS: Sun and Earth bars per scenario         | countdowns      |
|                                                  | NUDGE buttons   |
+--------------------------------------------------+-----------------+
|  TIMELINE (selected scenario)  |  SKY PANORAMA (selected scenario) |
+--------------------------------------------------------------------+
```

The readout, timeline, sky panorama and the Sun in the 3D view show the selected scenario: the
live one, or a pinned one after its card is clicked. Pinned scenarios never change. Any edit
(map click, coordinate or time box, timeline drag) changes the live scenario and selects it.

## 4. Features

A scenario is a site plus a time. The live scenario is the one being edited. Up to three more
can be pinned.

| # | Feature | Behaviour | Done when |
|---|---|---|---|
| F1 | Pick a site | Click the map, choose from the curated list, or type latitude and longitude | All three set the same live site |
| F2 | Pick a time | UTC date and time box, plus dragging on the timeline. Range 1900 to 2100 | A time outside the range shows a message, not a crash |
| F3 | Readout | For the selected scenario. Sun: altitude, azimuth, degrees above the skyline, fraction of disc visible. Earth: altitude, azimuth, visible or hidden | Matches the fixtures to 0.02 degrees |
| F4 | Countdowns | "Sunset in 3 d 4 h" or "Sunrise in ..."; same for Earth. Special wording: "No sunset in the next 60 days", "No sunrise in the next 60 days", "Earth always visible", "Earth never visible", "Permanently shadowed (until 2100)". The exact table is in contract section 3 | The countdown ends where the strip ends |
| F5 | Scenarios | Pin the live scenario (max 3). Colours: A `#E69F00`, B `#0072B2`, C `#009E73`. Click a card to select it; remove with x | Pin, select, remove work; the same colour appears on pin, card and strips |
| F6 | Compare table | One column per pinned scenario, same rows in the same order: Sun now, sunset in, Earth now, Earthset in, lit % (next 30 days), longest unbroken light, longest dark, Earth contact %, longest gap in contact. Best value per row highlighted | Two pinned scenarios show two columns with every row filled |
| F7 | Strips | Two bars per scenario (Sun, Earth) on one shared axis: days since each scenario's own time, 0 to 30. Filled where up, empty where hidden | Strips agree with the countdowns |
| F8 | Timeline | For the selected scenario: degrees above the skyline against time, one line for Sun, one for Earth, shaded below zero. Range buttons: 30 days, 90 days, 1 year; earlier and later buttons. Dragging sets the live time, and the chart stays still while the marker moves | Dragging updates readout and 3D view |
| F9 | Sky panorama | Azimuth 0-360 across, elevation up. The terrain skyline as a filled shape, the Sun's and Earth's paths over the next 30 days, and their positions now | The Sun marker sits below the skyline exactly when the readout says "hidden" |
| F10 | 3D scene | South-pole terrain from LOLA. The Sun is the light, placed from the computed direction. Earth is drawn in the sky. Pins for scenarios and curated sites. Two cameras: top-down (the "2D map") and orbit ("3D"). Clicking the terrain sets the live site | Click returns latitude and longitude within one grid cell of the true point |
| F11 | Nudge | Buttons: 1 km north, south, east, west; +1 day, -1 day. Makes a ghost scenario and states the difference in words: "+31 h of sunlight", "loses Earth 2 days earlier" | A nudge off a crater rim onto its floor shows a large loss of sunlight |
| F12 | Curated sites | 15-20 sites: Apollo, recent landers, south-pole candidates. Each has a source link | Every pin checked on Quickmap |
| F13 | About and checks | "Checked against JPL Horizons, largest difference X degrees", known limits, data sources, how AI was used | Page shows the number from `validation.json` |
| F14 | Layers (if time) | Coloured map overlays with on/off and transparency: lit %, Earth-visible %, never lit, height | |
| F15 | Panel choice (if time) | Flat panel or upright panel that turns to face the Sun; shows relative power | |
| F16 | Transition (if time) | The camera glides between top-down and orbit | |
| F17 | Share link | Scenarios are stored in the page address, so a link reopens the same comparison | Reloading the page keeps the pinned scenarios |
| F18 | Look and feel | One dark theme, one layout and one chart style across every module, from shared variables. Works from 1280 px desktop down to a phone | Text contrast 4.5 to 1; no colour code outside the theme files; nothing overlaps at 1280 px or 390 px |
| F19 | Example on first open | A link with no scenarios in it opens on a ready comparison: the crater rim (live, and pinned as A) against the crater floor (pinned as B), at the current hour. A link with scenarios in it opens exactly those | The plain link shows two columns in the compare table; unpinning both and reloading leaves nothing pinned |

## 5. How it works

No server. Python prepares data once; the browser does the rest.

| Stage | Tool | Output |
|---|---|---|
| Sun and Earth directions seen from the Moon, every 3 hours, 1900-2100 | Python, Skyfield, NASA JPL DE440 files | `ephemeris/<decade>.bin`, about 0.7 MB each (14.1 MB in all); the page loads the 2020s first and other decades when needed, and keeps them on the device |
| South-pole height map from LOLA, 80 S to the pole | Python, NumPy, Rasterio | `dem.bin` (15 MB at most) |
| Check against JPL Horizons | Python | `validation.json` |
| Angles for any site and time | TypeScript, `core/geometry.ts` | In memory |
| Skyline for any south-pole point | TypeScript, `core/horizon.ts` | 360 numbers, in memory |
| Countdowns, percentages | TypeScript, `core/windows.ts` | In memory |
| 3D view | three.js | |
| Charts | Plotly.js | |
| Hosting | GitHub Pages at darksight.space; mirror on rickphobia.com | |

**Why this works:** at one moment, the Sun's and Earth's directions measured from the Moon are
the same for every site. Only the site's own "up" differs. So one table serves every site.

## 6. Where real terrain applies

| Site latitude | Skyline |
|---|---|
| South of 85 S | Real, from LOLA, looking out to 150 km |
| Anywhere else | Smooth Moon (0 degrees). The app says so on screen |

## 7. Accuracy

| Check | Pass |
|---|---|
| Our angles against Skyfield's own surface-point calculation | 0.02 degrees |
| Skyfield's surface-point calculation against JPL Horizons, 3 sites x 3 times | 0.1 degrees |
| The browser's own maths against the same Horizons numbers (a test on every pull request) | 0.1 degrees |
| Terrain: floor of Shackleton crater | Never lit, to 2100 |
| Terrain: a point on Shackleton's rim | Lit more than half the time |

The two terrain rows are tests owned by T24.

## 8. Known limits (shown on the About page)

- Height map is 240 m per cell. Rocks and small craters near the lander aren't seen.
- Skyline looks out to 150 km. A very tall peak further away is missed.
- The Sun's visible fraction is by height of the disc, not by area.
- Earth is treated as a point for "visible or hidden".
- Table covers 1900-2100, one row every 3 hours, with straight-line steps between rows. "Permanently shadowed" means no sunlight from the chosen time to the end of 2100.

## 9. Milestones

Fill in the clock times once the submission deadline is known.

| | When | What is true |
|---|---|---|
| M0 | Start + 2 h | T00, T20 and T21 merged; first design pictures in (T22). Everyone runs the site with live numbers on mock data |
| M1 | Saturday evening | On a smooth Moon: pick site and time, readout, countdowns, compare table and strips. Deployed |
| M2 | Sunday morning | Real terrain skyline, sky panorama, 3D scene with click-to-pick, Horizons check passed |
| M3 | Deadline - 5 h | **Freeze.** No new features. Bugs, video, write-up only |
| | Deadline | Submitted |

"If time" features are the slack. Nobody starts one before M2.

## 10. Open decisions

| Decision | Who | Importance |
|---|---|---|
| Submission deadline and Saturday start time, Malaysia time | P1 | blocks the schedule |
| Team agrees the cut line (refraction and GPS removed) | All | blocks T08 onward |
| Project name | P5 | cosmetic |
| Names against P2-P5 on the board | P1 | blocks delegation |
| Repo made public (GitHub refuses the branch rule and Pages on a private repo in a free organisation) | P1 | blocks T21 |
| Figma seat for the designer: Full or Dev on Professional or Education | P5 | costs time (a fallback is in `docs/mcp-and-skills.md`) |
| Demo format and length, read from the submission form | P4 | blocks T17 |
| Load-time budgets in T27 (numbers in 3 s, height map in 20 s, no freeze over 0.5 s, on "Fast 4G"): proposed, not yet agreed | P1 | costs time |
