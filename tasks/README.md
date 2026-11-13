# Task board

Only P1 edits this file. Progress lives on each task file's `Status:` line and in its pull
request, so this file never causes a merge conflict.

## People

| | Name | Plan | Role |
|---|---|---|---|
| P1 | Yi Hung | Claude Max | Setup, engine, 3D scene, merges |
| P2 | [name] | Claude Pro | Terrain, skyline, sky panorama, nudge |
| P3 | [name] | Claude Pro | Interface: scenarios, compare, timeline |
| P4 | [name] | Claude Pro | Horizons check, site list, testing |
| P5 | [name] | Claude Pro | Look and feel, pitch, video, About text |

## Tasks

| Task | What | Owner | Tier | Waits for |
|---|---|---|---|---|
| [T00](T00-setup.md) | Repo skeleton, mock data, deploy | P1 | must | - |
| [T01](T01-ephemeris.md) | Sun and Earth table from Skyfield | P1 | must | T00 |
| [T02](T02-geometry.md) | Angles for any site: geometry.ts | P1 | must | T00 (tests go green after T01) |
| [T03](T03-horizons-check.md) | Check our numbers against JPL Horizons | P4 | must | T01 |
| [T04](T04-dem.md) | South-pole height map from LOLA | P2 | must | T00 |
| [T05](T05-horizon.md) | Terrain skyline: horizon.ts | P2 | must | T00 (real-data check after T04) |
| [T06](T06-windows.md) | Countdowns and percentages: windows.ts | P1 | must | T02 |
| [T07](T07-sites.md) | Curated site list | P4 | must | T00 |
| [T08](T08-ui-scenarios.md) | Scenario panel, readout, share link | P3 | must | T00 |
| [T09](T09-ui-compare.md) | Compare table and strips | P3 | must | T00 |
| [T10](T10-ui-timeline.md) | Timeline chart with scrubber | P3 | must | T00 |
| [T11](T11-ui-sky.md) | Sky panorama | P2 | must | T05 |
| [T12](T12-scene.md) | 3D scene and map | P1 | must | T00 (real terrain after T04) |
| [T13](T13-nudge.md) | Nudge: small move, big change | P2 | must | T06, T08 |
| [T14](T14-layers.md) | Map layers | unassigned | if time | M2 |
| [T15](T15-panel.md) | Solar panel choice | unassigned | if time | M2 |
| [T16](T16-about.md) | About page and the Horizons badge | P5 (text), P3 (wiring) | must | T03 |
| [T17](T17-pitch.md) | Slides, demo video, submission text | P5 | must | M1 for screenshots, M2 for the video |
| [T18](T18-qa.md) | Testing with a real person, bug list | P4 | must | M1, repeated at M2 |
| [T19](T19-ui-design.md) | Look and feel: theme, layout, chart style | P5 | must | T00 |

## Order

```
T00 ──┬── T01 ── T02 ── T06 ──┐
      │     └──── T03 ── T16  ├── T13
      ├── T04 ──┐             │
      ├── T05 ──┴── T11       │
      ├── T07                 │
      ├── T08 ────────────────┘
      ├── T09
      ├── T10
      ├── T12
      └── T19
T17 and T18 run alongside from M1.
```

After T00, nine tasks can run at once, because the mock data has the same shape as the real data.
