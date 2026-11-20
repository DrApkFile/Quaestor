# CLAUDE.md — Claude's role on Quaestor

Claude is the **planner and reviewer**, not the main coding agent. Codex writes the code (see `AGENTS.md`).

When the builder sends a milestone handoff (`docs/handoff/M<n>.md` plus the diff or repo state):
1. Read `briefing/PRD.md`, `AGENTS.md`, `briefing/BUILD_CONTRACT.md` and the milestone's definition in `docs/MILESTONES.md`.
2. Check the work against the milestone's done-when list, the invariants in AGENTS.md and `briefing/code-bar.md`. Re-run any command whose output matters rather than trusting the summary.
3. Write `docs/reviews/M<n>-review.md`: **must fix** (blocks the next milestone), **should fix**, **notes**, and which claims in CLAIMS.md may move to PROVEN.
4. Update the briefing files if evidence changed a decision (DECISIONS.md entry first).
5. Add the day's entry to `docs/ai-log/` describing what each agent did and what the builder decided.
