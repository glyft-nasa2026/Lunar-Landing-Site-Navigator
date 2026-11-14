# History

What a rule or fact in this repo's notes used to say, and why it changed. Newest first. The main
files say what is true now; decisions are in `docs/decisions.md`. Only P1 edits this file.

## 14 Nov 2026: T13's first "Done when" line is checked on real terrain

### tasks/T13-nudge.md

- **Done when, line 1** was "On the mock grid, starting at the crater rim (-87.67, 45.0) and
  nudging 1 km south, down the inside wall, reports a large loss of sunlight." It could not
  pass. `make_mock.py` keeps the mock rim crest flat for 1.5 km either side of the rim
  (`FLAT_M`, there so a read between cells sees the exact height), so 1 km south is still on
  the crest and the nudge rightly says "No meaningful change"; the loss starts 2 km in (pull
  request #35). Now the line starts at -89.45, -137.3 on the real height map, which `main` has
  served since T04 merged, so T13 can check it before it merges. P1 saw "−14 days of sunlight
  in 30 days" and "sunset 17 days earlier" there on pull request #35's preview. Not chosen:
  two nudges on the mock (the site no longer serves the mock crater), or a narrower `FLAT_M`
  (P2's file, and the mock files and their tests would have to be made again).

## 14 Nov 2026: T15 taken by P1, `#panel` slot

### docs/data-contract.md

- **5. Page slots:** said "T00 wires all of them in `main.ts` with placeholders, so no later
  task needs to touch `main.ts` or `index.html`." T15 needs a slot T00 didn't make. Now P1 adds
  the slot for an "if time" task, and the module's own task still never touches those files.
  The `#panel` row and the `panel.ts` row of section 3 are new.

### tasks/README.md and tasks/T15-panel.md

- T15's owner was "unassigned". Now P1 (Yi Hung), whose other tasks are merged.
- T15's files were only `web/src/ui/panel/`, but its percentages are numbers the user sees,
  which must come from `core/`. Now `core/panel.ts` and its test are T15's too.
- Step 3 was "Needs a slot in `index.html`: agree with P1." P1 owns the task, so it now says
  where the slot is. Step 2 adds the 30-day average, which shows the difference between the
  panels even at an hour when the Sun is down.

## 14 Nov 2026: `#panel` slot in T19's layout step

### tasks/T19-ui-design.md

- Step 3's phone order was "about, scene, scenarios, readout, nudge, compare, timeline, sky".
  Now `panel` comes after `nudge`, and the step says where `#panel` (T15's Solar panel card,
  pull request #36) goes on desktop. A new Done-when line checks it. T19's grid (pull request
  #23) places every slot by name, so a slot it doesn't name would land in a stray cell.

## 14 Nov 2026: dates 1900-2100, one file per decade, DE440

From pull request #31 (MarsRon). The team asked to pick any date over a much wider span. One
hourly file for 1900-2100 would be over 40 MB to download up front, so the table is split by
decade (the page loads the 2020s, 0.7 MB, and other decades when a scenario needs them) and
thinned to one row every 3 hours, which still agrees with Skyfield's surface alt/az to 0.001
degrees (T02 allows 0.02). DE421's Moon orientation file stops in 2050; DE440's covers
1550-2650. "Permanently shadowed" now covers the future from the chosen time instead of one
fixed decade. The risks accepted at merge are tracked in issue #32.

### SPEC.md

- **4. Features, F2:** the range was "2026 to 2035". Now 1900 to 2100.
- **4. Features, F4:** the special wording was "Permanently shadowed (2026-2035)". Now
  "(until 2100)".
- **5. How it works:** the Sun and Earth row was "hourly, 2026-2035", from "NASA JPL DE421
  files", output "`ephemeris.bin` (about 2 MB)". Now every 3 hours, 1900-2100, DE440, one file
  per decade.
- **7. Accuracy:** the Shackleton floor row was "Never lit, 2026-2035". Now "Never lit, to 2100".
- **8. Known limits:** was "Table covers 2026-2035, hourly, with straight-line steps between
  hours." Now 1900-2100 every 3 hours, plus what "Permanently shadowed" means.

### docs/data-contract.md

- **1. Moon-fixed frame:** the frame was `MOON_ME_DE421`. Now `MOON_ME_DE440_ME421`.
- **2. Files, `ephemeris.json` + `ephemeris/<decade>.bin`:** the heading was "`ephemeris.bin` +
  `ephemeris.json`": one file, `start` 2026-01-01T00:00:00Z, `step_s` 3600, `rows` 87649,
  `source` "JPL DE421 via Skyfield". Now `ephemeris.json` is an index with `home` and `chunks`
  (file, start, rows, hash), `step_s` is 10800, and the browser keeps decade files in Cache
  Storage. A table without `chunks` (T20's mock) is still one `ephemeris.bin`.
- **3. TypeScript, the `ephemeris.ts` row:** listed only `loadEphemeris`, `parseEphemeris`,
  `startMs`, `endMs`, `meta` and `vectorsAt`. Added `loadEphemerisChunk`, `indexEphemeris`,
  `homeStartMs`, `homeEndMs`, `missing` and `withChunk`.
- **3. TypeScript, Visibility (T06), wording table:** was `Permanently shadowed (2026-2035)`.
- **4. State:** `neverLitFor` was "no sunlight there in the whole table". The "Decades" and
  "Never lit" notes are new.

### docs/decisions.md

- Pull request #31 added two rows: one from its first version and one from its final version,
  which said it "replaces the 1950-2050 hourly line below". They are now one row. The removed
  row said: "Time range widened from 2026-2035 to 1950-2050. The table is split into one file
  per decade; the page loads the 2020s first and other decades the first time a scenario needs
  them. Kernels move from DE421 to DE440 (frame `MOON_ME_DE440_ME421`). 'Permanently shadowed'
  is judged on 2020-2029." Why: "Users asked to pick any date 1950-2050. One hourly file would
  be about 21 MB to download up front; per decade it stays at about 2 MB. DE421's Moon
  orientation file stops in 2050. A shadow verdict over 'whatever has loaded' would change as
  decades arrive." The range then grew to 1900-2100 at 3-hour rows, and the shadow verdict
  moved from 2020-2029 to the chosen time through 2100.

## 14 Nov 2026: pull request previews get their own address

### docs/decisions.md

- The preview row said latest-ticket previews include passing same-repository PR builds, with
  `darksight.space` showing the newest passing branch, so the newest completed ticket was
  visible immediately. In practice a pull request built on an older `main` replaced the live
  site and hid merged work: after T22's preview deployed at 06:34 the site lost T11's Sky chart
  and the T08 date fix until `main` was redeployed. Yi Hung asked for pull request previews on
  their own addresses, with only `main` on `darksight.space`.

## 14 Nov 2026: homelab hosting and latest-ticket previews

### docs/decisions.md

- The product row said `darksight.space` was served by GitHub Pages, and an older hosting row
  named GitHub Pages as the submission link with a `rickphobia.com` mirror. Yi Hung explicitly
  specified homelab nginx, Cloudflare Tunnel and `darksight.space`. The chosen architecture
  now records that setup and the existing main-to-`deploy`-branch workflow for the homelab.
- Yi Hung also requested the latest passing ticket preview before merge. The authorised
  preview workflow currently deploys same-repository PR builds to Cloudflare Pages, and the
  apex domain points there. The decision distinguishes that live preview route from the
  chosen Tunnel architecture: the main-only homelab workflow does not yet publish PR previews.
  This documentation update does not change nginx, Tunnel configuration, workflows or DNS.

## 14 Nov 2026: product named Darksight

### README.md, SPEC.md, the page title and `package.json`

- The product was "Lunar Landing Site Navigator", the challenge's own title, and the README said
  the name was still open. Now: Darksight, at darksight.space. SPEC's hosting row was "GitHub
  Pages; mirror on rickphobia.com"; now Pages serves darksight.space. Links to the challenge
  keep its title.
- The README said the repo was `glyft-nasa2026/Lunar-Landing-Site-Navigator`. The repo was renamed
  to `glyft-nasa2026/Darksight` on GitHub.

## 14 Nov 2026: workflow audit, follow-up

A third pass, `workflow-audit-follow-up.md` (five findings, two wording notes), on the plan as
reworked below. The parallel start, merge-not-rebase and P5's UI-only role were not reopened.

### CLAUDE.md

- **File ownership.** Was: "Some files change owner once." A module's CSS changes owner twice:
  T00's placeholder, then the module's task, then T23. Now: files pass from one task to the next.

### docs/team-workflow.md

- **Review.** Was: every pull request needs a green `test-and-build`, with no word on the first
  merges. The check doesn't exist until T21's workflow is on `main`, and T21's own check is red
  until T00 is in. Now: "The first three merges" gives the order and what stands in for the check.
- **Repo settings.** Was silent on when the rule for `main` goes on. Now: after T21 has merged.

### tasks/README.md and the task files

- **The board** said nothing beyond "Waits for" was needed "to start, to finish or to merge".
  Not true of T00, T20 and T21, which start together but must merge in order. Now it says so and
  points to the workflow. P3's row had T21 merged before T00 landed, which can't happen.
- **T00** had "With T20's mock files in place" in "Done when", though T20 may merge later. Now
  the line is conditional, and P1 checks it on `main` once T20 is in.
- **T03** waited for T01 only. Its test imports `parseEphemeris`, `sunAltAz` and `earthAltAz`,
  which T00 writes. Now it waits for T00 and T01.
- **T16** had one branch for two collections, and nobody checked the panel after M3, though
  sessions still add sources during the freeze. Now the M3 collection is `t16-about-b`, and
  T17's last line before submitting checks the panel and the submission against the files.
- **T18** had one "Done when" list asking for both `qa/m1.md` and `qa/m2.md`, so the M1 delivery
  could not pass, and its prompt always named `t18-qa`. Now each delivery has its own list. "At
  least 2 people" is now at least one in each round.
- **T21** told P3 to switch the rule on "after your own pull request has run" the check. Done
  before T00 merged, that locks out T00 (no check to pass) and T21 (red until T00). Now: after
  T21 has merged. Its "Done when" mixed lines that can only be tried after the merge (Pages
  address, blocked pull request, refused push) with the rest; now two lists. Its note said
  "When this is merged ... until T00 lands"; T00 lands first.
- **T23**'s prompt said "Edit only that CSS file", which ruled out the AI-use notes, sources and
  Status line every session must update. Now they are named. Its per-module pull requests all
  edit those three, so two open at once conflicted with each other. Now: one open at a time.

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
