# PPW Creative Control — pre-lock card workflow, wave 3

**Status:** protected draft PR, CI only. No Vercel preview, production deploy, merge or World reset.

This wave builds on the passed match-scoped consent engine (PR #18) and its creative-control contract foundation (PR #17).

## Current behaviour under test
- The Show Card read-model displays each actual contractual concern, including wrestler, exact match, permission reason and approved/declined/pending state. Consultation is non-blocking.
- A show can save a proposed script before consent is requested. Wrestlers consider only server-persisted, fully authored match scripts.
- The pre-lock command verifies authenticated promotion control, expected World revision and plan version, prevents replay-rerolls, and checks a current editable show.
- A due reservation with an unresolved contractual veto becomes `CREATIVE_APPROVAL_REQUIRED` risk rather than silently materializing unapproved matches. This risk is independent of style/fatigue checks.
- An already-materialized show keeps its last committed match card while an amended script is pending consent. When the last relevant wrestler approves, the changed card replaces it in the *same* World transaction. Scripted winner and finish are never rewritten by the AI.
- Declined approval requires a revised authored script or postponement; repeat requests cannot reroll the same booking.
- The UI only presents individual request buttons for pending blocking consents on the saved card. Unsaved changes must be saved first. The user sees when an amendment is held rather than live.

## Important known limits / next validation gates
- Contract creative-control tiers are still NOT player-selectable. Initial World data does not grant these clauses by default.
- Routine Continuity / staff-handled releases at commitment lock need a separate final audit and clear notification wording to prevent a human-only blocker from freezing other players.
- A declined proposal does not auto-convert to another finish or cancel its show. Staff fallback and show history should remain explicit.
- Future roster gimmick/repackaging consent is independent of a match-card approval; no new gimmick-changing control has been exposed here.
- Remaining tests: two real controllers and AI parity; fair handling of multiple unresolved approvals; PostgreSQL persistence and long simulation; finances of creative concessions and final UI usability.
- Never merge or deploy until all gates pass and the user explicitly approves a bundled release plus fresh test World reset.
