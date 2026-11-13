# Lunar Landing Site Navigator

Team GLYFT's submission for [NASA Space Apps Challenge 2026: Lunar Landing Site Navigator](https://www.spaceappschallenge.org/2026/challenges/lunar-landing-site-navigator/),
Kuala Lumpur. The repo is `glyft-nasa2026/Lunar-Landing-Site-Navigator`.

**What it is:** pick lunar landing sites and dates, and see side by side when each has sunlight
(power) and a line to Earth (radio), measured against the real terrain skyline.

**The product name is still open.** The team picks it. Don't use "Google" in it.

## Where things are

| File | What it's for | Who reads it |
|---|---|---|
| `SPEC.md` | What we build, what's cut, when it's due | Everyone, once |
| `CLAUDE.md` | Rules every Claude session follows in this repo | Loaded automatically by Claude Code |
| `docs/data-contract.md` | File formats and function names both halves follow | Everyone, before writing code |
| `docs/team-workflow.md` | How to take a task: branch, Claude, pull request | Everyone, once |
| `tasks/README.md` | The board: every task, its owner, what it waits for | Everyone, often |
| `tasks/Txx-*.md` | One task each, with its own "done when" tests | The task's owner |
| `docs/ai-use/` | One file per task: how AI was used (the submission needs this) | Each owner writes their own |
| `docs/sources/` | One file per task: every data source and library used | Each owner writes their own |
| `docs/decisions.md` | Decisions and why | P1 writes it |
| `history.md` | What a rule or fact used to say, and why it changed | Read before changing a rule |
| `docs/design.md`, `docs/design/` | The look: palette, type, one picture per part of the screen | Everyone building a UI module |
| `docs/mcp-and-skills.md` | Which MCP servers and skills each person installs; the Figma rules | Everyone, once; the UI designer closely |
| `workflow-audit.md` | A dated audit of this workflow and what was done about each finding | Nobody needs to; it's a record |

## Layout

```
data-prep/     Python, run once on a laptop. Makes the data files.
web/           The site: Vite + TypeScript + three.js + Plotly.js. No server.
web/public/data/   Output of data-prep. Committed, so the site works from a fresh clone.
```

## Run it

Needs Node 22 or newer (`web/.nvmrc`).

```
cd web
npm ci
npm run dev      # the site, on your own machine
npm test         # every test, once
npm run build    # type-check, then build into web/dist/
```

## Rules of the hackathon that bind this repo

- Public repo, MIT licence (`LICENSE`).
- Every data source and library is cited (`docs/sources/`).
- The submission describes how AI tools were used (`docs/ai-use/`).
