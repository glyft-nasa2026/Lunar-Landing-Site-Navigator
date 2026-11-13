# Ticket summary

What each of the 31 tickets does, in one line each. Checked 14 Nov 2026 against the task files.

The board of record is `tasks/README.md` (owners, tiers, what each task waits for). Each ticket's
full steps and "Done when" list are in its own `tasks/Txx-*.md`. If this file and those disagree,
those are right.

## Start at kickoff

| Ticket | Owner | What it does |
|---|---|---|
| T00 Site skeleton | P1 | The project setup, a first pass of the engine, the state, and eight placeholder slots. Every code task starts from it. |
| T20 Mock data | P2 | Fake data files in the real formats, so the site runs before the real data exists. |
| T21 CI and deploy | P3 | Every pull request is tested automatically, `main` is protected, and each merge publishes the site. |
| T22 Design | P5 | The look of the whole screen, decided in Figma and handed over as one picture per slot. |

## Data (Python, run once)

| Ticket | Owner | What it does |
|---|---|---|
| T01 Ephemeris | P4 | The real Sun and Earth table for 2026-2035 from Skyfield, plus fixtures to test the browser maths against. |
| T03 Horizons check | P4 | Checks our angles against JPL Horizons, and adds a test that holds the browser's maths to the same numbers. |
| T04 Height map | P2 | The real south-pole height grid from LOLA, in our own projection and format. |
| T07 Sites | P4 | 15-20 real landing sites, each with a source link. |

## Engine (proving the maths)

| Ticket | Owner | What it does |
|---|---|---|
| T02 Geometry | P1 | Proves the Sun and Earth angles against Skyfield and fixes what the tests find. |
| T05 Skyline | P2 | Replaces the flat skyline with the real terrain skyline around a site. |
| T06 Windows | P1 | Proves the countdowns, lit percentages and longest runs. |
| T24 Real-data checks | P4 | Terrain checks on the real data: Shackleton's floor is never lit, its rim is lit more than half the time. |

## Interface

| Ticket | Owner | What it does |
|---|---|---|
| T08 Scenarios and readout | P3 | Pick a site and time, pin up to three scenarios, and show the Sun and Earth numbers and countdowns. |
| T09 Compare | P3 | The side-by-side table and the Sun and Earth strips, one column per pinned scenario. |
| T10 Timeline | P3 | The chart of degrees above the skyline over time, with dragging to set the time. |
| T11 Sky panorama | P2 | The skyline as a filled shape, with the Sun's and Earth's paths across it. |
| T12 3D scene | P1 | The terrain in 3D with the Sun as the light, a top-down map view, and click-to-pick a site. |
| T13 Nudge | P3 | Buttons that move the site 1 km or the time 1 day, and say in words what changed. |
| T16 About | P5 | The top bar, the About panel, and the "Checked against JPL Horizons" badge. |
| T25 Example on first open | P1 | The plain link opens on a ready comparison, crater rim against crater floor, instead of an empty screen. |

## Look

| Ticket | Owner | What it does |
|---|---|---|
| T19 Theme | P5 | Puts the Figma design into the three shared files: colours, layout, chart style. |
| T23 Polish | P5 | Makes each module match its design picture, on desktop and phone. |

## Checks and submission

| Ticket | Owner | What it does |
|---|---|---|
| T17 Pitch | P4 | Slides, demo video and the submission text. |
| T18 QA | P4 | Testing with a real person and a bug list, at each milestone. |
| T27 Load time | P2 | Measures how long the page takes on a slow connection with the real height map, and hands each fix to its owner. |
| T26 Freeze checklist | P1 | The final sweep at the freeze: README, every task's notes, open decisions, and a tag on the submitted commit. |

## Only if there's time

| Ticket | Owner | What it does |
|---|---|---|
| T14 Map layers | unassigned | Coloured overlays for lit %, Earth-visible %, never lit and height. |
| T15 Solar panel | unassigned | Flat or Sun-facing panel, with relative power. |
| T29 Camera glide | unassigned | The camera glides between the 2D map and the 3D view instead of jumping. |
| T28 Mirror | P1 | A second copy of the site on rickphobia.com, in case GitHub Pages is slow. |
| T30 Page smoke test | P3 | CI opens the built page on every pull request, so a module that breaks on load is caught. |

## Each person's order

| | From kickoff | Then, in this order |
|---|---|---|
| P1 | T00 | T02, T06, T25, T12, T26 at the freeze |
| P2 | T20 | T05, T04, T11, T27 |
| P3 | T21 | T08, T09, T10, T13 |
| P4 | Python setup, site lookup for T07 | T01, T03, T07, T18, T17, T24, T18 again |
| P5 | T22 | T19, T16, T23 |
