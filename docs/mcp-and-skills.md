# MCP servers and skills

Checked 14 Nov 2026. Only P1 edits this file.

**Short answer:** nobody needs an MCP server or a custom skill to finish a task, except the UI
designer (P5: T22, T19, T16, T23), who needs Figma's. One browser server is optional for people on UI
tasks. Everything else is ordinary command-line tools.

An MCP server is a plug-in that gives a Claude session extra tools (read a Figma file, drive a
browser). A skill is a saved set of instructions a session loads with `/name`.

## 1. Who installs what

| Who | Needs | Optional | Doesn't need |
|---|---|---|---|
| Everyone | Claude Code, git, `gh` (signed in), Node 22 or newer | `/code-review` when reviewing a pull request | A Figma account |
| P1, P2, P4 (data-prep) | Python 3.11 or newer | | |
| UI designer (T22, T19, T16, T23) | Figma MCP (section 3) | Chrome DevTools MCP (section 4) | |
| Module owners (T08-T13) | Nothing extra | Chrome DevTools MCP | Figma MCP: the designer hands over pictures (section 3) |

## 2. Rules

| Rule | Why |
|---|---|
| Add a server for yourself only. Never create `.mcp.json` in the repo, never use `--scope project` | `.mcp.json` loads the server into all five sessions. Each one pays for its tool list and gets a sign-in prompt |
| On a Pro plan, add no server you don't use in that task | Every server's tool list and every screenshot comes out of your usage allowance |
| A server never changes who owns a file | Figma or a browser can show that another module looks wrong. The fix still goes through that module's owner |
| Numbers still come from `web/src/core/` | A design mock-up may show made-up angles. Never copy them into code |
| Every tool you used goes in `docs/ai-use/<task id>.md` and `docs/sources/<task id>.md` | The submission must say how AI was used |

## 3. Figma MCP (UI designer only)

### Before the event: the Figma plan

The server counts "read" calls (fetching a frame, a screenshot, the variables). Limits, from
Figma's rate-limit page:

| Figma plan and seat | Read calls | Enough? |
|---|---|---|
| Starter (free), or a View or Collab seat on any plan | 20 a month | No. Gone in the first hour |
| Full or Dev seat on Professional or Education | 200 a day, 10 a minute | Yes, if spent with care |

- The design file must sit in a team on Professional or Education, with the designer on a Full
  or Dev seat there. *costs time* if this isn't sorted at the start: the fallback below works
  but is slower.
- Education is free for verified students and has Professional's features. Verification isn't
  instant for everyone. Check the seat first thing (ask Claude to run the `whoami` tool); if it
  isn't through, use the fallback below instead of waiting.
- Tools that write to Figma don't count against the limit.
- To spend calls well: give Claude the link to one frame at a time, never the whole file.

**If the designer is stuck on Starter:** don't spend the 20 calls. Export each frame as a PNG
into `docs/design/`, type the variable values into the prompt, and let Claude read the
pictures. Everything in "How the Figma file lines up with the repo" below still applies; only
the transport changes.

### Install (on the designer's laptop)

```
claude plugin install figma@claude-plugins-official
```

Restart Claude Code, type `/plugin`, open the Installed tab, choose `figma`, sign in in the
browser, click Allow access. The plug-in brings Figma's own skills with it.

Without the plug-in (server only, no skills):

```
claude mcp add --transport http figma https://mcp.figma.com/mcp
```

Then `/mcp`, choose `figma`, Authenticate.

### How the Figma file lines up with the repo

| In Figma | Becomes | Owner |
|---|---|---|
| Variables named exactly as contract section 6 (`bg`, `panel`, `text`, `scn-a`, `space-3`, `fs-md`, ...) | Values in `docs/design.md` (T22), then in `web/src/ui/theme.css` (T19) | P5 |
| One frame 1280 wide and one 390 wide, with one layer per slot, named by slot id (`about`, `scene`, `scenarios`, `readout`, `nudge`, `compare`, `timeline`, `sky`) | The grid in `web/src/ui/layout.css` (T19) | P5 |
| Chart styling (background, grid lines, type) | `web/src/ui/plotTheme.ts` (T19) | P5 |
| The inside of each slot | One picture per slot, exported to `docs/design/<slot id>.png` (T22) | P5 exports; the module's owner builds it; P5 then polishes its CSS (T23) |

- Enter the fixed colours first and don't change them: scenarios `#E69F00`, `#0072B2`,
  `#009E73`; Sun `#F0E442`; Earth `#56B4E9`.
- A module owner gives their session the picture: "Read `docs/design/compare.png` and match it
  using only the classes and variables in contract section 6." Claude reads images. No Figma
  account or Figma call is needed.
- A design that needs a variable the contract doesn't have: collect them all and ask P1 once,
  early. Don't invent names.

### Rules for the session that reads Figma

These are already under the prompts in `tasks/T22-design.md` and `tasks/T19-ui-design.md`:

```text
Figma rules for this repo:
- get_design_context returns React and Tailwind by default. This repo uses neither. Ask for plain HTML and CSS, and treat the result as a picture of the design, not as code to paste.
- Write no colour code, font or pixel size outside theme.css and plotTheme.ts. Map every value to a variable from contract section 6. If none fits, stop and tell me.
- Don't rename or remove any variable or class in contract section 6.
- Fetch one frame per call, from the link I give you. Don't walk the whole file: read calls are limited to 200 a day.
- Don't download fonts or add packages. System font stack only.
- Don't write design-system rules into CLAUDE.md, and don't use the Code Connect tools.
```

### Useful Figma tools

| Tool | Use here |
|---|---|
| `get_variable_defs` | Pull the variable values for `theme.css` |
| `get_design_context` | Layout and spacing of one frame, for `layout.css` |
| `get_screenshot` | Let Claude see a frame to compare with the built page |
| `generate_figma_design` | Send the running site (`npm run dev`) into Figma as layers, so the designer draws over the real slots after T00. Works only in some clients: try it once before relying on it |

## 4. Chrome DevTools MCP (optional, UI tasks)

Lets a session open the dev site, take screenshots at 1280 and 390 px, and read console errors,
instead of you describing what you see. Needs Chrome on the same machine.

```
claude mcp add chrome-devtools -- npx -y chrome-devtools-mcp@latest
```

- Worth it for T19 and T23 (two widths, overlap checks) and T12 (the 3D scene).
- On Pro, skip it for small modules: look at the page yourself and paste the exact console
  error, as `docs/team-workflow.md` says.
- It checks looks. It never replaces the task's "Done when" list, which you run yourself.

## 5. Skills

| Skill | Use | Who |
|---|---|---|
| `/code-review` (built in) | The reviewer in step 8 of `docs/team-workflow.md` runs it on the pull request before merging | Reviewer |
| Figma's skills (come with the plug-in) | Turning a frame into code, under the rules in section 3 | UI designer |
| `/clear` (built in command) | Between tasks, so the next task starts with an empty context | Everyone |

**Not to use for module work:** design skills that pick their own palette, fonts or chart
colours (for example `frontend-design` or `dataviz`). The look here is fixed by contract
section 6, and five sessions each "improving" it gives five looks.

**No project skill is needed.** The prompt at the bottom of each task file and the "When the
session ends" list in `CLAUDE.md` already do what a start-task or finish-task skill would. Don't
build one during the event.

## 6. Not needed

| Tool | Use this instead |
|---|---|
| GitHub MCP | `gh` on the command line: `gh pr create`, `gh pr checks`, `gh pr diff --name-only` |
| A docs-lookup server (Context7 and similar) | The task file names the one page to read; Claude fetches it |
| Anything for JPL Horizons, Skyfield or LOLA | Plain Python in `data-prep/`. Horizons is an ordinary web address |
| Playwright MCP | Chrome DevTools MCP covers the same need here. One browser server is enough |

## 7. Sources

- Figma MCP rate limits: https://developers.figma.com/docs/figma-mcp-server/rate-limits-access/
- Figma MCP install: https://developers.figma.com/docs/figma-mcp-server/remote-server-installation
- Figma MCP tools: https://developers.figma.com/docs/figma-mcp-server/tools-and-prompts/
- The Chrome DevTools MCP command is from third-party guides, not yet checked against the
  project's own README. If it fails, run `claude mcp add --help` and check the README.
