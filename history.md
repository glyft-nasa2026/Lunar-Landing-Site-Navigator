# History

What a rule or fact in this repo's notes used to say, and why it changed. Newest first. The main
files say what is true now; decisions are in `docs/decisions.md`. Only P1 edits this file.

## 14 Nov 2026: workflow audit

Two audits on the same day: `workflow-audit.md` (six findings) and a second pass that also
checked the live GitHub settings. Both found that the plan stalled in its first hours.

### CLAUDE.md

- **Git.** Was: "Never rewrite history" together with "`git rebase origin/main` before opening
  the pull request". A rebase rewrites history, and a branch already pushed for a handoff can't
  be pushed again after one without a force-push. Now: merge.
- **Git.** Was: no rule on when to push. Now: push after the first commit and open a draft pull
  request, because a task's progress was invisible to the team until it merged.
- **File ownership.** Was: one fixed owner per file. Several files are created by one task and
  finished by another (mock data, first-pass engine files, placeholders, module CSS), and the
  old wording made a session stop on them. Now: a file can change owner once, after the earlier
  task has merged.
- **Code.** Was: "No colour codes, fonts or pixel sizes in a module", with no way to give Plotly
  or three.js a colour, and no way to write a phone layout. Now: `themeColor()` and the one
  800 px breakpoint.

### docs/team-workflow.md

- **The loop.** Was: rebase at step 6, pull request opened at the end, "someone who isn't you"
  reviews. Now: draft pull request at the first push, merge instead of rebase, a named reviewer
  and three checks, and a 20-minute rule so a green pull request never waits on a sleeping
  reviewer.
- **Conflicts.** Was: "It means someone edited a file they don't own." A file that changes
  owner can conflict with nobody at fault. Now: stop, and the owners agree the fix.
- **Repo settings.** Was: "P1, once", assuming the settings were available. They aren't on a
  private repo in a free organisation (GitHub answered the branch-rule request with "Upgrade to
  GitHub Pro or make this repository public"), and all five accounts are admins. Now: public
  repo, T21 does the settings, bypass switched off.

### tasks/README.md and the task files

- **T00** was "Repo skeleton, mock data, deploy", one task that everyone waited two hours for,
  with stubs that returned zeros. Its file list also left out the stubs, placeholders and mock
  files its own steps created. Now it is the site skeleton only, with a first pass of the
  engine; mock data is T20 and CI is T21, and all three run at once.
- **T01** was P1's. Now P4's: it uses the same Skyfield method as T03, and it left P1 with five
  tasks on the critical path.
- **T02, T05, T06** had "after T01" and "after T04" conditions inside "Waits for" and "Done
  when". Nobody owned those checks once the task had merged. Now "Waits for" lists only real
  prerequisites, and the real-data checks are T24.
- **T03** compared Horizons with the Python calculation only. Now it also saves the Horizons
  numbers as a fixture and tests the browser's maths against them.
- **T13** was P2's and waited for T06 and T08, though it uses nothing from T08. Now P3's,
  waiting for T00 and T05.
- **T16** had two owners, "P5 (text), P3 (wiring)", on one branch and one folder. Now P5 alone.
- **T17** was P5's. Now P4's: the designer does UI only.
- **T19** was "Look and feel" and began with a design document. The design is now T22, done in
  Figma from kickoff; T19 builds it into the three theme files.
- **`data-prep/requirements.txt`** was T01's, but T04 and T03 needed packages first. Now T20
  writes it once with every package.

### docs/data-contract.md

- **Section 2.** Added the mock data layout, so "the mock crater floor" in a task means one
  stated point. Added `status` `reference`, the `horizons.json` fixture and the mock markers.
- **Section 3.** `countdownText(...)` had no signature and three modules call it. Added the
  signature, the `Body` type and the wording table. Added `parseEphemeris` and `parseDem` so
  tests need no data file.
- **Section 4.** Was silent on what a timeline drag does when a pinned scenario is selected, and
  `samplesFor` started at the scenario's own time, so the chart moved under every drag. Added
  the selected-and-live rule, the timeline window, `timelineFor`, `flipFor`, `neverLitFor`.
  `Scenario.color` is now a theme variable's name, not a colour code.
- **Section 6.** Added `themeColor()`, the breakpoint, two terrain colours, and who owns a
  module's CSS.

### README.md

- The title was "CLPS-Lunar-Mission-Browser" with a note that the challenge was renamed on
  28 Oct 2026, "hence the repo name". The repo itself was renamed to
  `Lunar-Landing-Site-Navigator` on 14 Nov 2026.

### SPEC.md

- **Section 3.** The sketch had no place for the nudge buttons or the About bar, and labelled
  the readout "(live)". **Section 7** had one Horizons row that described the Python check as
  "our angles". **Section 9** M0 was "T00 merged".
