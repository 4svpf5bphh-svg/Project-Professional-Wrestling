# Live Arrivals — private Results integrity (2026-10-13)

Development-only follow-up to draft #63. No merge, release, deployment, migration, World reset or real player data alteration.

## Why this exists

When an earlier actual or committed on-screen appearance invalidates a later scripted DEBUT or RETURN, the authoritative final-lock transaction records a `PLANNED_LIVE_ARRIVAL_CANCELLED_AT_LOCK` ledger entry. Resolution deliberately skips that one impossible segment. Without a Results notice, the promoter would see their match card complete while their authored arrival seemingly vanished.

## Presentation rules

- In **My promotion** Results, show an **Unperformed live arrival** note with the subject, promoter-authored type, and exact historical conflict. Keep multiple notices distinct and deduplicate repeated ledger records by source segment identity.
- Do **not** count that unperformed angle as a successfully performed segment, create audience response or invent a substitute intro/return.
- A completed card still retains all real matches and other real segments; the cancellation is a separate show note, not an extra on-screen slot.
- Do **not** include this internal booking cancellation in public **World Results** or another promotion owner's private Show Results.
- Project only frozen ledger evidence for historical shows, not mutable present-day wrestler history.

## Verification

Regressions in `tests/run-application-results-view-tests.ts` cover privacy, original kind/reason, duplicate cancellation evidence, preserved completed match results and unperformed segment counts.

The parent draft #63 passed PPW SIM CI #1010. This Results patch requires its **own fresh CI** before it can be considered verified. The PR is stacked on #63; it may be temporarily targeted at main solely to trigger existing CI and returned to #63 immediately after the check. Production and the current test World remain untouched.

## After this slice

Return to Contract Desk draft #52 once integration is verified, and address the already-planned full show Results visual overhaul separately. The visual overhaul should enhance actual live moments and meaningful consequences rather than dressing cancellations up as successful performances.
