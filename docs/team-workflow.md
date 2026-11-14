# How to take a task

Anyone can take any task. Coordinate through the team chat, task `Status:` lines and open pull
requests. File lists describe scope; they don't reserve work for a person.

## The loop

| Step | What you do |
|---|---|
| 1 | Open `tasks/README.md`. Pick an available task whose prerequisites are merged; check its `Status:`, open pull requests and the chat. Announce the task id, branch and planned files before starting. If it is already active, arrange a handoff or help on its existing branch |
| 2 | Update your copy: `git switch main` then `git pull` |
| 3 | Make the branch named in the task: `git switch -c t05-horizon` |
| 4 | Use a separate worktree or clone for each concurrent session. Start Claude Code there, paste the task prompt and update `Status:` with who is working, the branch and next step |
| 5 | After the first commit: `git push -u origin t05-horizon`, then `gh pr create --draft`. Title = task id and name. The list of open pull requests is the live board |
| 6 | When Claude says it's done, run the "Done when" list yourself. Don't take its word |
| 7 | `git fetch origin` then `git merge origin/main`, run the checks again, `git push` |
| 8 | Paste the "Done when" results into the pull request and mark it ready. Ask an available teammate to review it |
| 9 | The reviewer does the three checks below and merges with **Squash and merge** |
| 10 | Tell the team chat: "T05 merged". Take the next task |

## Review: who and what

Any available teammate can review. Prefer someone familiar with the changed area. A review
is three checks and takes five minutes.

| Check | How |
|---|---|
| Changes match the declared scope and overlaps are coordinated | `gh pr diff <number> --name-only`, compared with "Files in scope" and any expansion explained in the pull request |
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
| 2 | T21, after T00 | Whoever takes T21 merges `origin/main` into the branch, the check turns green, and the review is the normal one |
| 3 | The rule for `main` | The person completing T21 switches it on after T21 has merged, never before: a rule that demands a check T00 can't have would lock out T00, and T21 with it |

From then on there is no exception. An open pull request that shows no `test-and-build` check
was last pushed before T21 merged; step 7 of the loop starts the check.

## Coordinate files before editing

Compare the files you plan to change with open pull requests and the chat before editing.
If the task needs another file, add it to the declared scope and explain why in the pull
request. No file is reserved for a particular person.

If someone is already editing the same file, agree the order first: let their change merge
and start from updated `main`, or help on their branch with a clear handoff. Meanwhile, take
another task with no overlap. Changes in different files can proceed together, including
module code and its CSS. Contract, shared types, state, theme, dependency and workflow changes
need the same coordination, plus notice to contributors whose work uses the changed interface.

| Rule | Why |
|---|---|
| Keep each task focused; declare necessary extra files before editing them | Reviewers and other sessions can see the full scope |
| Agree an order for overlapping files, including shared files and documentation | Parallel branches touching the same file can conflict |
| Coordinate package changes; commit the manifest and lockfile together | Dependency files often overlap |
| Your AI-use notes and sources go in your task's own files | A shared log would be edited by everyone at once |
| Start follow-up work after its prerequisite task has merged | Real data, engine tests and CSS polish build on earlier work |
| Update your branch with `git merge origin/main`. Never rebase, never force-push | The branch is already pushed. A rebase would need a force-push, which would wipe out a teammate's handoff |
| Pull requests stay small and merge the same day | A branch open for a day drifts |
| Nobody pushes to `main` | The repo setting blocks it, for admins too |

If git reports a conflict, stop and post in the chat. The contributors changing that file agree the fix
together, then the checks are run again. Don't resolve it by guessing.

## Stuck or out of Claude usage

Write where you stopped on the `Status:` line of your task file, push the branch, and say so in
the chat. Anyone can pick the branch up from there: `git switch t05-horizon`, `git pull`.

Hand unfinished work to any available teammate with enough usage allowance.
While you wait for your allowance to reset, take work that needs no Claude: the site lookup
(T07), testing with a real person (T18), the browser settings in T21, drawing in Figma (T22),
or reviewing pull requests.

### Handing a task to a teammate

None of this needs Claude. You type it yourself.

| Step | Who | What |
|---|---|---|
| 1 | You | Edit `Status:`: who is taking over, the branch, what works, what fails and the next step. If nobody has accepted yet, say `available for handoff` |
| 2 | You | Commit everything, even if it's broken: `git add -A` then `git commit -m "T09 handoff: work in progress"` |
| 3 | You | `git push` (the branch and its draft pull request already exist from your first commit) |
| 4 | You | In the chat: task id, branch, draft pull request, who accepted the handoff, and any error message in full |
| 5 | Teammate | Confirm the takeover, then `git fetch origin`, `git switch t09-ui-compare`, `git pull`, and start Claude with the handoff prompt below |
| 6 | You | Review the pull request when your teammate marks it ready, if available |

Say how urgent the handoff is and which tasks it blocks. Once accepted, the previous contributor
stops editing that branch. To resume later, arrange another handoff first.

Handoff prompt (swap in the task file and branch):

```text
Read CLAUDE.md, docs/data-contract.md and tasks/T09-ui-compare.md. Someone else started this task on branch t09-ui-compare, which is checked out now. The Status line at the top of the task file says where they stopped. Look at what exists with git log --oneline origin/main..HEAD and git diff origin/main --stat, then finish the task from there. Don't rewrite what already works. Use "Files in scope" as the starting scope; follow CLAUDE.md's coordination rules for any additional files or dependencies. When you think you're finished, run every line of "Done when" and show me the output for each.
```

## Getting the most from a Claude Pro plan

Pro has a smaller usage allowance than Max, so spend it on the task, not on reading.

- Use the Sonnet model (`/model sonnet`). The larger models use the allowance up much faster.
- Paste the task prompt as written. It keeps the session focused on the task and its dependencies.
- One task per session. Type `/clear` before starting another.
- Don't ask Claude to "look around" or "understand the project".
- Give it errors by pasting the exact message, not a description.
- Add no MCP server you don't need for the task (`docs/mcp-and-skills.md`).
- Anyone with enough usage allowance can take a large task or accept a handoff.

## Before kickoff (everyone)

Project work starts at kickoff, not before. Tools can be ready earlier:

| Have | Check with |
|---|---|
| git, and the repo cloned | `git status` |
| Node 22 or newer | `node -v` |
| GitHub's command line, signed in | `gh auth status` |
| Claude Code, signed in | `claude --version` |
| Python 3.11 or newer (data-prep tasks) | `python --version` |
| Figma seat checked (when using Figma) | `docs/mcp-and-skills.md` section 3 |

## Repo settings (T21 does these)

The repo must be public: on a free organisation GitHub refuses branch rules and Pages for a
private one. Then, on GitHub: a rule for `main` that requires a pull request and the status
check `test-and-build`, with "Do not allow bypassing" ticked; squash merging only; head branches
deleted automatically; Pages published from GitHub Actions. The rule goes on last, after T21
itself has merged ("The first three merges" above). The steps are in `tasks/T21-ci-deploy.md`.
