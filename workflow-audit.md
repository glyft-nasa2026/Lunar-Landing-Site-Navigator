# Workflow audit

Date: 14 November 2026
Reviewer: Codex
Status: Findings for Claude to review and implement. No workflow changes made.

## Scope

Reviewed `CLAUDE.md`, `docs/team-workflow.md` and `tasks/README.md`, with supporting
evidence from the data contract, task definitions, `SPEC.md` and `docs/decisions.md`.
This is a review of the documented workflow, not verification of live GitHub settings
or a completed application. The findings describe the files as read during the audit;
check the current files before applying changes.

## Findings

### 1. T00 needs explicit bootstrap ownership — blocks

**Evidence:** `tasks/T00-setup.md`, “Files you own” and “Steps”; `CLAUDE.md`,
“File ownership”.

T00 must create module placeholders, `core/geometry.ts`, `core/horizon.ts`,
`core/windows.ts` and mock data files. Its ownership list does not grant those paths.
The rule to stop when a task needs an unowned file therefore prevents setup from
finishing as written.

**Recommended change:** Explicitly list the files T00 may create during setup, then
transfer their ownership to the implementation tasks when T00 merges. The theme
files already describe this kind of transfer; apply the same approach consistently.

### 2. Dependencies do not match implementation and acceptance requirements — blocks

**Evidence:** `tasks/T02-geometry.md`, “Waits for”, “Steps” and “Done when”;
`tasks/T05-horizon.md`, the same sections; `tasks/T06-windows.md`, “Waits for” and
“Done when”; `tasks/README.md`, task table and dependency diagram.

- T02 lists T00 as its prerequisite, but its fixture checks need T01. The task
  acknowledges this with “tests go green after T01”.
- T05 lists T00, but requires `destination` from T02. T00 supplies only a stub.
  T05 also requires a real-data check after T04.
- T06 lists T02, but its required terrain check needs T04 and T05.

The workflow says to take a task once its listed prerequisites have merged and to
pass every acceptance check before merging. These lists do not identify all the
prerequisites needed to satisfy that rule.

**Recommended change:** Distinguish prerequisites for starting implementation from
prerequisites for merging. Either include all acceptance dependencies in the merge
gate or assign deferred integration checks to a named task and owner. Keep the
board, diagram and task files consistent.

### 3. T16 has two owners without a file split or handoff — blocks

**Evidence:** `tasks/T16-about.md`, “Owner”, “Branch” and “Files you own”;
`docs/team-workflow.md`, “Rules that keep it conflict-free”.

T16 assigns “P5 (text), P3 (wiring)” to one branch and one shared folder. It does not
say who edits which files or when control transfers. This leaves two sessions able
to edit the same files despite the ownership rule.

**Recommended change:** Choose one branch owner and make the other person a
contributor through review, or explicitly divide the files and define the handoff.
The team needs to choose who owns the branch.

### 4. Published-branch handoffs conflict with the rebase procedure — costs time

**Evidence:** `docs/team-workflow.md`, “The loop” and “Stuck or out of Claude usage”;
`CLAUDE.md`, “Git”.

The handoff procedure pushes unfinished work. The completion procedure then
requires rebasing onto `origin/main`, while the Git rules prohibit force-pushes and
rewriting history. If a published branch is rebased onto a newer main, its rewritten
commits can make a normal push fail.

**Recommended change:** Allow rebasing before the first push. For an already
published or handed-off branch, merge updated `origin/main` into it and rerun the
checks. State the distinction explicitly in both instruction files.

### 5. The Horizons badge claims more than T03 directly checks — costs time

**Evidence:** `tasks/T03-horizons-check.md`, “Steps”, especially “Compute ours with
the same method T01 uses for the fixtures”; `tasks/T16-about.md`, “Steps”;
`SPEC.md`, F13 and “Accuracy”.

T03 compares Horizons against the Python method used to generate fixtures. It does
not directly exercise the browser's binary loader, interpolation and TypeScript
geometry. T02 supplies a separate fixture comparison, but the Horizons result alone
does not measure the browser calculation displayed to the user.

**Recommended change:** Include the actual TypeScript calculation in the Horizons
comparison before displaying the badge, or clearly describe what was checked and
require the complementary browser tests before enabling it. Update dependencies
and ownership to support the chosen validation path.

### 6. The conflict explanation is too absolute — costs time

**Evidence:** `docs/team-workflow.md`, opening paragraph and the instruction:
“If git ever reports a conflict, stop. It means someone edited a file they don't own.”

Ownership reduces conflicts but does not eliminate them. Legitimate ownership
transfers and coordinated fixes can touch the same file on different branches.
A conflict is not sufficient evidence that someone violated ownership.

**Recommended change:** Keep escalation to the relevant owners, but remove the
automatic attribution of fault. Have those owners agree on the resolution and rerun
the checks afterward.

## Other observations

- `CLAUDE.md` was 63 lines and 555 words when reviewed. Its length is reasonable;
  the main issue is consistency between instructions and task definitions.
- The separation of task-specific AI-use notes and sources is useful and should stay.
- No earlier doc-audit commits or project `history.md` were found during this review.

## Handoff to Claude

1. Re-read the current files and check whether any findings have already been fixed.
2. Settle the T16 branch owner with the team before changing that assignment.
3. Prepare consistent changes to bootstrap ownership, dependency gates, handoffs and
   validation. Follow the project's ownership rules and doc-audit approval process.
4. Record changed rules and their reasons in the appropriate history file, following
   the global instructions. Keep this audit as a dated record; annotate resolutions
   rather than rewriting its original findings.

No application tests were run: this audit changed no application code or workflow rules.

## Resolutions (added 14 November 2026 by Claude; the findings above are unchanged)

| Finding | What was done | Where |
|---|---|---|
| 1. T00 bootstrap ownership | T00 lists every file it creates and which task takes each one over. Mock data moved to T20, CI to T21 | `tasks/T00-setup.md`, `CLAUDE.md` "File ownership" |
| 2. Dependencies | "Waits for" now lists only real prerequisites. T00 writes a working first pass of the engine, so T05 has `destination`. The "after T04" checks became T24, owned by P4 | `tasks/README.md`, T02, T05, T06, T24 |
| 3. T16 two owners | T16 belongs to P5 alone | `tasks/T16-about.md` |
| 4. Rebase against no force-push | Always merge, never rebase. One rule instead of the suggested two (rebase before the first push, merge after), because every branch is now pushed at its first commit | `CLAUDE.md` "Git", `docs/team-workflow.md` |
| 5. Horizons badge | T03 also saves the Horizons numbers as a fixture, and a test runs the browser's maths against them on every pull request | `tasks/T03-horizons-check.md`, contract section 2 |
| 6. Conflict wording | The blame sentence is gone; the owners agree the fix | `docs/team-workflow.md` |

Old wording and reasons are in `history.md`. Findings this audit did not cover (the private
repo, the zero-returning stubs, the contract gaps, the Figma seat) are recorded there too.
