# PPW contract economics and shared-world fairness — paid-week boundary (11 October 2026)

Status: protected draft after validated PR #35, CI #932. No merge, deployment, or player World reset.

## Confirmed discrepancy and correction

Player-authored multiweek recruitment offers (and replacements for exhausted limited-date agreements) previously started in the current PPW week. But accepting or rejecting those offers happens at **World Resolution**, after players have locked that week's shows. Financial settlement then pays an accepted contract's weekly guarantee for that now-unbookable week. A 13-week deal can effectively provide just 12 player-bookable weeks despite charging 13 weekly guarantees.

The Web Talent service now starts NEW human EXCLUSIVE and LIMITED_NON_EXCLUSIVE agreements in **the following PPW week (day 1)** if their calculated start would fall in the locked offer week.

- Future-term renewals continue to start after their currently signed source contract. No shortening, acceleration, or duplicate current-term rights.
- Exhausted limited-date sources are still superseded at acceptance, but the new term's **weekly pay and appearance rights** begin next week.
- A signing bonus is still a genuine signing payment, due when accepted, rather than a weekly wage.
- AI offers remain on their existing server-authoritative resolution path: AI bookers can plan using their newly accepted offers during the same resolution, whereas players cannot change their previously locked card. Each side receives its contracted number of *available* weeks.
- The precise 13/26/52-week term length, purchased-date cap versus exclusive unlimited dates, creative clauses, term expiration, financial distress, and shared service-capacity limits are unchanged.
- Existing signed and already pending historical contracts are not rewritten; fresh World reset remains deferred until the explicitly approved consolidated release.

## Release regressions

1. Both human **LIMITED_NON_EXCLUSIVE** and **EXCLUSIVE** recruitment offers start next PPW day 1 and last their full 13 weeks.
2. No wrestler booking rights are acquired before acceptance. After World Resolution, the accepted wrestler is on the player's first-bookable-week roster.
3. The first settlement **does not charge an unbookable weekly guarantee** for that newly accepted future-start contract; settling the first bookable week charges exactly one guarantee.
4. The signed term allows its full final week's show booking but never extends into an extra following week.
5. Idempotent retries after resolution do not create duplicate contracts or receipts.
6. Existing **future renewal** timing and exhausted replacement retries remain correct; one-off calendar alignment, creative consent and World Lock retain existing regressions.
7. Application suite, Backstage, HTTP/PostgreSQL integration, paired creative multiseed audit and long-running simulations must pass before any release recommendation.

## Economics and multiplayer fairness audit — next bounded work

Observed, **not silently changed in this PR**:

- Exclusive terms give unlimited appearances but player transport and historical equivalents still carry an artificial date count. If a nonzero appearance fee is proposed, estimated weekly compensation may assume a booking cadence that is not guaranteed. Verify pay-on-appearance valuation and guidance; favour simple exclusive salary-based terms for initial usability.
- One-off offer UI recommends no signing bonus, but current command validators permit one. Audit family-specific compensation rules on every server entry point before enforcing a common structure.
- Non-exclusive concurrency is guarded by an average service-density estimate before acceptance, while actual show reservations enforce precise calendar conflicts and weekly capacity. Test overlapping start/end boundaries, staggered offers, fair same-week competing bids and exhausted-date additions before revising this model.
- Multiple promoters' pending offers compete in the same World resolution and use a deterministic utility/capacity pass, but no player should gain extra signing rounds from time online. Preserve World Lock as the only resolution authority.

These items merit targeted regression work rather than arbitrary rebalancing of wrestler market prices midstream.
