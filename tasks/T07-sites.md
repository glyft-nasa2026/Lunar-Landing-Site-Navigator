# T07: Curated site list

Status: not started

| | |
|---|---|
| Owner | P4 |
| Tier | must |
| Waits for | T00 |
| Branch | `t07-sites` |

## Goal

15-20 real sites in the contract's format, each with a source link.

## Files you own

- `web/public/data/sites.json` (replaces the mock)
- `docs/ai-use/T07.md`, `docs/sources/T07.md`, this file's `Status:` line

## Steps

1. Three groups: Apollo landings (6), recent landers from several countries and companies, south-pole candidates (Shackleton rim, Malapert, Nobile, Mons Mouton, Artemis candidate regions).
2. Take every coordinate from an official or published source and paste the link in `source`. **Don't accept coordinates from an AI's memory.**
3. Convert every longitude to east-positive, -180 to 180. A source that says "W" or uses 0-360 needs converting.
4. At least 6 sites south of 85 S, since that's where real terrain applies.

## Done when

- [ ] Every entry has all fields and a working source link.
- [ ] Every longitude is between -180 and 180.
- [ ] Each site, typed into Quickmap, lands on the named feature. Tick list in the pull request.
- [ ] `npm test` still passes (T00 has a test that checks the file's shape).
- [ ] `npm test` and `npm run build` pass.

## Notes

No Claude needed for most of this. It's careful lookup work.

## Prompt to paste into Claude Code

```text
Read CLAUDE.md, docs/data-contract.md and tasks/T07-sites.md. Do only that task, on branch t07-sites. Edit only the files it lists under "Files you own". If the task needs a change anywhere else, or a new package, stop and tell me. When you think you're finished, run every line of "Done when" and show me the output for each.
```
