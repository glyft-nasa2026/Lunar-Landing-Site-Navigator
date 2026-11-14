# Rules for every Claude session in this repo

This is a 48-hour hackathon project built by five people, each with their own Claude session.
Anyone can take any task. The rules below keep parallel sessions coordinated.

## Before writing anything

1. Read `docs/data-contract.md`.
2. Read `tasks/README.md` and `docs/team-workflow.md`, then the task file (`tasks/Txx-*.md`).
3. Read the files needed for that task and its dependencies. Keep context focused.

## Task coordination

- **Anyone can claim any available task.** Check its `Status:`, open pull requests and the team
  chat first. Claim it with the task id, branch and planned files; keep the draft pull request
  and `Status:` current. An active task changes hands through an explicit handoff.
- **Files in scope are a starting list, not exclusive ownership.** Include other files needed
  to finish the task, document the expanded scope in the pull request, and check for overlap
  before editing. Shared files, the contract, theme and dependencies follow the same rule.
- **Coordinate overlapping edits.** Agree the order with the other contributor before editing
  the same file; merge the earlier change first or work together on one branch. Use separate
  worktrees or clones for concurrent sessions. Details are in `docs/team-workflow.md`.
- Respect task dependencies and milestones. Start from current `main` after prerequisites
  merge; mock-to-real data, engine tests and CSS polish still follow their task order.
- Keep manifest and lockfile changes together. Coordinate package changes so two branches
  don't update the same dependency files at once.
- AI-use notes go in `docs/ai-use/<task id>.md`, sources in `docs/sources/<task id>.md`.
  Keep records per task and include the checks performed by each contributor.

## Git

- One branch per task, named like the task file: `t05-horizon`. A task that delivers a second
  time uses a new branch from `main` with a letter: `t18-qa-b`.
- Small commits. Never commit to `main`. Never force-push. Never rebase or amend.
- Push after the first commit and open a draft pull request, so the team sees the task is taken.
- Before marking the pull request ready: `git fetch origin` then `git merge origin/main`, then
  run the checks again. Merge, not rebase: the branch is already pushed.
- If git reports a conflict, stop and tell the human. Don't resolve it by guessing.
- Don't commit raw downloads (`data-prep/raw/` is git-ignored).

## Facts this project depends on

- **The Moon has no atmosphere. Never apply atmospheric refraction.**
- Angles are in degrees. Altitude is above the local horizontal. Azimuth is clockwise from north.
- Latitude north-positive. Longitude east-positive, from -180 to 180. Never 0 to 360.
- Time is UTC. In code it is milliseconds since 1970 (`tMs`). In files it is ISO 8601 with `Z`.
- Moon radius is 1737.4 km. Heights are metres above that sphere.
- **Every number shown to the user comes from `web/src/core/`.** UI and 3D code never compute
  Sun or Earth angles themselves. The 3D scene illustrates; it is not the source of truth.
- No server, no database, no accounts. The site is static files.

## Code

- TypeScript, strict mode. `core/` is pure functions: no DOM, no three.js, no network except the
  two data loaders.
- Every `core/` function has a test (vitest). A task isn't done until `npm test` and
  `npm run build` pass.
- Each UI module exports `mount(el: HTMLElement): void`, reads from `state.ts`, and keeps its
  CSS in its own file in its own folder.
- **No colour codes, fonts or pixel sizes in a module.** Use the variables and classes in
  `web/src/ui/theme.css` (contract section 6), and `plotLayout()` for every Plotly chart. A
  colour needed in JavaScript (Plotly, three.js) comes from `themeColor()`. The one pixel value
  allowed is the phone breakpoint, `@media (max-width: 800px)`. T19 establishes the shared theme;
  coordinate any theme changes with active UI work.
- **Data may still be loading or still be mock.** A module shows "Loading" while `eph` is null
  and never crashes on it. A test that needs real data skips when the file says
  `"source": "mock"`.
- Python in `data-prep/` writes only into `web/public/data/` and `web/src/core/__fixtures__/`.

## Why a rule is the way it is

Read `history.md` (old versions and the reason each changed) and `docs/decisions.md` before
changing a rule or saying one is wrong.

## When the session ends

1. Run the task's "Done when" list and report each line as pass or fail, with the output.
2. Update `docs/ai-use/<task id>.md`: what you generated, what the human checked.
3. Update `docs/sources/<task id>.md`: every dataset, paper, library and web page used, with link.
4. Set the `Status:` line at the top of your task file.
