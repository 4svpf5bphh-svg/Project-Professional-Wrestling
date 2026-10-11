# PPW contract final-week show rights audit — 11 October 2026

Status: protected development branch; stack after the validated show-calendar PR #34. No preview, merge, deployment or playable World reset.

## Confirmed contract-date discrepancy

Most multiweek AI/generated and existing signed contracts store an end date on **day 1 of the final PPW week**, because the simulation fundamentally uses weekly ticks. The player's roster and contract expiry process treat the term as covering that whole PPW week. However, scarce-resource reservations and materialization compared exact calendar days, so a day-5/day-6 show could become unbookable inside that same final week. This also affected persisted legacy agreements.

## Narrow fix

- Add a single shared simulation predicate for whether a **signed** contract covers a particular show date.
- Preserve the precise start date, including deliberately midweek starts; treat the last PPW week as inclusive through day 7.
- Use the same predicate for scarce-resource reservation and materialization rechecks.
- Keep the signed end date, term length, dates bought, exclusive appearance rights, expiry schedule, billing, renewal rules and World history **unchanged**. Do not migrate or rewrite saves.
- The rule is shared by player-controlled and AI-origin signed contracts used in player show planning. It does not grant extra appearances or bypass other promotions' reservations.

## Regression gates

1. Across the PPW year boundary, an existing contract ending Year 2 Week 1 Day 1 can be booked on Year 2 Week 1 Day 7, but not Week 2 Day 1.
2. Future midweek start remains binding; unsigned/expired contracts remain invalid.
3. A player with an unchanged legacy end-day-1 contract can reserve a day-6 final-week show, without changing the end date.
4. Materialization revalidates the exact same show as READY and commits the scheduled appearance.
5. All historical determinism, World invariants, multiplayer venue/talent conflict, human/AI parity, HTTP/PostgreSQL and long-running CI checks remain gating.

This is a **weekly contract semantics** consistency correction, not new contractual power. Full user-authorised reset is still deferred to the bundled release.
