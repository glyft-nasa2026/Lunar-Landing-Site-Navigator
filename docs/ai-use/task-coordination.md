# Task coordination

| Tool | What it generated | Human check |
|---|---|---|
| Codex, using the doc-audit skill | Replaced fixed person assignments with open task claims and coordinated file scope across the rules, board, task prompts and related guides; recorded the previous policy in history.md | Yi Hung supplied the policy change and authorised pushing and merging it. No separate human check results were recorded |

Validation by Codex: all 31 task statuses, tiers, prerequisites and branch names are preserved;
the board retains every task; relative links resolve and no new table or code-fence errors
were introduced. `git diff --check` passed. `npm test`: 17 files, 304 tests passed.
`npm run build` passed, with the existing Plotly mixed-import warning. Changes are Markdown only.
