# T27: Load time on the real data

Status: in progress (Leon, branch t27-load-time). Report skeleton in docs/load-time.md; waiting for the browser measurements

| | |
|---|---|
| Tier | must |
| Waits for | T04, T21 |
| Branch | `t27-load-time` |

## Goal

Know how long a judge waits. The real height map is 12.8 MB, the Sun and Earth table arrives
one decade file at a time, and nothing else in the plan measures the page on a slow connection
or a phone. This task measures and reports; anyone can claim a separate fix for a failure.
It also does the checks that issue #32 asks for on the final version.

## Files in scope

- `docs/load-time.md`
- `docs/ai-use/T27.md`, `docs/sources/T27.md`, this file's `Status:` line

## Steps

1. Measure the deployed site, not `npm run dev`: the host decides whether files are compressed. In Chrome's developer tools, switch the cache off. Measure twice: with the "Fast 4G" throttle, and with none.
2. For each of `ephemeris.json`, `ephemeris/2020.bin` (the decade the page loads first), `dem.bin` and the JavaScript files, write down the size sent over the network and whether the response has a `content-encoding` header.
3. Write down three times, from pressing Enter on the plain address:
   - until the readout shows Sun and Earth numbers (the smooth-Moon answer, before the height map is in);
   - until the "Loading" line at the top is gone (the height map is in);
   - until the 3D scene shows terrain, if T12 has merged.
4. With everything loaded, record the longest freeze (the Performance tab's longest task) for each of: picking a new site south of 85 S, dragging the time on the timeline, pinning, and clicking four or five spots on the floor of Shackleton crater (each is a new never-lit check that scans to 2100: issue #32, row 1).
5. Record how long every panel says "Loading" when the time moves into a decade not yet on the device: page the timeline from December 2029 into January 2030, and set the time to 1969 (issue #32, row 2). Clear the site's stored data first, or the decade is already there.
6. Repeat steps 3 to 5 once on a real phone on mobile data.
7. Compare with the budgets below and write pass or fail for each.

| Budget | On "Fast 4G" |
|---|---|
| Sun and Earth numbers on screen | 3 s |
| Height map in | 20 s |
| Longest freeze after loading | 0.5 s |

8. For each fail, post the numbers and affected files in the chat so someone can claim a coordinated fix, then measure again:
   - `dem.bin` too big: T04's data preparation. The contract lets `size` and `pixel_m` change; include the "240 m per cell" line in spec section 8 if a coarser grid changes it.
   - The order files load in, or the page waiting for the height map before showing numbers: `main.ts` and loading state.
   - The 3D scene: `web/src/scene/` (T12).
   - A freeze on picking a site: `horizon.ts` (T05) or `state.ts`.
   - A freeze on a crater floor, or a long "Loading" between decades: `state.ts`. Write the numbers in issue #32 too.

## Done when

- [ ] `docs/load-time.md` has the sizes, the three times on both connections and on the phone, the four freezes and the two "Loading" times, with the date and the commit measured.
- [ ] Each budget is marked pass or fail.
- [ ] Each fail has a follow-up task or pull request recorded, and the table has a second row measured after the fix, or a line saying the team accepted it.
- [ ] This pull request changes no code.

## Prompt to paste into Claude Code

```text
Read CLAUDE.md and tasks/T27-load-time.md. Do only that task, on branch t27-load-time. I take the measurements in the browser and give you the numbers; you write docs/load-time.md from them and mark each budget pass or fail. Use "Files in scope" as the starting scope. Keep this pull request to measurements and reports; list affected files so anyone can claim each fix separately.
```
