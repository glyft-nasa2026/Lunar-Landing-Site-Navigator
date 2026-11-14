# T30: Page smoke test in CI

Status: not started

| | |
|---|---|
| Tier | if time |
| Waits for | T00, T20, T21 |
| Branch | `t30-smoke-test` |

## Goal

CI opens the built page once on every pull request. Today it runs the unit tests and the build
only, so a module that breaks when the page loads still gets a green tick, and nobody notices
until someone opens the site.

This is not a feature, so the "not before M2" rule for "if time" features doesn't apply: start
it whenever you are waiting on another task. It is "if time" because T18's walkthroughs at M1
and M2 already cover the same ground by hand. Drop it if it isn't working within an hour.

## Files in scope

- `web/e2e/` (new)
- `.github/workflows/ci.yml` (taken over from T21)
- `web/package.json` and `web/package-lock.json`: one new dev package, `@playwright/test`, and one new script, `test:page`. Announce the dependency change when claiming this task and coordinate with other branches editing these files
- `docs/ai-use/T30.md`, `docs/sources/T30.md`, this file's `Status:` line

## Steps

1. One test in `web/e2e/`. It serves the built site (`vite preview`) and opens it in headless Chromium only.
2. It fails if any of these is true:
   - one of the slots in contract section 5 is empty;
   - any slot's text contains "failed to start" (what `main.ts` writes when a module throws while mounting);
   - the console has an error, or the page throws;
   - the line at the top still says "Data not loaded" after the data files have arrived.
3. `npm test` stays as it is (vitest only, no browser). The new script is `npm run test:page`.
4. In `ci.yml`, add the steps to the existing `test-and-build` job, after the build: install Chromium (`npx playwright install --with-deps chromium`), then `npm run test:page`. Keep the job's name: the rule for `main` requires a check with exactly that name.
5. Time the job before and after. If the new steps add more than 2 minutes, say so in the pull request and let the team decide.

## Done when

- [ ] `npm run test:page` passes on `main`'s build.
- [ ] On a scratch branch that makes one module throw in `mount`, it fails and names the slot. Don't merge that branch.
- [ ] `npm test` still starts no browser.
- [ ] The pull request shows the `test-and-build` time before and after.
- [ ] `npm test` and `npm run build` pass.

## Prompt to paste into Claude Code

```text
Read CLAUDE.md, docs/data-contract.md section 5 and tasks/T30-smoke-test.md. Do only that task, on branch t30-smoke-test. Use "Files in scope" as the starting scope; in web/package.json add the package and script the task names. Follow CLAUDE.md's coordination rules for any additional files or dependencies. When you think you're finished, run every line of "Done when" and show me the output for each.
```
