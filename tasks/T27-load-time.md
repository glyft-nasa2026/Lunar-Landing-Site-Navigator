# T27: Load time on the real data

Status: not started

| | |
|---|---|
| Owner | P2 |
| Tier | must |
| Waits for | T04, T21 |
| Branch | `t27-load-time` |

## Goal

Know how long a judge waits. The real height map may be 15 MB, and nothing else in the plan
measures the page on a slow connection or a phone. This task measures and reports; each fix
belongs to the owner of the file it is in.

## Files you own

- `docs/load-time.md`
- `docs/ai-use/T27.md`, `docs/sources/T27.md`, this file's `Status:` line

## Steps

1. Measure the deployed site, not `npm run dev`: the host decides whether files are compressed. In Chrome's developer tools, switch the cache off. Measure twice: with the "Fast 4G" throttle, and with none.
2. For each of `ephemeris.bin`, `dem.bin` and the JavaScript files, write down the size sent over the network and whether the response has a `content-encoding` header.
3. Write down three times, from pressing Enter on the plain address:
   - until the readout shows Sun and Earth numbers (the smooth-Moon answer, before the height map is in);
   - until the "Loading" line at the top is gone (the height map is in);
   - until the 3D scene shows terrain, if T12 has merged.
4. With everything loaded, record the longest freeze (the Performance tab's longest task) for each of: picking a new site south of 85 S, dragging the time on the timeline, and pinning.
5. Repeat step 3 once on a real phone on mobile data.
6. Compare with the budgets below and write pass or fail for each.

| Budget | On "Fast 4G" |
|---|---|
| Sun and Earth numbers on screen | 3 s |
| Height map in | 20 s |
| Longest freeze after loading | 0.5 s |

7. For each fail, post the numbers in the chat for the owner, and measure again after their fix:
   - `dem.bin` too big: T04's owner. The contract lets `size` and `pixel_m` change; a coarser grid also changes the "240 m per cell" line in spec section 8, so tell P1.
   - The order files load in, or the page waiting for the height map before showing numbers: P1 (`main.ts`).
   - The 3D scene: T12's owner.
   - A freeze on picking a site: T05's owner (`horizon.ts`) or P1 (`state.ts`).

## Done when

- [ ] `docs/load-time.md` has the sizes, the three times on both connections and on the phone, and the three freezes, with the date and the commit measured.
- [ ] Each budget is marked pass or fail.
- [ ] For each fail, the owner is named in the chat, and the table has a second row measured after the fix, or a line saying the team accepted it.
- [ ] This pull request changes no code.

## Prompt to paste into Claude Code

```text
Read CLAUDE.md and tasks/T27-load-time.md. Do only that task, on branch t27-load-time. I take the measurements in the browser and give you the numbers; you write docs/load-time.md from them and mark each budget pass or fail. Edit only the files it lists under "Files you own". Don't change any code, even if a fix looks obvious: tell me which owner it belongs to.
```
