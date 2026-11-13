# T28: Mirror on rickphobia.com

Status: not started

| | |
|---|---|
| Owner | P1 |
| Tier | if time |
| Waits for | T21, M1 |
| Branch | `t28-mirror` |

## Goal

A second copy of the site on rickphobia.com, in case GitHub Pages is slow or down while the
judges look. The submitted link stays the GitHub Pages one (`docs/decisions.md`). Only P1 can do
this task: the mirror is P1's own server.

## Files you own

- `docs/ai-use/T28.md`, `docs/sources/T28.md`, this file's `Status:` line

Nothing in `web/` changes. The build already works from any folder, because Vite's `base` is
`./`.

## Steps

1. From an up-to-date `main`: `cd web`, `npm ci`, `npm run build`.
2. On the server, back up whatever is in the target folder, then copy `web/dist/` into a folder of its own under the site. The folder's name becomes the address: post it in the chat.
3. Open the mirror's address. It shows the same page as GitHub Pages, the data loads, and the console has no errors.
4. Do steps 1 to 3 again after the last pull request has merged at M3, so the mirror is the submitted build.
5. Give the address to T26 for the README.

## Done when

- [ ] The mirror's address opens the site, with data loaded and no console errors.
- [ ] Its page source names the same asset files as GitHub Pages' does.
- [ ] After the last merge, both are true again.

## Prompt to paste into Claude Code

```text
Read CLAUDE.md and tasks/T28-mirror.md. Do only that task, on branch t28-mirror. Build the site and tell me the copy commands to run on the server; don't copy anything over a folder you haven't shown me first. Edit only the files it lists under "Files you own". When you think you're finished, run every line of "Done when" and show me the output for each.
```
