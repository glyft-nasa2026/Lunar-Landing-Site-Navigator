# Decisions

One dated line each, newest first. Only P1 edits this file.

| Date | Decision | Why |
|---|---|---|
| 14 Nov 2026 | Time range widened from 2026-2035 to 1950-2050. The table is split into one file per decade; the page loads the 2020s first and other decades the first time a scenario needs them. Kernels move from DE421 to DE440 (frame `MOON_ME_DE440_ME421`). "Permanently shadowed" is judged on 2020-2029 | Users asked to pick any date 1950-2050. One hourly file would be about 21 MB to download up front; per decade it stays at about 2 MB. DE421's Moon orientation file stops in 2050. A shadow verdict over "whatever has loaded" would change as decades arrive |
| 14 Nov 2026 | Chosen hosting: nginx serves the static site on Yi Hung's homelab; Cloudflare Tunnel exposes it at `https://darksight.space`. GitHub's `Deploy` workflow publishes builds from `main` to the `deploy` branch for the homelab to pull | Yi Hung uses homelab nginx and Cloudflare Tunnel; GitHub does not need inbound access to the server |
| 14 Nov 2026 | Latest-ticket previews include passing same-repository PR builds before merge. The current `.github/workflows/preview.yml` publishes these to Cloudflare Pages, and `darksight.space` currently points there. The main-only homelab pipeline is separate; moving the domain to the Tunnel must preserve the requested preview behaviour | Yi Hung wants the newest completed ticket visible immediately; the existing homelab workflow only publishes merged code |
| 14 Nov 2026 | The product is named Darksight; its address is darksight.space; the repo is `glyft-nasa2026/Darksight`. The challenge title stays as it is | The name was left open for the team |
| 14 Nov 2026 | The first merges go in a fixed order: T00 and T20 on checks run by hand, then T21, then the rule for `main` is switched on | The `test-and-build` check doesn't exist until T21 is on `main`, and T21 can't pass until T00 is. A rule switched on earlier would lock all three out |
| 14 Nov 2026 | Five tasks start at kickoff: T00 site skeleton (P1), T20 mock data (P2), T21 CI and deploy (P3), T22 design (P5), and P4 prepares T01 | One two-hour setup task left four people waiting on one |
| 14 Nov 2026 | T00 writes a first pass of `geometry.ts` and `windows.ts` from the contract's formulas instead of stubs that return zeros; T02 and T06 then prove them | UI tasks could not check their "Done when" lines against zeros, and T05 needs a working `destination` |
| 14 Nov 2026 | T01 goes to P4, T13 to P3, T17 to P4 | T01 uses the same Skyfield method as P4's T03 and frees P1 for the engine and the 3D scene; the designer does UI only |
| 14 Nov 2026 | The UI designer (P5) works in Figma and does UI only: design (T22), theme (T19), About (T16), polish of every module's CSS (T23). Module owners build from exported pictures | Figma read calls are limited per seat, so one person holds the Figma link; one eye on the look gives one product |
| 14 Nov 2026 | Branches are updated with merge, never rebase | A pushed branch can't be rebased without a force-push, and force-pushes are banned |
| 14 Nov 2026 | Pinned scenarios never change; every edit lands on the live scenario and selects it. The timeline has its own window that a drag doesn't move | Four modules would each have guessed differently; a chart that slides under the cursor can't be dragged |
| 14 Nov 2026 | Checks that need real data are tests in T24, and the browser's maths is tested against Horizons directly (T03) | "After T04" lines had no owner once their task merged; the badge must be true of the code the user runs |
| 14 Nov 2026 | Vite `base` is `./` | The repo was renamed once already; a relative base works under any name and on the mirror |
| 14 Nov 2026 | One shared theme (variables in `theme.css`), owned by one task (T19); modules never write their own colours | Five AI sessions would otherwise produce five different looks |
| 14 Nov 2026 | Branch and pull request per task; every file has one owner task | Five people and five AI sessions at once; disjoint files mean no merge conflicts |
| 14 Nov 2026 | Scenarios compared by pinning (max 3) on one map, not two maps side by side | Two maps are confusing; one colour per scenario everywhere |
| 14 Nov 2026 | Real terrain for any point south of 85 S, computed in the browser from one LOLA grid | The "small move, big change" feature needs terrain at every point, not only at curated sites |
| 14 Nov 2026 | Atmospheric refraction removed from the plan | The Moon has no atmosphere; the challenge statement says so |
| 14 Nov 2026 | GPS and satellite constellations removed | Not in the challenge, which is about direct-to-Earth radio |
| 14 Nov 2026 | No database | All data is fixed and prepared once; shared comparisons live in the page address |
| 14 Nov 2026 | No server: Python prepares data, the browser computes | One deploy, nothing to fall asleep during judging, custom sites answer instantly |
| 14 Nov 2026 | three.js front end, Python for data | Team decision; AI tools write both |
