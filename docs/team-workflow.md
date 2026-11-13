# How to take a task

Five people, five Claude sessions, one repo, no merge conflicts. It works because **every file
has exactly one owner task**. Two branches never change the same file, so git has nothing to
conflict on.

## The loop

| Step | What you do |
|---|---|
| 1 | Open `tasks/README.md`. Take a task that has your name and whose "Waits for" tasks are merged |
| 2 | Update your copy: `git switch main` then `git pull` |
| 3 | Make the branch named in the task: `git switch -c t05-horizon` |
| 4 | Start Claude Code in the repo folder and paste the prompt from the bottom of your task file |
| 5 | When Claude says it's done, run the "Done when" list yourself. Don't take its word |
| 6 | `git fetch origin` then `git rebase origin/main`, run the checks again, `git push -u origin t05-horizon` |
| 7 | Open a pull request on GitHub. Title = task id and name. Paste the "Done when" results |
| 8 | Someone who isn't you looks at it and merges with **Squash and merge**. Delete the branch |
| 9 | Tell the team chat: "T05 merged". Take the next task |

## Rules that keep it conflict-free

| Rule | Why |
|---|---|
| Edit only the files your task owns | The whole system rests on this |
| Never edit `package.json`, `index.html`, `main.ts`, `state.ts`, `types.ts`, the contract or the board | They belong to P1. Ask P1 in the chat |
| No new packages without P1 | Two people adding packages always conflicts in the lock file |
| Your AI-use notes and sources go in your task's own files | A shared log would be edited by everyone at once |
| Pull requests stay small and merge the same day | A branch open for a day drifts |
| Nobody pushes to `main` | The repo setting blocks it |

If git ever reports a conflict, stop. It means someone edited a file they don't own. Post in the
chat; don't resolve it by guessing.

## Stuck or out of Claude usage

Write where you stopped on the `Status:` line of your task file, push the branch, and say so in
the chat. Anyone can pick the branch up from there.

## Getting the most from a Claude Pro plan

Pro has a smaller usage allowance than Max, so spend it on the task, not on reading.

- Paste the task prompt as written. It tells Claude to read three files, not the whole repo.
- One task per session. Type `/clear` before starting another.
- Don't ask Claude to "look around" or "understand the project".
- Give it errors by pasting the exact message, not a description.
- The biggest tasks (T00, T12) belong to P1, who is on Max.

## Repo settings (P1, once)

On GitHub, Settings, Branches, add a rule for `main`: require a pull request before merging,
require the status check `test-and-build` to pass, and allow squash merging only.
