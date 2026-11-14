# Task coordination

| Tool | What it generated | Human check |
|---|---|---|
| Codex, using the doc-audit skill | Replaced fixed person assignments with open task claims and coordinated file scope across the rules, board, task prompts and related guides; recorded the previous policy in history.md | Yi Hung supplied the policy change and authorised pushing, resolving the documentation conflicts and merging it. No separate human check results were recorded |

Validation by Codex before integration with current `main`: all 31 task statuses, tiers, prerequisites and branch names are preserved;
the board retains every task; relative links resolve and no new table or code-fence errors
were introduced. `git diff --check` passed. `npm test`: 17 files, 304 tests passed.
`npm run build` passed, with the existing Plotly mixed-import warning. Changes are Markdown only.

Integration update: resolved the three documentation conflicts using the agreed policy, kept
both decision entries and T29's map scope and T31 dependency, and applied the policy to T31.
All 32 task statuses, tiers, prerequisites and branch names match incoming `main`. The 44 changed
documents pass the link, conflict-marker and formatting checks; application code and data match
incoming `main` exactly. `npm test`: 19 files, 334 tests passed. `npm run build` passed, with the
same Plotly mixed-import warning.
