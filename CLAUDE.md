# Rules for every Claude session in this repo

This is a 48-hour hackathon project built by five people, each with their own Claude session.
The rules below exist so five sessions can work at once with no merge conflicts.

## Before writing anything

1. Read `docs/data-contract.md`.
2. Read the one task file you were given (`tasks/Txx-*.md`).
3. Don't read the rest of the repo unless the task file tells you to. Context is limited.

## File ownership: the rule that prevents merge conflicts

- **Edit only the files listed under "Files you own" in your task.** Create new files only inside
  the folders listed there.
- **Never edit these, whoever you are, unless your task lists them:** `web/package.json`,
  `web/package-lock.json`, `web/index.html`, `web/src/main.ts`, `web/src/state.ts`,
  `web/src/core/types.ts`, `web/src/ui/theme.css`, `web/src/ui/layout.css`,
  `web/src/ui/plotTheme.ts`, `data-prep/requirements.txt`, `.github/`, `.gitattributes`,
  `docs/data-contract.md`, `docs/decisions.md`, `docs/mcp-and-skills.md`, `SPEC.md`,
  `tasks/README.md`, `history.md`, this file.
- **Some files change owner once.** Mock data becomes real data, a first-pass `core/` file goes
  to the task that proves it, a placeholder goes to its module, a module's CSS goes to T23.
  Your task file says which files you take over and from which task. Make your branch after
  that task has merged, never before.
- **Need a change in a file you don't own?** Stop. Tell the human to ask that file's owner (the
  board in `tasks/README.md` says who). Don't make the change "just this once".
- **Need a new npm or pip package?** Stop and tell the human to ask P1. Don't install it.
- No shared log files. AI-use notes go in `docs/ai-use/<task id>.md`, sources in
  `docs/sources/<task id>.md`. One file per task, so two branches never touch the same file.

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
  allowed is the phone breakpoint, `@media (max-width: 800px)`. The theme files belong to T19:
  don't edit them from another task.
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
