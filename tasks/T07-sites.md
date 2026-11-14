# T07: Curated site list

Status: done (pull requests #42 and #70; four ridge points moved onto the crests, #82). "Done when" line 3, the Quickmap check by a person, is still open

| | |
|---|---|
| Tier | must |
| Waits for | T00, T20 |
| Branch | `t07-sites` |

## Goal

15-20 real sites in the contract's format, each with a source link.

## Files in scope

- `web/public/data/sites.json` (taken over from T20's mock)
- `docs/ai-use/T07.md`, `docs/sources/T07.md`, this file's `Status:` line

## Steps

1. Three groups: Apollo landings (6), recent landers from several countries and companies, south-pole candidates (Shackleton rim, Malapert, Nobile, Mons Mouton, Artemis candidate regions).
2. Take every coordinate from an official or published source and paste the link in `source`. **Don't accept coordinates from an AI's memory.**
3. Convert every longitude to east-positive, -180 to 180. A source that says "W" or uses 0-360 needs converting.
4. At least 6 sites south of 85 S, since that's where real terrain applies.
5. Two entries the checks and the demo need, both with `status` `reference` and ids exactly `shackleton-floor` and `shackleton-rim`: the centre of Shackleton's floor, and a point on its rim crest that a published study names as one of the most sunlit. Cite the study. Whoever completes T04 posts candidate points from the height map.

## Done when

- [x] Every entry has all fields and a working source link.
- [x] Every longitude is between -180 and 180.
- [ ] Each site, typed into Quickmap, lands on the named feature. Tick list in the pull request.
- [x] `npm test` still passes (T00 has a test that checks the file's shape).
- [x] `npm test` and `npm run build` pass.

## Notes

No Claude needed for most of this. It's careful lookup work, and it can start at kickoff in a scratch file: only the final `sites.json` waits for T00 and T20.

Quickmap moved: `quickmap.lroc.asu.edu` now forwards to `quickmap.lroc.im-ldi.com` (seen 14 Nov 2026).

## After the merge

- 14 Nov 2026, audit of the merged tickets. Checked and correct: the contract's fields and words, unique ids, both reference ids; all 14 lander coordinates match their cited pages digit for digit, with the Chang'e 5 and 6 conversions from 0-360 right; `shackleton-floor` matches the Gazetteer and is never lit across 1900-2100; the rim coordinate of #70 matches Gläser's Table 2, and its 83.9 % reproduces. 12 of 12 source links answer.
- The same audit found four south-pole points off their crests on our map (lit 43 to 65 % of 2020 where their notes said 74 to 86 %). Fixed in #82, with a test in `web/src/core/sites.test.ts` that runs the five sunlit points and the floor through the real map. The table of old and new points is in `docs/sources/T07.md`, "Why no coordinate is Bussey's".
- "Done when" line 3 is not done: no person has typed the sites into Quickmap. The check that stood in for it, against LROC's map server, passed the first rim point as "on the crest" when it was 550 m off. *costs time*: for the five sunlit points the new test now does this job better than a look at a map; for the 14 landers it is a few minutes by eye.
- Three of the new points (`shackleton-ridge-120e`, `de-gerlache-rim`, `malapert-massif`) come from a rule applied to NASA's sunlight map, not from a point named in a study. *cosmetic*: a person may prefer named points (the Mazarico et al. 2011 table, not read: paywalled).
- Step 1's Nobile and Mons Mouton candidates are not in the list (IM-2 is in the Mons Mouton region). *cosmetic*.
- "Southernmost landing so far" in IM-2's note was true when written; it was not checked again. *cosmetic*.

## Prompt to paste into Claude Code

```text
Read CLAUDE.md, docs/data-contract.md and tasks/T07-sites.md. Do only that task, on branch t07-sites. Use "Files in scope" as the starting scope; follow CLAUDE.md's coordination rules for any additional files or dependencies. When you think you're finished, run every line of "Done when" and show me the output for each.
```
