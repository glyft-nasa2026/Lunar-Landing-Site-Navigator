# History

What a rule or fact in this repo's notes used to say, and why it changed. Newest first. The main
files say what is true now; decisions are in `docs/decisions.md`. Anyone can record a change;
coordinate overlapping edits.

## 14 Nov 2026: four south-pole sites moved onto the crests (T07, #82)

The audit of the merged tickets ran every south-pole site through the engine. Four sat on
points from Bussey et al. (2010), found on Kaguya topography and printed to 0.01 degrees, and
on our LOLA 240 m map they miss the crests they name. #70 had already fixed the same fault for
the rim.

### web/public/data/sites.json

| id | Was | Lit on our map in 2020 | Now |
|---|---|---|---|
| `connecting-ridge` | "Connecting ridge (Point B)", -89.44, -141.8 | 42.6 % | -89.4398, -137.17 (Gläser et al. 2018, C1) |
| `shackleton-ridge-120e` | "Shackleton ridge at 120 E (Point D)", -88.79, 124.5 | 56.8 % | -88.8089, 123.76 (NASA's LOLA sunlight map) |
| `de-gerlache-rim` | "de Gerlache rim (Point C)", -88.71, -68.7 | 64.6 % | -88.7061, -68.52 (same map) |
| `malapert-massif` | "Malapert massif (Point M1)", -86.04, 2.7 | 43.2 % | -86.0412, 3.16 (same map) |

- All four had agency "JHU APL (Bussey et al. 2010)", year 2010, and the paper's DOI as source.
- Their notes quoted Bussey's figures: "lit 82% of 2020; often lit when the rim is dark", "Most
  sunlit point in the study, lit 86% of 2020", "lit 85% of 2020 with the shortest eclipses in
  the study", "lit 74% of 2020". Those are true of Bussey's points on Bussey's map, and the app
  showed about half of each. Now the notes say where the point comes from and quote no
  percentage.
- `shackleton-rim` was named "Shackleton rim (Gläser et al. 2018, cluster S0)". The name shows
  in the dropdown, the cards, the compare header and the pins, so it is now "Shackleton rim";
  the citation stays in the other fields.

### docs/sources/T07.md

- The Bussey row listed the four points as sources of coordinates, and a note said they "may
  sit a few hundred metres from the true crest". A paragraph told how the rim was corrected and
  ended "The other Bussey points (B, C, D, M1) are unchanged". Now one section, "Why no
  coordinate is Bussey's", holds all five points, old and new, and a "don't put a point back on
  a paper's rounded coordinate" guard.
- The Gläser row set the paper's 85.5 % average illumination beside our 83.9 % of time lit. The
  like-for-like figure is the paper's solar visibility, 89.4 %; the row now gives both.

### tasks/T07-sites.md

- `Status:` said "in review (draft PR open; Quickmap tick list still to do by a person)" after
  #42 and #70 had merged, with every "Done when" box unticked. Four boxes are now ticked; the
  Quickmap line stays open, and the status line says so.

## 14 Nov 2026: compare has a Live column; first-open example is rim (live) against floor (A)

#47 added a Live column to the compare table and strips. Yi Hung approved both follow-ups there
("lgtm"); issue #51 listed them.

### SPEC.md, F6, F7 and F19

- **F6** said "One column per pinned scenario", tested by "Two pinned scenarios show two
  columns". Now a Live column comes first, so two pinned scenarios show three columns.
- **F7** said "Two bars per scenario"; it now says Live included.
- **F19** said "the crater rim (live, and pinned as A) against the crater floor (pinned as B)",
  tested by "The plain link shows two columns ... unpinning both and reloading leaves nothing
  pinned". With a Live column that opened on two identical columns (Live and A, both at the
  rim), and the best-value mark landed on both wherever they tied. Now the floor is pinned as
  A and the rim is not pinned; the two columns are Live and A, and the test unpins A.

### docs/data-contract.md, section 4: First open

- Was "live at the crater rim, the rim pinned as A, the crater floor pinned as B, all at the
  current hour", and "a module may find two scenarios pinned". Now the floor alone is pinned,
  as A, with a "don't also pin the rim" guard. Two rules were added: an edit to live or a pin
  before the site list arrives cancels the example (sites can arrive after a first click), and
  the example goes into the page address.

### tasks/T25-first-open.md

- Step 3, "Done when" lines 1 and 5, and the Notes followed F19's old example ("A is the rim, B
  is the floor", "Unpin both", "three scenarios"). They now follow the new one.

## 14 Nov 2026: anyone can take any task

Yi Hung asked: "change the ownership thing, no need to arrange tasks to specific person anymore,
anyone can take any tasks, we just have to arrange better".

### CLAUDE.md: File ownership; docs/team-workflow.md

- Was "Edit only the files listed under 'Files you own' in your task", with a protected-file
  list, "Need a change in a file you don't own? Stop", and "ask P1" for packages. File lists
  now describe starting scope; necessary extra files can be declared in the pull request.
  Anyone can change shared files after coordinating overlaps. Dependency files still change
  together, and task dependencies and milestones still apply.
- The workflow said "Take the next task in your row", assigned reviewers in a P1-to-P5 ring,
  and made P1 the fallback for handoffs and large tasks. Now anyone can claim available work,
  review it or accept a handoff. Claims name the task, branch and planned files; active work
  changes hands explicitly. Concurrent sessions use separate worktrees or clones, and
  contributors agree an order before editing the same file.

### tasks/README.md; tasks/T00-T30: metadata, scope and prompts

- During integration with current `main`, T31 arrived with an Owner row naming P3 and a
  "Files you own" list requiring P1 approval. Yi Hung authorised resolving the conflicts and
  finishing the merge. T31 now follows the same open-task policy, making 32 tasks. Both the
  coordination decision and the flat-map decision are retained; T29 keeps the new map scope,
  cross-fade behaviour and T31 dependency. Incoming task statuses and prerequisites stay.

- Removed the fixed person-to-task sequences, the board's Owner column, and each task's
  Owner row (P1-P5 or "unassigned"). The People table keeps names and tool plans, without
  reserved roles. The replacement queue prioritises ready must work, dependencies, milestone
  checks and then optional work. Existing statuses, branch names and prerequisites stay.
- "Files you own" is now "Files in scope". Prompts point to the common coordination rules;
  shared-file fixes no longer have to wait for a named person. T14 includes its slot and scene
  integration; T23 can include necessary coordinated markup. Tests, measurement-only T27 and
  freeze follow-ups retain focused deliveries. Failed checks remain evidence, not a reason to
  weaken a test. Anyone can prepare T28; server steps still require access arranged with
  Yi Hung, whose server hosts the mirror.
- Historic "After the merge" notes and confirmations remain records. Person names there do
  not restrict who can claim follow-up work; the board makes this explicit.

### docs/data-contract.md; docs/mcp-and-skills.md; docs/design.md

- The contract and tool guide said "Only P1 edits". State, page slots, package changes and new
  theme variables were routed to P1; Figma and UI tasks to P5. These now use the common
  coordination process. The data formats, geometry formulas and theme conventions are unchanged.
- Design's unresolved section "Needs P1 (asked once, all together)" is "Needs team decision";
  its six open items are retained. Figma access and exported pictures are selected by task,
  without a person assignment.

### docs/decisions.md; SPEC.md: Open decisions; README.md

- Retired decisions "T01 goes to P4, T13 to P3, T17 to P4", "The UI designer (P5) ... does UI
  only", and "every file has one owner task". Their current replacements record open task
  claims, shared design conventions and coordination of overlaps. T27's "every fix goes to
  the owner" now means anyone can claim a separate fix.
- SPEC's decision contacts were P1, P4 or P5; they are now the team or whoever takes the
  relevant task. Removed "Names against P2-P5 on the board ... blocks delegation" because
  numbered person assignments are no longer used; team names remain on the board.
- README pointers describe the shared queue and contributors. Decisions and history no longer
  reserve editing for P1. Reason for these changes: Yi Hung's instruction above.

## 14 Nov 2026: the 2D map becomes a flat map (issue #39, T31)

P1 approved issue #39. The "2D map" was the 3D scene through a second, orthographic camera.

### SPEC.md, F10 and F16

- F10 said "Two cameras: top-down (the "2D map") and orbit ("3D")". An orthographic camera over a
  sphere is an orthographic azimuthal view: distorted toward the edge, no grid to read a
  coordinate from, and it carried the shadow map and raycasting into the "flat" view. Now: two
  views, a flat map (polar stereographic on the height map, equidistant cylindrical elsewhere,
  with a latitude-longitude grid) and the orbit scene.
- F16 said "The camera glides between top-down and orbit". With no 2D camera there is nothing to
  glide. Now: the flat map and the 3D scene cross-fade, the 3D camera easing onto the site.

### tasks/T29-transition.md

- Was "Camera glide", moving one camera between the two views. Now a cross-fade, waiting for T31
  as well, and sharing `web/src/map/index.ts`.

### tasks/T12-scene.md

- Step 2 ("One scene, two cameras") and step 6 (picking by raycast in both views) describe the
  scene as T12 built it. Since T31 they hold for the 3D view only; the file is left as written.

## 14 Nov 2026: audit of the merged tickets

P1 asked for every merged ticket to be checked: is the work correct, and does the paperwork
match. This entry covers the files changed for the tickets that needed no code fix. The tickets
that did (T00, T02, T03, T05, T08, T10, T12, T20) carry their own "After the merge" notes, in
their own pull requests.

### SPEC.md, section 5 (Where each number comes from)

- The Hosting row said "GitHub Pages at darksight.space; mirror on rickphobia.com". GitHub
  Pages was never used: `docs/decisions.md` records Cloudflare Pages for `main` and for pull
  request previews, and the `deploy` branch for the homelab. The mirror is T28 and has not
  started. Now: the row says what serves the site today.

### tasks/: `Status:` lines

Six merged tickets still read as unfinished, because the line was written before the merge and
never updated. Each now says done with its pull request numbers, and each file has an "After the
merge" section with what changed since and what the audit found. The old lines:

| Task | The line said |
|---|---|
| T01 | done (npm test and npm run build left to CI: Node not installed locally) |
| T04 | done, pull request open (grey image to attach; Quickmap comparison by eye) |
| T06 | done, in review (pull request #5) |
| T11 | done, pull request open (chart to be looked at in the browser) |
| T21 | done |
| T22 | in review. docs/design.md and pictures done from the brief, PDF and SVG (no Figma link yet); waiting for the team's yes in the chat |

- T22's "waiting for the team's yes" is closed on P1's word (14 Nov 2026) that everyone said
  yes. There is still no Figma link.
- The steps and "Done when" lists in those files are left as written: they are the plan as it
  was. What differs today is in each "After the merge" section.

## 14 Nov 2026: `#panel` beside Scenarios in T19's layout step

### tasks/T19-ui-design.md

- Step 3 said `#panel` goes "in the column beside the scene, under `#nudge`", as "a `panel` area
  under `nudge` on desktop (one more row in `grid-template-rows`)", and that without an area the
  card lands "in a stray cell at the bottom". Checked in headless Chrome on T19's branch merged
  with `main`: without an area the card lands at the top of the page, above the map. A row
  beside the scene stretches the map card, whose viewport has a fixed height, and leaves an empty
  band under the map. Now: the Scenarios row becomes `'scenarios panel'`, so the card sits under
  `#nudge` beside `#scenarios` and the map keeps its size. The Done-when line says the same.

## 14 Nov 2026: T25 to T30 reach `main`

Pull request #4 added six tasks on 13 Nov. It was stacked on #3 (`workflow-fixes`) and was
merged 8 seconds after #3, before GitHub had moved its base to `main`. So it merged into the
`workflow-fixes` branch, GitHub showed it as merged, and the six tasks never reached `main`. An
audit of the merged tickets on 14 Nov found them missing. This entry adds them, with the facts
that changed in between brought up to date. The reasons for the six tasks are the ones written
on 13 Nov, kept below.

### tasks/README.md and the task files

- **The board** had 25 tasks, T00 to T24. Now 31: T25 to T30 are new. P1's row gains T25 and
  T26, P2's gains T27.
- **The mirror** on rickphobia.com was in spec section 5 and in `docs/decisions.md`, with no
  task. Now T28, if time.
- **F16**, the camera glide, was an "if time" feature in the spec with no task file, unlike F14
  and F15. Now T29.
- **The freeze.** T16 and T17 collect the sources and AI-use notes, but no task checked that
  every file was filled in, put the live address in the README, closed spec section 10, or
  marked the submitted commit. T21 step 7 asks P1 for the README line with no task to do it in.
  Now T26.
- **Load time.** T05 and T24 time one skyline. Nothing measured the page loading a 12.8 MB
  height map on a slow connection. Now T27, which measures and hands each fix to its owner.
- **CI** runs the unit tests and the build and never opens the page. Now T30, if time, kept
  apart from the "not before M2" rule because it is not a feature.

What the 13 Nov task files said that is no longer true, and what they say now:

- **T25** had no Notes. Added: until T07 merges the site list is mock, and on the real height
  map `mock-rim` and `mock-floor` are two ordinary points.
- **T26** step 1 took the live address from "P3 posts it in T21"; it is `https://darksight.space`.
  Step 2 said the title stays "Lunar Landing Site Navigator" unless P5 picks a name; the product
  was named Darksight on 14 Nov. Step 3 was "real names against P2 to P5", which the board
  already has; it now checks the board against the task files. Step 7 said "the deploy run";
  two workflows publish now, so it names both.
- **T27** said the height map "may be 15 MB" and listed `ephemeris.bin`. The map is 12.8 MB and
  the table is one file per decade (pull request #31). It gains the two checks issue #32 asks
  for on the final version: the pause on a crater floor, and "Loading" between decades.
- **T28** called the mirror a backup for GitHub Pages, "the submitted link". The submitted link
  is `https://darksight.space`, published through Cloudflare Pages. Step 1 now also points at
  the `deploy` branch, which already holds each build.
- **T30** said "one of the eight slots". The page has nine since T15 added `#panel`; it now says
  "the slots in contract section 5".
- **`tickets-summary.md`**, every task in one line, was in the same pull request. It is not
  brought over: it repeated the board and would go stale with it.

### SPEC.md

- **Section 2 and section 4.** There was no F19. The page opened on whatever `state.ts` chose as
  a default (latitude -89.5, longitude 0, nothing pinned). Now F19: the plain link opens on the
  rim-against-floor example.
- **Section 10.** Added the load-time budgets as an open decision: T27's numbers were proposed
  by the session that wrote the task, not agreed by the team.

### docs/data-contract.md

- **Section 4.** Was silent on what state holds when the address is empty. Added "First open".
  Modules can no longer assume nothing is pinned at the start.

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
