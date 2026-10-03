# ALPHA-1A Gate C.3 — Reservation Materialization

## Status

Gate C.3 closes the first complete advance-planning lifecycle:

**Draft → Reserved Commitment → Revalidation → Materialized Show → Normal World Resolution**

C.1 created editable detailed show drafts. C.2 allowed a player to turn a draft into a shared reservation that claims scarce future resources. C.3 now decides what happens when that reserved PPW week arrives.

The core rule is that reservations do not overwrite reality. A reservation is revalidated against the authoritative World before it becomes a real show.

## Reservation states

A reservation assessment can be:

- **NOT_DUE** — its target PPW week is still in the future;
- **READY** — it is due now and all required reserved resources still exist;
- **AT_RISK** — it is due now, but one or more required conditions no longer hold;
- **EXPIRED** — its target week has already passed without materialization.

`AT_RISK` is dynamic application state rather than a new permanent simulation entity. If the World changes again before lock and the problem is repaired, the same reservation can become READY and materialize normally.

## Revalidation

For a current-week reservation, PPW rechecks:

- the promotion still exists and remains human-controlled;
- the promotion is still operating a show in the target PPW week;
- the promotion has not already committed another show that week;
- the market and venue are still valid;
- the reserved venue is still available on the reserved PPW day;
- every reserved wrestler is still active/available;
- no reserved wrestler has acquired a conflicting same-day booking;
- every wrestler still has weekly Service Capacity;
- the exact reserved contract still belongs to the wrestler and promotion and still covers the target date;
- the exact reserved contract still has an unconsumed date after real appearances and other reservations are counted.

Risk reasons are explicit, including wrestler unavailability, same-day conflicts, Service Capacity exhaustion, contract loss/exhaustion, venue conflict, promotion lifecycle failure and duplicate-show conflict.

## Exactly-once materialization

A READY reservation becomes a real current-week human show by calling the existing deterministic human show path.

Materialization creates:

- a real `WrestlingEvent`;
- real `ScheduledAppearance` rows;
- normal simulation entity IDs only at this point;
- a `PLANNED_SHOW_MATERIALIZED` audit ledger event.

The reservation is removed from the scarce-resource reservation pool only after the show has been created successfully.

The created appearances are then pinned to the exact contracts reserved in C.2. This matters when a wrestler has more than one compatible contract: the future reservation owns the specific purchased date it originally claimed rather than silently switching contracts at materialization.

Once materialized, a retry sees no active reservation and cannot create a duplicate show. The persisted materialization transaction therefore behaves exactly once under normal idempotent/retry conditions.

## Card materialization

Advance card intent is allowed to remain more flexible than show logistics.

The card materializes automatically only when the latest source draft is complete and still matches the reserved wrestler set:

- every reserved wrestler is used exactly once;
- no unreserved wrestler appears;
- match sides remain legal for singles/tag matches;
- every match has an intended winner;
- every match has a booking intent;
- every match has a planned length.

When those conditions hold, C.3 uses the existing human booking command so match order, participants, sides, intended winners, intent and planned length become the real scheduled card.

If the card is incomplete or the draft participant set no longer matches the reservation, the **show still materializes**. The card remains unresolved and normal human week readiness becomes `CARD_REQUIRED`.

This preserves the C.2 boundary: editing a draft never silently changes a shared wrestler reservation.

## Championships

Championship assignments are not scarce-resource reservations.

If a complete card contains a draft championship designation, materialization attempts to apply it through the existing human championship command.

A still-valid title assignment becomes real title intent. If the championship landscape changed in the meantime and the assignment is no longer legal, the show and card are not destroyed. C.3 returns a championship warning and leaves the title designation unapplied.

That keeps optional championship intent subordinate to the more important show/resource commitment.

## At Risk during the open week

An AT_RISK reservation remains present while the World is OPEN.

C.3 does not partially create an event and does not silently substitute another wrestler, contract or venue. The player/application layer can inspect the explicit risk reasons and repair the plan by changing World circumstances or deliberately releasing/re-reserving through the existing planning commands.

This is the first architecture point that supports a future mobile UI showing a reserved show as healthy or at risk without inventing a separate simulation state.

## Lock-time closure and Routine Continuity

At World lock, C.3 performs one final reservation pass.

- reservations that have become READY materialize;
- current-week reservations still AT_RISK are released;
- their release is recorded as `PLANNED_SHOW_RESERVATION_RELEASED_AT_LOCK` with the risk reasons;
- stale past reservations are cleaned as `PLANNED_SHOW_RESERVATION_EXPIRED`.

After that, the existing Routine Continuity system remains authoritative for unresolved mandatory work.

Therefore:

- materialized show + complete card → runs as prepared;
- materialized show + incomplete card → staff can take over the missing card at lock;
- at-risk show that never became viable → reservation releases, leaving SHOW_REQUIRED, so staff can run the mandatory show rather than cancelling the company because the player was absent.

C.3 does not create a parallel staff-booking engine.

## Week transition integration

There are two materialization entry points.

### Open-week materialization

`materializePersistedCurrentWeekReservations` allows the application/server to materialize reservations that are already due in the currently OPEN week. If the pass creates or expires authoritative World state, the World revision advances once. A no-op/AT_RISK-only pass does not revise the World.

### Weekly resolution transition

When the locked World resolves and advances into a new PPW week, reservations newly due in that week are materialized inside the same durable weekly transaction after the World reopens.

That means a reservation made several PPW weeks in advance naturally enters the real show pipeline when its target week becomes current, without relying on a client being online at the transition moment.

## Transaction and rollback safety

Materialization happens inside the existing repository transaction boundary for persisted Worlds.

If a late validation condition not yet represented by an explicit risk code causes the underlying human show command to reject, the transaction rolls back rather than leaving half-created events or appearances.

One deliberately retained edge is promotion tier/roster-cap shrink between reservation and materialization. The current explicit risk model does not yet choose a policy for automatically trimming, grandfathering or rejecting oversized previously-reserved cards. The authoritative transaction therefore rejects/rolls back rather than silently changing the player's reserved roster. A later planning-policy slice should make that specific product decision before UI exposure.

This is a safe guard, not a claim that every possible future invalidation is already surfaced as an AT_RISK reason.

## Persistence

No new database schema is required for C.3.

Reservations remain in the C.2 `planning_state` JSONB until materialization/release. Once materialized, the real event/appearance/match/title state is persisted through the existing World snapshot and the reservation disappears from planning state in the same transaction.

Live PostgreSQL coverage verifies that a due reservation is atomically replaced by the materialized show, appearances, ledger record and revised World state, and that retrying the materialization pass does not duplicate it.

## Deliberately deferred

Gate C.3 does **not** add:

- storyline/rivalry/programme planning;
- automatic long-range booking generation;
- PWA screens;
- sophisticated reservation priority or wait-list systems;
- automatic wrestler/venue substitution for AT_RISK plans;
- automatic roster trimming after promotion tier changes;
- configurable staff booking preferences;
- multi-show-per-week human operating models;
- a permanent AT_RISK database column.

Those should be designed on top of this lifecycle rather than mixed into materialization.

## Validation

The C.3 scratch head must pass:

- the complete existing functional suite;
- six dedicated materialization/AT_RISK tests;
- existing PostgreSQL repository tests;
- existing PostgreSQL reservation tests;
- a live PostgreSQL materialization/reload/exactly-once test;
- 10-year standard-seed hash `6a5dcd3b` with invariants PASS;
- 100-year standard-seed hash `7662b626` with invariants PASS on the promoted `[long]` head.

C.3 changes application orchestration only. No sim-core gameplay implementation file is modified, so the all-AI deterministic World should remain exactly unchanged.

## Gate C position

- **C.1 — Editable detailed planning:** complete
- **C.2 — Shared scarce-resource reservations:** complete
- **C.3 — Revalidation + exactly-once materialization:** complete once promoted validation passes

The next planning work should not automatically expand into storylines or UI. The next bounded slice should first decide the player-facing planning/status contract that sits on top of these three layers: what the application exposes as draft, reserved, at-risk, materialized, ready-to-lock and staff-owned work, and which repair actions are legal in each state.
