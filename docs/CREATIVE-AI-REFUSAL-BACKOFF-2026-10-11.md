# PPW — autonomous creative refusal memory (11 October 2026)

CI-only development wave following PR #29's paired seven-seed audit. **No merge, deployment, preview, or World reset.**

## Measured root cause

The first 14 World / 728-week audit was invariant-clean but revealed seed 91306 of the real-roster cohort had **42 AUTONOMATED_CREATIVE_MATCH_DECLINED entries from one contract** (Gabe Kidd in NJPW, score 49–51) between World Week 14 and 52. It completed 31 fewer matches than its paired control. This was not a general creative-rights overgrant: of 5,792 policy AI offers, only 25 gave FULL_APPROVAL, and 380 gave PROTECTED_FINISHES.

The AI appearance selector kept spending a roster slot on a wrestler whose full-approval objection the match author would predictably reject a few steps later. Repeating that request every broadcast neither respected the recorded decision nor generated worthwhile wrestling politics.

## Bounded solution

- In the normal AI/staff appearance planner, inspect **persisted World ledger** evidence of an actual declined autonomous match for the same promotion, wrestler, **and signed creative contract**.
- Avoid reserving that wrestler while refusal is still active, selecting qualified alternative talent from the existing roster instead. Other matches/participants remain subject to normal booking rules, no winner is rewritten.
- A **12-PPW-week cooling interval** automatically expires the refusal; a meaningful rise in the **same contractual approval score to passing level** restores eligibility immediately. A new signed contract also resets the specific previous refusal memory.
- No separate process cache or online/offline power. Resolution is deterministic, persists across World reloads/locks, and uses bounded recent ledger history rather than a full historical scan. This is a planner-layer change: the underlying wrestler's approval and the actual-match engine veto remain intact.
- No change to manually authored cards; no simulation-generated match consent on the player's behalf.

## Safety checks

Regression covers actual AI refusal followed by a new weekly show, an alternative roster selection, absence of duplicate weekly rejections, restoration after willingness changes, and World invariant validation. The independent full multi-seed counterfactual audit remains in GitHub CI. Review aggregate/seed deltas before exposing contract rights to players.

Four dependency questions:
1. Depends on shared creative-contract score, authoritative offer history and deterministic automatic event planning.
2. Later supports meaningful Backstage disputes, roster management for AI promotions, term renegotiations and stable player-facing creative economics.
3. Ledger evidence is simulation state; notifications and human-readable contract guidance are presentation.
4. Smallest complete first version is a bounded cooldown of the one known repetitive issue, not a sweeping overhaul of wrestler acceptance.
