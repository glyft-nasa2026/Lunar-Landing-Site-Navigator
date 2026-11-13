# T17: Slides, demo video, submission text

Status: not started

| | |
|---|---|
| Owner | P4 |
| Tier | must |
| Waits for | M1 for screenshots, M2 for the video |
| Branch | `t17-pitch` |

## Goal

Everything the submission form asks for, ready before the freeze ends.

## Files you own

- `pitch/`
- `docs/ai-use/T17.md`, `docs/sources/T17.md`, this file's `Status:` line

## Steps

1. Read the submission form on day one and list every field and its limit in `pitch/checklist.md`. The demo limit decides the whole plan (search results on 14 Nov 2026 said a video of 30 seconds or less, or at most 7 slides; confirm it on the form itself).
2. Story in order: the problem (a slipped launch date, an hour across three tools) -> our answer (two scenarios compared in seconds) -> the 1 km nudge -> the Horizons check -> who it's for.
3. Demo video script built around one moment: move the pin 1 km, the sunlight collapses.
4. The AI-use paragraph and the source list, collected from `docs/ai-use/` and `docs/sources/`.

## Done when

- [ ] Every field in `pitch/checklist.md` has its text or file.
- [ ] The video runs within the form's time limit and shows compare, nudge and the Horizons badge.
- [ ] Someone outside the team can say what the tool does after watching it once.
- [ ] Slides use the palette in `docs/design.md`; ask P5 for the two site screenshots.
- [ ] Last check before submitting, after the last pull request has merged: every file in `docs/sources/` and `docs/ai-use/` on `main` is covered by the submission's source list and AI-use paragraph, and by the About panel on the deployed site. If the panel is missing one, ask P5 for one more T16 delivery and check again.

## Prompt to paste into Claude Code

```text
Read CLAUDE.md, docs/data-contract.md and tasks/T17-pitch.md. Do only that task, on branch t17-pitch. Edit only the files it lists under "Files you own". If the task needs a change anywhere else, or a new package, stop and tell me. When you think you're finished, run every line of "Done when" and show me the output for each.
```
