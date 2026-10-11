# PPW 26-week indie onboarding — active owner, genuine negotiations
**11 October 2026 · Protected draft stacked on PR #41 / successful CI #941**

## Inherited roster baseline (PR #41)

- Two isolated real-roster Alpha Worlds, same seeds used here, each retained 26 canonical weeks and no invariant errors.
- Both Indies authored 7 required shows, then ran out of bookable inherited contract dates from week 15. Six staff continuity takeovers per company followed. Financially, Frontier Pro lost $819,315; Heritage Alliance gained $116,102.
- This is **not** a player fail state: staff properly protects World continuity when the player misses a show, but it is a poor substitute for an engaged promoter keeping their own show running.

## Follow-on experiment — 26 player-owned weeks with actual offers

Run `npm run build && npm run audit:human-indie-engaged` to produce `artifacts/human-indie-engaged-26week-audit.json`. Compare against baseline PR #41 on **identical seeds, takeover choices and ticket policies**, with all surrounding AI promotion behaviour still operating in the same shared World.

- Every week uses authenticated **Alpha player ownership, current show reservation, scripted Web Card saving and the server World Lock**.
- The deliberate player strategy books a maximum of six active, same-division wrestlers per regular card rather than spending ten dates per show. Uses the real roster's existing purchased dates, with genuine appearance fees and match booking.
- At PPW weeks 5, 8, 11, 14, 17, 20 and 23, the owner considers up to four **same-contract date addenda**, only for active LIMITED_NON_EXCLUSIVE agreements with at most four usable dates remaining and a server-validated capacity window. Pays a competitive **1.8× market weekly value per additional date upfront** if accepted, on top of the existing appearance fee.
- At PPW weeks 8, 11, 14, 17 and 20, the owner can recruit up to two new non-exclusive workers per round, at most eight new offers total. Candidates must be active, have player-visible interest, belong to the chosen card division and pass a conservative full-contract cash-exposure filter. Contract terms: 13 weeks, five paid dates, 25% weekly market guarantee, 120% market appearance fee, a two-week-value signing bonus. The offer always goes through the actual talent service and the normal server's utility + availability decision.
- Offer submissions and later actual **ACCEPTED / REJECTED** statuses are logged separately, including rejected terms; no direct signed-contract edits, free dates, salary write-offs, forced signings or cash injections.
- Actual offer wages/bonus, retained cash, produced events, cancelled events, staff rescue, card failures and any lock blockers are retained for both Worlds.

## Interpretation / limits

This is a **controlled gameplay-policy experiment**, not a guarantee that these particular offers will be accepted. The recruited wrestlers' willingness and AI competitor offers remain server-authoritative. The strategy is deliberately one plausible novice owner policy, not an optimisation oracle.

An imperfect result is useful: e.g. if dates addenda can't be accepted before inherited terms expire, a healthy market may still be unusable for a player; if signing bonuses erode runway, we need to improve affordances rather than hand out extra money.

The one-show-per-week legacy current-week editor cannot necessarily author **both** a flagship and special premium occurrence in the same PPW week. Record this as a separate client workflow limitation, not a contractual failure. No game balancing or system changes here; establish evidence for the next targeted wave.

### Four dependency checks

This audit depends on the existing Web Talent and Card services, signed contract obligations, player World Lock and shared rival market. Player onboarding, recruitment guidance, renewal UX and indie economy depend on it. All money/contract decisions are authoritative World state; the test's strategy and diagnostic output are outside production simulation. Smallest complete version: test two existing seeded player-owned Indies with real negotiations and report outcomes versus an unchanged baseline.

**No merge, preview, deployment or World reset without explicit authorisation.**