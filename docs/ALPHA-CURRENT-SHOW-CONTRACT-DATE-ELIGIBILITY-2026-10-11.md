# PPW current-show roster — expired SIGNED date mismatch
**11 October 2026 · Protected draft PR #43 stacked on green PR #42 / CI #944.**
No merge, deployment, preview or saved World reset.

## Reproduced cause, not a speculative booking-rule change

The real 26-week player-owned indie experiment attempted to reserve the regular show in PPW **Year 1, Week 25, Day 6**. Its **Alpha current-show roster** was built from all contracts whose storage status remained `SIGNED`, showing `dateEntitlement - datesUsed` without checking whether the signed agreement covered the current show. The authoritative reservation engine correctly checks both status and the **actual contracted week/day** before accepting it.

Exact read-only CI #945 diagnosis:

| World | Rejected wrestler | Signed contract window | Purchased dates / used | Target |
|---|---|---|---|---|
| 94271 Frontier Pro | Elijah Blum | Y1 W12 D1 – Y1 W24 D1 | 7 / 3 | Y1 W25 D6 |
| 94272 Heritage Alliance | Blake Howard | Y1 W12 D1 – Y1 W24 D1 | 9 / 4 | Y1 W25 D6 |

Both contracts were still marked `SIGNED` for bookkeeping, but neither covered **Week 25**. No pending show reservations or committed appearance conflicts were present for either wrestler. The annual/premium show fell in the same week, but **was not the reason these two particular bookings failed**. Those contracts simply had ended one week earlier.

The game already uses `contractCoversBookedDate` as canonical reservation/creative window check, with exact start day, **all seven days of the final PPW week**, and no following-week rights. The current-show roster now uses the **same** window when selecting bookable talent. Raw signed contract records remain untouched; signed historical or future terms are not silently rewritten.

## Regression coverage / limits

- A historically signed limited contract ending in Week 7 but still carrying unused purchased appearances does **not** appear bookable in Week 8.
- A signed future-starting deal beginning Week 9 does not appear available for a Week 8 show.
- A deal ending on **Week 8, Day 1** remains available for the same Week's **Day 6** event, preserving the fix from PR #35.
- Re-run the *unmodified* 26-week player-owned engagements from PR #42 with the actual Alpha service and World Lock. The week-25 false eligibility should disappear. It remains possible that the available current roster is insufficient or a real competing booking exhausts capacity; this audit must report these honestly.
- No free contract days, no forced addendum acceptance, no automatic staff override, no alteration to exclusive wages, talent market, real-world promotion assignment, contract expiration engine or ledger timing.

**Scope boundary:** The full six-week Planner and private Talent directory already have separate data projections. Their prospective day-specific commitments, and completing *both* the flagship and premium show in the same week, warrant dedicated follow-up audits. This PR fixes the confirmed **legacy Alpha current-show picker** discrepancy, not all potential booking conflicts.

## Architecture dependencies

Depends on canonical day/week contract validity; future show authoring, screen hints and roster liquidity depend on trustworthy bookability projections. Signed contract status, money and World Resolution remain simulation state; current-show roster filtering is presentation only. Smallest complete implementation: reuse server booking-window predicate in current-show roster, plus dated regression and full CI.
