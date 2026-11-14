# Task board

Anyone can take any available task. Progress and current contributors live in each task's
pull request and `Status:` line. Use the team chat to claim work before the first push, then
open a draft pull request. This board lists scope and dependencies, not fixed assignments.

## People

| Name | Plan |
|---|---|
| Yi Hung | Claude Max |
| Leon | Claude Pro |
| Yu An | Deepseek |
| Fabian | Claude Pro |
| Hao Zhe | Claude Pro |

## Picking the next task

1. Check the task's `Status:`, open pull requests and the team chat. A historical status can
   lag behind a merge; check the pull request before treating a task as available.
2. Pick unfinished **must** work whose prerequisites have merged. Prefer work that unblocks
   another task or is needed for the next milestone. Bug fixes and reviews count as work.
3. Claim it in the chat with the task id, branch and files you plan to change. Keep the
   `Status:` and draft pull request current; don't start a second implementation of active work.
4. Check for overlapping files. Agree an order or a handoff with the other contributor before
   editing the same file. Include necessary extra files in the declared scope.
5. At M3, switch to the freeze checklist, bugs and submission. Optional features wait for M2;
   T30 keeps its documented exception because it is a check, not a feature.

The detailed branch, overlap, review and handoff process is in `docs/team-workflow.md`.
Anyone can update this board when the task list or dependencies change; coordinate that edit
with other documentation work. Names in past audit notes record earlier contributions and
assignments, not restrictions on who can take the work now.

## Tasks

"Waits for" lists the prerequisite tasks or milestones. Check active claims and file overlaps
as well before starting. One exception: T00, T20 and T21 start together and merge in the
order given in `docs/team-workflow.md`, "The first three merges".

| Task | What | Tier | Waits for |
|---|---|---|---|
| [T00](T00-setup.md) | Site skeleton, with first-pass engine | must | - |
| [T20](T20-mock-data.md) | Mock data | must | - |
| [T21](T21-ci-deploy.md) | CI, deploy and repo settings | must | - |
| [T22](T22-design.md) | Design in Figma, pictures for every slot | must | - |
| [T01](T01-ephemeris.md) | Sun and Earth table from Skyfield | must | T20 |
| [T02](T02-geometry.md) | Prove the angles: geometry.ts | must | T00, T01 |
| [T03](T03-horizons-check.md) | Check our numbers against JPL Horizons | must | T00, T01 |
| [T04](T04-dem.md) | South-pole height map from LOLA | must | T00, T20 |
| [T05](T05-horizon.md) | Terrain skyline: horizon.ts | must | T00 |
| [T06](T06-windows.md) | Prove countdowns and percentages: windows.ts | must | T00 |
| [T07](T07-sites.md) | Curated site list | must | T00, T20 |
| [T08](T08-ui-scenarios.md) | Scenario panel, readout, share link | must | T00 |
| [T09](T09-ui-compare.md) | Compare table and strips | must | T00 |
| [T10](T10-ui-timeline.md) | Timeline chart with scrubber | must | T00 |
| [T11](T11-ui-sky.md) | Sky panorama | must | T05 |
| [T12](T12-scene.md) | 3D scene and map | must | T00 |
| [T13](T13-nudge.md) | Nudge: small move, big change | must | T00, T05 |
| [T16](T16-about.md) | About bar, About panel, Horizons badge | must | T00 |
| [T19](T19-ui-design.md) | Theme, layout, chart style | must | T00, T22 |
| [T23](T23-ui-polish.md) | UI polish: every module matches the design | must | T19, and each module's own task |
| [T24](T24-real-data-checks.md) | Terrain checks on the real data | must | T01, T04, T05, T06, T07 |
| [T25](T25-first-open.md) | Example on first open: rim against floor | must | T00 |
| [T27](T27-load-time.md) | Load time on the real data, measured | must | T04, T21 |
| [T17](T17-pitch.md) | Slides, demo video, submission text | must | M1 for screenshots, M2 for the video |
| [T18](T18-qa.md) | Testing with a real person, bug list | must | M1, repeated at M2 |
| [T26](T26-freeze.md) | Freeze checklist: README, notes, open decisions, tag | must | M3 |
| [T14](T14-layers.md) | Map layers | if time | M2 |
| [T15](T15-panel.md) | Solar panel choice | if time | M2 |
| [T29](T29-transition.md) | Camera glide between 2D and 3D | if time | T12, M2 |
| [T28](T28-mirror.md) | Mirror on rickphobia.com | if time | T21, M1 |
| [T30](T30-smoke-test.md) | Page smoke test in CI | if time | T00, T20, T21 |

## Order

```
kickoff ─┬─ T00 ──┬── T02 (also needs T01)
         │        ├── T06
         │        ├── T12
         │        ├── T25
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
T27 needs T04 and T21. T26 runs at M3.
```

After T00 and T20, several tasks can run in parallel: the page already shows live
numbers on mock data, because T00 writes a first pass of the engine and T20 supplies the files.
