# Task board

Only P1 edits this file. Progress lives in each task's pull request (opened as a draft at the
first push) and on its `Status:` line, so this file never causes a merge conflict.

## People

| | Name | Plan | Role |
|---|---|---|---|
| P1 | Yi Hung | Claude Max | Site skeleton, engine tests, 3D scene, the contract |
| P2 | [name] | Claude Pro | Mock data, terrain, skyline, sky panorama |
| P3 | [name] | Claude Pro | CI and deploy, interface: scenarios, compare, timeline, nudge |
| P4 | [name] | Claude Pro | Sun and Earth table, Horizons check, site list, testing, pitch |
| P5 | [name] | Claude Pro | UI designer, in Figma: design, theme, About, polish. UI only |

## Who does what, in order

Nobody waits at the start: five tasks begin at kickoff. Read your row left to right.

| | From kickoff | Then, in this order |
|---|---|---|
| P1 | T00 | T02 (once T01 is in; if it isn't, skip ahead), T06, T12 |
| P2 | T20, with the LOLA download running beside it | T05 (while the download finishes), T04, T11 |
| P3 | T21; while its pull request waits for T00, go through the design with P5 | T08, T09, T10, T13 |
| P4 | Set up Python and start the lookup for T07; T01 as soon as T20 merges | T03, T07, T18 at M1, T17, T24 and T18 again at M2 |
| P5 | T22 | T19, T16, T23 |

## Tasks

"Waits for" lists every task that must be merged before you make your branch. Nothing else is
needed to start or to finish. One exception: T00, T20 and T21 start together and merge in the
order given in `docs/team-workflow.md`, "The first three merges".

| Task | What | Owner | Tier | Waits for |
|---|---|---|---|---|
| [T00](T00-setup.md) | Site skeleton, with first-pass engine | P1 | must | - |
| [T20](T20-mock-data.md) | Mock data | P2 | must | - |
| [T21](T21-ci-deploy.md) | CI, deploy and repo settings | P3 | must | - |
| [T22](T22-design.md) | Design in Figma, pictures for every slot | P5 | must | - |
| [T01](T01-ephemeris.md) | Sun and Earth table from Skyfield | P4 | must | T20 |
| [T02](T02-geometry.md) | Prove the angles: geometry.ts | P1 | must | T00, T01 |
| [T03](T03-horizons-check.md) | Check our numbers against JPL Horizons | P4 | must | T00, T01 |
| [T04](T04-dem.md) | South-pole height map from LOLA | P2 | must | T00, T20 |
| [T05](T05-horizon.md) | Terrain skyline: horizon.ts | P2 | must | T00 |
| [T06](T06-windows.md) | Prove countdowns and percentages: windows.ts | P1 | must | T00 |
| [T07](T07-sites.md) | Curated site list | P4 | must | T00, T20 |
| [T08](T08-ui-scenarios.md) | Scenario panel, readout, share link | P3 | must | T00 |
| [T09](T09-ui-compare.md) | Compare table and strips | P3 | must | T00 |
| [T10](T10-ui-timeline.md) | Timeline chart with scrubber | P3 | must | T00 |
| [T11](T11-ui-sky.md) | Sky panorama | P2 | must | T05 |
| [T12](T12-scene.md) | 3D scene and map | P1 | must | T00 |
| [T13](T13-nudge.md) | Nudge: small move, big change | P3 | must | T00, T05 |
| [T16](T16-about.md) | About bar, About panel, Horizons badge | P5 | must | T00 |
| [T19](T19-ui-design.md) | Theme, layout, chart style | P5 | must | T00, T22 |
| [T23](T23-ui-polish.md) | UI polish: every module matches the design | P5 | must | T19, and each module's own task |
| [T24](T24-real-data-checks.md) | Terrain checks on the real data | P4 | must | T01, T04, T05, T06, T07 |
| [T17](T17-pitch.md) | Slides, demo video, submission text | P4 | must | M1 for screenshots, M2 for the video |
| [T18](T18-qa.md) | Testing with a real person, bug list | P4 | must | M1, repeated at M2 |
| [T14](T14-layers.md) | Map layers | unassigned | if time | M2 |
| [T15](T15-panel.md) | Solar panel choice | unassigned | if time | M2 |

## Order

```
kickoff ─┬─ T00 ──┬── T02 (also needs T01)
         │        ├── T06
         │        ├── T12
         │        ├── T05 ──┬── T11
         │        │         └── T13
         │        ├── T08, T09, T10
         │        ├── T16
         │        └── T19 (also needs T22) ── T23 (module by module)
         ├─ T20 ──┬── T01 ── T03 (also needs T00)
         │        ├── T04 (also needs T00)
         │        └── T07 (also needs T00)
         ├─ T21 (merges after T00)
         └─ T22

T24 needs T01, T04, T05, T06 and T07. T17 and T18 run alongside from M1.
```

After T00 and T20, every person has a task that nothing blocks: the page already shows live
numbers on mock data, because T00 writes a first pass of the engine and T20 supplies the files.
