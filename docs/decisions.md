# Decisions

One dated line each, newest first. Only P1 edits this file.

| Date | Decision | Why |
|---|---|---|
| 14 Nov 2026 | One shared theme (variables in `theme.css`), owned by one task (T19); modules never write their own colours | Five AI sessions would otherwise produce five different looks |
| 14 Nov 2026 | Branch and pull request per task; every file has one owner task | Five people and five AI sessions at once; disjoint files mean no merge conflicts |
| 14 Nov 2026 | Scenarios compared by pinning (max 3) on one map, not two maps side by side | Two maps are confusing; one colour per scenario everywhere |
| 14 Nov 2026 | Real terrain for any point south of 85 S, computed in the browser from one LOLA grid | The "small move, big change" feature needs terrain at every point, not only at curated sites |
| 14 Nov 2026 | Atmospheric refraction removed from the plan | The Moon has no atmosphere; the challenge statement says so |
| 14 Nov 2026 | GPS and satellite constellations removed | Not in the challenge, which is about direct-to-Earth radio |
| 14 Nov 2026 | No database | All data is fixed and prepared once; shared comparisons live in the page address |
| 14 Nov 2026 | No server: Python prepares data, the browser computes | One deploy, nothing to fall asleep during judging, custom sites answer instantly |
| 14 Nov 2026 | three.js front end, Python for data | Team decision; AI tools write both |
| 14 Nov 2026 | Hosting: GitHub Pages is the submitted link; rickphobia.com is a mirror | The mirror depends on one home machine while the team is away |
