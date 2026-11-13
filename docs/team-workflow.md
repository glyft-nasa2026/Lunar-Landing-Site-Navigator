# How to take a task

Five people, five Claude sessions, one repo, no merge conflicts. It works because **every file
has exactly one owner task at a time**. Two open branches never change the same file, so git
has nothing to conflict on.

## The loop

| Step | What you do |
|---|---|
| 1 | Open `tasks/README.md`. Take the next task in your row whose "Waits for" tasks are merged |
| 2 | Update your copy: `git switch main` then `git pull` |
| 3 | Make the branch named in the task: `git switch -c t05-horizon` |
| 4 | Start Claude Code in the repo folder and paste the prompt from the bottom of your task file |
| 5 | After the first commit: `git push -u origin t05-horizon`, then `gh pr create --draft`. Title = task id and name. The list of open pull requests is the live board |
| 6 | When Claude says it's done, run the "Done when" list yourself. Don't take its word |
| 7 | `git fetch origin` then `git merge origin/main`, run the checks again, `git push` |
| 8 | Paste the "Done when" results into the pull request and mark it ready. Tell your reviewer in the chat |
| 9 | The reviewer does the three checks below and merges with **Squash and merge** |
| 10 | Tell the team chat: "T05 merged". Take the next task |

## Review: who and what

Your reviewer is the next person down: P1's is P2, P2's is P3, P3's is P4, P4's is P5, P5's is
P1. A review is three checks and takes five minutes.

| Check | How |
|---|---|
| Only owned files changed | `gh pr diff <number> --name-only`, compared with the task's "Files you own" |
| "Done when" is pasted, every line, with output | Read the pull request |
| The `test-and-build` check is green | The pull request page |

If your reviewer hasn't answered in 20 minutes and the check is green, ask anyone else. If
nobody is awake, merge it yourself and say so in the chat. A waiting pull request blocks other
people; a missed review on a green one rarely does.

### The first three merges

`test-and-build` only exists once T21's workflow file is on `main`, and T21's own check stays red
until `web/` is there. So the first merges go in this order, once:

| Order | Merge | In place of the green check |
|---|---|---|
| 1 | T00 | Its reviewer switches to the branch and runs `npm ci`, `npm test` and `npm run build` in `web/` |
| 1 | T20, before or after T00 | Its script's printed checks, pasted in the pull request. If T00 is already in, `npm test` and `npm run build` too |
| 2 | T21, after T00 | P3 merges `origin/main` into the branch, the check turns green, and the review is the normal one |
| 3 | The rule for `main` | P3 switches it on after T21 has merged, never before: a rule that demands a check T00 can't have would lock out T00, and T21 with it |

From then on there is no exception. An open pull request that shows no `test-and-build` check
was last pushed before T21 merged; step 7 of the loop starts the check.

## Rules that keep it conflict-free

| Rule | Why |
|---|---|
| Edit only the files your task owns | The whole system rests on this |
| Never edit `package.json`, `index.html`, `main.ts`, `state.ts`, `types.ts`, the contract or the board | They belong to P1. Ask P1 in the chat |
| No new packages without P1 | Two people adding packages always conflicts in the lock file |
| Your AI-use notes and sources go in your task's own files | A shared log would be edited by everyone at once |
| A file that changes owner (mock data to real data, a first-pass engine file, a module's CSS) is taken over only after the earlier task has merged | Two branches adding the same file is the one conflict this plan can still produce |
| Update your branch with `git merge origin/main`. Never rebase, never force-push | The branch is already pushed. A rebase would need a force-push, which would wipe out a teammate's handoff |
| Pull requests stay small and merge the same day | A branch open for a day drifts |
| Nobody pushes to `main` | The repo setting blocks it, for admins too |

If git reports a conflict, stop and post in the chat. The owners of that file agree the fix
together, then the checks are run again. Don't resolve it by guessing.

## Stuck or out of Claude usage

Write where you stopped on the `Status:` line of your task file, push the branch, and say so in
the chat. Anyone can pick the branch up from there: `git switch t05-horizon`, `git pull`.

P1 is on Max and is the fallback: if you run out with a task half done, hand the branch to P1.
While you wait for your allowance to reset, take work that needs no Claude: the site lookup
(T07), testing with a real person (T18), the browser settings in T21, drawing in Figma (T22),
or reviewing pull requests.

### Handing a task to P1

None of this needs Claude. You type it yourself.

| Step | Who | What |
|---|---|---|
| 1 | You | Edit the `Status:` line of your task file: what works, what doesn't, what is next. Example: `Status: handed to P1. Table done and tested. Strips draw but the Earth bar is the wrong colour. Not started: the "nothing pinned" message` |
| 2 | You | Commit everything, even if it's broken: `git add -A` then `git commit -m "T09 handoff: work in progress"` |
| 3 | You | `git push` (the branch and its draft pull request already exist from your first commit) |
| 4 | You | In the chat: "T09 handed to P1", with any error message you were stuck on, pasted in full |
| 5 | P1 | `git fetch origin`, `git switch t09-ui-compare`, `git pull`, then start Claude with the handoff prompt below |
| 6 | You | Review the pull request when P1 marks it ready. You know the task best |

P1 doesn't take it straight away if a task on the critical path (T00, T02, T12) is open: say in
the chat how urgent it is. The task stays in your row on the board; if your allowance comes
back first, tell P1 and take it back the same way.

Handoff prompt (P1 swaps in the task file and branch):

```text
Read CLAUDE.md, docs/data-contract.md and tasks/T09-ui-compare.md. Someone else started this task on branch t09-ui-compare, which is checked out now. The Status line at the top of the task file says where they stopped. Look at what exists with git log --oneline origin/main..HEAD and git diff origin/main --stat, then finish the task from there. Don't rewrite what already works. Edit only the files it lists under "Files you own". If the task needs a change anywhere else, or a new package, stop and tell me. When you think you're finished, run every line of "Done when" and show me the output for each.
```

## Getting the most from a Claude Pro plan

Pro has a smaller usage allowance than Max, so spend it on the task, not on reading.

- Use the Sonnet model (`/model sonnet`). The larger models use the allowance up much faster.
- Paste the task prompt as written. It tells Claude to read three files, not the whole repo.
- One task per session. Type `/clear` before starting another.
- Don't ask Claude to "look around" or "understand the project".
- Give it errors by pasting the exact message, not a description.
- Add no MCP server you don't need for the task (`docs/mcp-and-skills.md`).
- The biggest tasks (T00, T12) belong to P1, who is on Max.

## Before kickoff (everyone)

Project work starts at kickoff, not before. Tools can be ready earlier:

| Have | Check with |
|---|---|
| git, and the repo cloned | `git status` |
| Node 22 or newer | `node -v` |
| GitHub's command line, signed in | `gh auth status` |
| Claude Code, signed in | `claude --version` |
| Python 3.11 or newer (P1, P2, P4) | `python --version` |
| Figma seat checked (P5) | `docs/mcp-and-skills.md` section 3 |

## Repo settings (T21 does these)

The repo must be public: on a free organisation GitHub refuses branch rules and Pages for a
private one. Then, on GitHub: a rule for `main` that requires a pull request and the status
check `test-and-build`, with "Do not allow bypassing" ticked; squash merging only; head branches
deleted automatically; Pages published from GitHub Actions. The rule goes on last, after T21
itself has merged ("The first three merges" above). The steps are in `tasks/T21-ci-deploy.md`.
