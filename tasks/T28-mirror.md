# T28: Mirror on rickphobia.com

Status: not started

| | |
|---|---|
| Tier | if time |
| Waits for | T21, M1 |
| Branch | `t28-mirror` |

## Goal

A second copy of the site on rickphobia.com, in case darksight.space is slow or down while the
judges look. The submitted link stays `https://darksight.space` (`docs/decisions.md`). Anyone
can prepare this task; arrange server access or the copy step with Yi Hung, who controls the
mirror's server.

## Files in scope

- `docs/ai-use/T28.md`, `docs/sources/T28.md`, this file's `Status:` line

Nothing in `web/` changes. The build already works from any folder, because Vite's `base` is
`./`.

## Steps

1. From an up-to-date `main`: `cd web`, `npm ci`, `npm run build`. Or take the build GitHub already made: the `deploy` branch holds `web/dist` for every merge to `main`, with the commit it was built from in `version.txt`.
2. On the server, back up whatever is in the target folder, then copy `web/dist/` into a folder of its own under the site. The folder's name becomes the address: post it in the chat.
3. Open the mirror's address. It shows the same page as darksight.space, the data loads, and the console has no errors.
4. Do steps 1 to 3 again after the last pull request has merged at M3, so the mirror is the submitted build.
5. Give the address to T26 for the README.

## Done when

- [ ] The mirror's address opens the site, with data loaded and no console errors.
- [ ] Its page source names the same asset files as darksight.space's does.
- [ ] After the last merge, both are true again.

## Prompt to paste into Claude Code

```text
Read CLAUDE.md and tasks/T28-mirror.md. Do only that task, on branch t28-mirror. Build the site and tell me the copy commands to run on the server; don't copy anything over a folder you haven't shown me first. Use "Files in scope" as the starting scope; follow CLAUDE.md's coordination rules for any additional files or dependencies. When you think you're finished, run every line of "Done when" and show me the output for each.
```
