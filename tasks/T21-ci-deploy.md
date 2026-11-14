# T21: CI, deploy and repo settings

Status: done (pull requests #8 and #11)

| | |
|---|---|
| Owner | P3 |
| Tier | must |
| Waits for | - |
| Branch | `t21-ci-deploy` |

## Goal

Every pull request is tested automatically, `main` is protected, and each merge to `main`
publishes the site. Runs at the same time as T00.

## Files you own

- `.github/workflows/ci.yml`, `.github/workflows/deploy.yml`
- `docs/ai-use/T21.md`, `docs/sources/T21.md`, this file's `Status:` line

## Steps

1. **The repo must be public first.** On a free organisation, GitHub refuses branch rules and GitHub Pages for a private repo. P1 makes it public; ask in the chat if it isn't yet.
2. `ci.yml`: on every pull request, one job named exactly `test-and-build`. Node from `web/.nvmrc`. In `web/`: `npm ci`, `npm test`, `npm run build`.
3. `deploy.yml`: on push to `main`, build and publish `web/dist` to GitHub Pages with GitHub's own Pages actions.
4. In the browser, Settings, Pages: set the source to "GitHub Actions". Do this before this task merges: the merge is the first deploy.
5. In the browser, Settings, General: allow squash merging only, and switch on "Automatically delete head branches".
6. In the browser, Settings, Branches, a rule for `main`: require a pull request, require the status check `test-and-build`, and tick "Do not allow bypassing the above settings". All five of us are admins, so without that tick the rule stops nobody. GitHub only lets you pick the check after it has run once. **Do this step after this task has merged, not before.** T00's pull request has no `test-and-build` check, so a rule switched on early would lock out T00, and this task with it.
7. Post the Pages address in the chat and ask P1 to put it in the README.

## Done when

Before it merges, once T00 is in and `origin/main` is merged into this branch:

- [ ] The `test-and-build` check on this pull request is green.
- [ ] Pages is set to "GitHub Actions" (step 4), and squash merging is the only kind allowed (step 5).

After it merges. Post each result as a comment on the merged pull request:

- [ ] The deploy run for the merge is green, and the Pages address opens the same page as `npm run dev` does on `main`. If T20 isn't in yet the page says "Data not loaded": look again when it is.
- [ ] The rule for `main` is on (step 6).
- [ ] A pull request that breaks a test is blocked from merging (try it on a throwaway branch, then close it).
- [ ] A direct push to `main` is refused, tried from an admin account.
- [ ] A pull request that only changes a `.md` file still gets a green `test-and-build`.

## Notes

Until T00 merges there is no `web/` folder, so the check on your own pull request is red. That
is expected: merge `origin/main` into your branch once T00 is in, and it turns green.

While this waits for T00, sit with P5 and go through the design for your three modules (T08,
T09, T10). The order of the first merges is in `docs/team-workflow.md`, "The first three merges".

## After the merge

- 14 Nov 2026: hosting is not GitHub Pages, as the steps above say. `main` is published at darksight.space by Cloudflare Pages (`preview.yml`, added by P1 in #9 and #24), each pull request gets its own preview address, and `deploy.yml` commits each build of `main` to the `deploy` branch for the homelab. The reasons are in `docs/decisions.md`.
- 14 Nov 2026, audit of the merged tickets: `ci.yml` has no defect. The live site, `darksight.pages.dev` and the `deploy` branch all served `main`'s latest build. Open, for P3 and P1 (nothing was changed: these files publish the live site and can't be tried out without doing so):
  - *costs time*: pressing "Re-run" on an older `main` run publishes that older commit, in both workflows. Neither checks that its commit is still the tip of `main`.
  - *costs time*: `deploy.yml` can be started by hand from any branch (`workflow_dispatch` with no check), which would put that branch's build on the `deploy` branch. `preview.yml` has the check.
  - *costs time*: the Cloudflare token is a repo-level secret, so a same-repo branch that edits `preview.yml` can publish to the live site. The `wrangler-action` is on a moving tag (`@v3`).
  - *cosmetic*: a manual run of `preview.yml` from another branch joins the `main` queue and cancels a `main` deploy in progress.
  - *cosmetic*: previews of closed pull requests are never removed.
  - *cosmetic*: the branch rule doesn't ask for branches to be up to date, so two green pull requests can break `main` together. Both deploy workflows run the tests again first, so a broken `main` is not published.

## Prompt to paste into Claude Code

```text
Read CLAUDE.md, docs/data-contract.md and tasks/T21-ci-deploy.md. Do only that task, on branch t21-ci-deploy. Edit only the files it lists under "Files you own". Steps 1 and 4 to 7 are clicks in the browser: tell me exactly what to click, and wait for me. Step 6 and the "After it merges" list come after the merge: write out the exact clicks and commands for them before you finish. When you think you're finished, run every line of "Done when" that can be run from here and tell me which ones I must check myself.
```
