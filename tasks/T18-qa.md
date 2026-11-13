# T18: Testing with a real person, bug list

Status: not started

| | |
|---|---|
| Owner | P4 |
| Tier | must |
| Waits for | M1, repeated at M2 |
| Branch | `t18-qa` at M1, `t18-qa-b` at M2 |

## Goal

Find what's broken or confusing before the judges do.

## Files you own

- `qa/`
- `docs/ai-use/T18.md`, `docs/sources/T18.md`, this file's `Status:` line

## Steps

1. The 60-second test: someone outside the team, no instructions, is asked "which of these two sites gets more sunlight this month?" Time it. Write down where they hesitated.
2. Walk through every "Done when" in the spec's feature table on the deployed site, in Chrome and one other browser, and on a phone.
3. Bugs go in the team chat with the task id of the folder they're in, so they reach the owner.

## Done when

- [ ] `qa/m1.md` and `qa/m2.md` each list every spec feature as pass or fail.
- [ ] The 60-second test was run with at least 2 people, with their times.

## Prompt to paste into Claude Code

```text
Read CLAUDE.md, docs/data-contract.md and tasks/T18-qa.md. Do only that task, on branch t18-qa. Edit only the files it lists under "Files you own". If the task needs a change anywhere else, or a new package, stop and tell me. When you think you're finished, run every line of "Done when" and show me the output for each.
```
