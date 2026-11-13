# T26: Freeze checklist

Status: not started

| | |
|---|---|
| Owner | P1 |
| Tier | must |
| Waits for | M3 |
| Branch | `t26-freeze` |

## Goal

At the freeze, the repo itself is ready to be judged: the README points at the live site, every
task's notes are filled in, the open decisions are closed, and the commit that was submitted is
marked. T17 checks the submission's text; this task checks the repo. Before this task nobody
owned that sweep.

## Files you own

- `README.md`, `tasks/README.md`
- `web/index.html`: the `<title>` line only
- `SPEC.md`: section 10 only
- `docs/ai-use/T26.md`, `docs/sources/T26.md`, this file's `Status:` line

## Steps

1. `README.md`: the address of the live site (P3 posts it in T21) at the top, the mirror's address if T28 was done, and the product name if the team has picked one.
2. Product name. If P5 has decided it, set the `<title>` in `web/index.html` to it, and check the About bar (T16) shows the same words. If it isn't decided by M3, the title stays "Lunar Landing Site Navigator".
3. `tasks/README.md`: real names against P2 to P5.
4. Go through every merged task. Its `docs/ai-use/` file has at least one row, and that row names what a person checked. Its `docs/sources/` file has at least one row, or says "none". Its `Status:` line says done. Don't fill in someone else's file: post the list of gaps in the chat for the owners.
5. `SPEC.md` section 10: every open decision has its answer written in, or is struck out with the reason.
6. The repo is public and `LICENSE` is MIT.
7. After the last pull request has merged: the deploy run for that commit is green, and the live site's page source names the same asset files as a fresh `npm run build` of `main`. Then mark the commit: `git tag submitted` on `main`'s head and `git push origin submitted`. A tag is not a commit to `main`. Give P4 the tag's link for the form.

## Done when

- [ ] The README's first screen has the live address, and the address opens the site.
- [ ] The page title and the About bar show the same name.
- [ ] No task merged on `main` has an empty `docs/ai-use/` or `docs/sources/` file, or the gaps are posted in the chat with their owners' names.
- [ ] `SPEC.md` section 10 has no row without an answer.
- [ ] The tag `submitted` exists on GitHub and points at the commit the live site was built from.

## Notes

Steps 1 to 6 can go in one pull request before the last features merge. Step 7 is done last, by
hand, after everything else: it needs no pull request.

## Prompt to paste into Claude Code

```text
Read CLAUDE.md and tasks/T26-freeze.md. Do only that task, on branch t26-freeze. Edit only the files it lists under "Files you own", and in web/index.html and SPEC.md only the parts it names. Where a step finds a gap in someone else's file, list it for me; don't fix it. Don't create or push the tag: show me the commands and I'll run them. When you think you're finished, run every line of "Done when" and show me the output for each.
```
