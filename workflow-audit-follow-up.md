# Workflow audit: follow-up

Date: 14 November 2026
Reviewer: Codex
Reviewed commit: `57338d84ade80505c716fd219eb931b567a86746`
Status: Findings only. No workflow or implementation changes made.

## Scope and method

Re-audited the current `CLAUDE.md`, `docs/team-workflow.md` and `tasks/README.md`.
Read `history.md`, `docs/decisions.md` and the resolutions appended to
`workflow-audit.md` before judging the revised rules. Checked the relevant task
definitions, data contract and spec as supporting evidence.

The three main workflow files total 281 lines. This pass focuses on bootstrap,
dependencies, repeated deliveries and reporting obligations. It is not a full audit
of scientific assumptions, external service documentation or every optional task.

The working tree was clean at the start. There were no implementation files in
`web/`, `data-prep/` or `.github/` at the reviewed commit. Findings concern the plan,
not observed failures of an implemented application. Live GitHub settings were not
queried, and application tests were not run.

## Earlier audit: what has been addressed

| Earlier finding | Current evidence |
|---|---|
| T00 bootstrap ownership | T00 now lists the placeholders and first-pass files it creates, with explicit transfers. Mock data and CI have separate tasks. |
| T02/T05/T06 prerequisites and late checks | T02 now waits for T01; T00 supplies working geometry for T05; T24 owns the later terrain checks. |
| Two T16 owners | T16 now has P5 as its sole owner. |
| Rebase versus published handoffs | Both instruction files now require merging, without rebasing or force-pushing. |
| Python-only Horizons validation | T03 now owns a fixture and a test of the browser calculation. |
| Conflicts attributed automatically to ownership violations | That explanation has been removed; relevant owners agree on the fix. |

These changes address the specific earlier findings. The new dependency gaps below
are in the revised task structure. The recorded decisions to start tasks in parallel,
use merge rather than rebase, and keep P5 focused on UI are not being reopened.

## Findings

### F1. The first CI-backed merge and deployment lack a bootstrap procedure — blocks

**Evidence:** [Team workflow, Review](docs/team-workflow.md), particularly the
requirement that `test-and-build` be green; [T21, Steps, Done when and
Notes](tasks/T21-ci-deploy.md).

The normal review checklist requires a green `test-and-build` before merging any
task. T21 creates that workflow, but its notes say its own check remains red until
T00 is merged. T00 and T20 branches do not own or contain T21's workflow. No exception
or alternate verification procedure is documented for merging those initial tasks
before CI is available.

T21 also requires the Pages URL to work as an acceptance check, while its deployment
workflow is triggered by a push to `main`. On a fresh setup following these steps,
that deployment cannot be demonstrated until the deployment workflow reaches
`main`. The task does not separate pre-merge checks from post-merge activation.

**Consequence:** Reviewers cannot apply the stated green-check and complete-checklist
rules literally to the first few merges. They must invent exceptions or leave the
bootstrap tasks waiting.

**Recommended change:** Document a finite bootstrap sequence. State how T20 and T00
are verified before CI exists, when T21's branch is updated and tested, when the
required check is enabled, and which deployment checks happen after T21 merges.
Keep the tasks starting in parallel; make their completion and activation order
explicit. Do not use permanent bypasses as the bootstrap procedure.

### F2. The dependency table still omits prerequisites for required checks — blocks

**Evidence:** [Task board, Tasks](tasks/README.md), which says nothing beyond
`Waits for` is needed to start, finish or merge; [T03](tasks/T03-horizons-check.md);
[T00](tasks/T00-setup.md); [T21](tasks/T21-ci-deploy.md).

| Task | Declared prerequisites | Additional requirement in its acceptance list |
|---|---|---|
| T03 | T01, which transitively needs T20 | Its mandatory browser test imports `parseEphemeris`, `sunAltAz` and `earthAltAz`, and requires the npm test/build setup. T00 supplies these, but T00 is not a declared ancestor. |
| T00 | None | The live-altitude check requires T20's mock files, although the task explicitly permits T20 to merge later. No cross-branch verification procedure or deferred owner is named. |
| T21 | None | Its own notes require T00 before CI can pass, and its Pages acceptance check explicitly requires both T00 and T20. |

A local traversal of the task headers confirmed that T03's declared ancestors are
only T01 and T20; T00, T20 and T21 declare no task prerequisites.

**Consequence:** A task can be available according to the board yet unable to meet
its acceptance list. This recreates the start-versus-finish ambiguity that the
previous revision intended to remove.

**Recommended change:** Add T00 to T03's prerequisites. For the parallel bootstrap
tasks, explicitly distinguish starting work from completing integration checks, or
give the combined checks a later owner. Update the board's absolute claim to match
the chosen procedure. Do not serialize all kickoff work merely to fix the wording.

### F3. T18's first delivery requires its second delivery's output — blocks

**Evidence:** [T18, Branch, Done when and Prompt](tasks/T18-qa.md);
[Team workflow, Review](docs/team-workflow.md).

T18 has one branch at M1 and another at M2. Its single acceptance list nevertheless
requires both `qa/m1.md` and `qa/m2.md`. The pasted prompt also always names the M1
branch, `t18-qa`.

At M1, the later M2 test has not happened. The reviewer must either reject the first
delivery or decide independently which mandatory lines to ignore. Reusing the prompt
at M2 also points the session at the earlier branch unless the human edits it.

**Recommended change:** Give each delivery its own acceptance subset and branch
instruction. Require M1 evidence for the first PR and M2 evidence for the second;
state whether the two-person usability check is per round or across both rounds.

### F4. T23's pasted prompt forbids its required session records — costs time

**Evidence:** [T23, Files you own and Prompt](tasks/T23-ui-polish.md);
[`CLAUDE.md`, When the session ends](CLAUDE.md).

T23 owns its AI-use file, sources file and task status line, and the project requires
those to be updated at session end. Its pasted prompt says, "Edit only that CSS
file." Following that instruction literally prevents updating the required records.

**Recommended change:** Limit application edits to the selected module's CSS while
explicitly allowing the task's AI-use notes, sources and status line. Preserve the
separate ownership of markup and shared theme files.

### F5. The final sources and AI-use refresh has no completion gate — costs time

**Evidence:** [T16, Steps](tasks/T16-about.md), especially "again at M3, when every
task has filled in its files"; [SPEC, Milestones](SPEC.md);
[T17, Steps](tasks/T17-pitch.md); [`CLAUDE.md`, When the session ends](CLAUDE.md).

T16 manually copies sources and AI-use notes into the About panel, once initially
and once at M3. M3 is the start of a five-hour freeze in which bug fixes, video and
write-up continue. Task records are updated when those sessions end. The plan does
not establish that all records are complete at M3 or require another refresh if a
later session adds a source or changes the AI-use account.

T17 separately collects the same records for the submission, without a final
synchronization check between the submission and the deployed About panel.

**Consequence:** A compliant late task can leave the deployed attribution or
submission summary incomplete even though its own records are correct.

**Recommended change:** Keep the M3 collection as a checkpoint. Add a named final
check after the last relevant records update and before submission, covering both
the deployed About panel and T17's submission text. Say who requests a refresh if a
source changes after that check.

## Lower-priority wording

- **Cosmetic:** `CLAUDE.md` says a file changes owner "once", but module CSS passes
  from T00 to its module task and then to T23. Describe an ordered transfer after
  each predecessor merges instead. The specific tables already explain the intent.
- **Cosmetic:** T21's final note says to work with P5 after T21 merges "until T00
  lands", although the preceding note requires T00 to land before T21 can pass.
  Align that sentence with the bootstrap sequence selected for F1.

The current `CLAUDE.md` is 82 lines and 768 words. This pass found no need to split
it merely for length. The main problems are acceptance gates and conflicting
instructions, rather than model-specific prompting or unsupported claims about
the user's preferences.

## Handoff

Prioritize F1 and F2 before kickoff. Resolve F3 before the first QA delivery, and
F4 before the first polish session. Assign F5's final refresh before submission.

This report is a dated record, not an approved rewrite. Check the current files
before making changes. Follow the project's ownership rules, and record changed
rules and their reasons in `history.md`. Annotate resolutions or create another
report instead of replacing the original findings.

Further review could cover optional task integration, numerical edge cases and
live GitHub configuration; those are outside this pass.

## Resolutions (added 14 November 2026 by Claude; the findings above are unchanged)

Each finding was checked against the files at commit `57338d8` first. All five and both wording
notes held.

| Finding | What was done | Where |
|---|---|---|
| F1. First merges under the green-check rule | A fixed order, once: T00 and T20 merge on checks run by hand, T21 merges after T00 with a green check, and only then is the rule for `main` switched on. T21's "Done when" is split into before and after its merge | `docs/team-workflow.md` "The first three merges", `tasks/T21-ci-deploy.md`, notes in T00 and T20 |
| F2. Prerequisites missing from "Waits for" | T03 waits for T00 and T01. T00's mock-data line is conditional, with P1 checking it on `main` once T20 is in. The board's "nothing else is needed" sentence names the T00, T20, T21 exception | `tasks/README.md`, T00, T03 |
| F3. T18's first delivery needs the second's file | One "Done when" list per delivery; the prompt names both branches. The 60-second test is at least one person per round, so 2 or more in total, as before | `tasks/T18-qa.md` |
| F4. T23's prompt forbids its records | The prompt allows T23's AI-use notes, sources and Status line | `tasks/T23-ui-polish.md` |
| F5. No final sources and AI-use check | T16's M3 collection is its own delivery (`t16-about-b`). T17 gets a last line before submitting: P4 checks the submission text and the deployed About panel against the files, and asks P5 for one more delivery if the panel is behind | `tasks/T16-about.md`, `tasks/T17-pitch.md` |
| Wording: "change owner once" | Files pass from one task to the next | `CLAUDE.md` "File ownership" |
| Wording: T21 "until T00 lands" | Follows the F1 order: P3 goes through the design while T21 waits for T00 | `tasks/T21-ci-deploy.md`, `tasks/README.md` P3's row |

Found while checking, not in the findings above:

| Problem | What was done | Where |
|---|---|---|
| T21 step 6 said to switch the rule on once its own pull request had run the check. Done before T00 merged, that locks out T00 (it has no check to pass) and T21 (red until T00 is in) | The rule goes on after T21 has merged | `tasks/T21-ci-deploy.md` step 6, `docs/team-workflow.md` |
| T23's per-module pull requests all edit `docs/ai-use/T23.md`, `docs/sources/T23.md` and the Status line, so two open at once conflict with each other | One T23 pull request open at a time | `tasks/T23-ui-polish.md` |
| T16's second collection had no branch | `t16-about-b` | `tasks/T16-about.md` |

Old wording and reasons are in `history.md`, "workflow audit, follow-up". The order of the first
merges is also a line in `docs/decisions.md`.
