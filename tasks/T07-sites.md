# T07: Curated site list

Status: in review (draft PR open; Quickmap tick list still to do by a person)

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

- [ ] Every entry has all fields and a working source link.
- [ ] Every longitude is between -180 and 180.
- [ ] Each site, typed into Quickmap, lands on the named feature. Tick list in the pull request.
- [ ] `npm test` still passes (T00 has a test that checks the file's shape).
- [ ] `npm test` and `npm run build` pass.

## Notes

No Claude needed for most of this. It's careful lookup work, and it can start at kickoff in a scratch file: only the final `sites.json` waits for T00 and T20.

Quickmap moved: `quickmap.lroc.asu.edu` now forwards to `quickmap.lroc.im-ldi.com` (seen 14 Nov 2026).

## Prompt to paste into Claude Code

```text
Read CLAUDE.md, docs/data-contract.md and tasks/T07-sites.md. Do only that task, on branch t07-sites. Use "Files in scope" as the starting scope; follow CLAUDE.md's coordination rules for any additional files or dependencies. When you think you're finished, run every line of "Done when" and show me the output for each.
```
