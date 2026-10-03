# ALPHA-1A Gate C.2 — Reserved Future Plans

## Status

Gate C.2 introduces the first binding multiplayer planning commitments without prematurely turning advance plans into simulation events.

C.1 established editable detailed show drafts. Those drafts remain cheap, private application intent. C.2 adds an explicit reservation action that claims scarce future resources only when the player chooses to make a commitment.

## Core boundary

PPW now distinguishes:

1. **Draft intent** — editable planning state. It does not consume wrestler availability, contract dates, venue availability or simulation IDs.
2. **Reserved commitment** — application planning state that claims scarce future resources against the shared World.
3. **Materialized show** — future Gate C work. This is when a valid reservation becomes a real `WrestlingEvent`, `ScheduledAppearance` set and eventually a real match card.

A reservation is deliberately **not** a `WrestlingEvent` and does not allocate event, appearance or match IDs.

## Reservation command

A player may reserve a detailed draft only when:

- the player actively controls the promotion;
- the World is OPEN for player mutations;
- the supplied planning version is current;
- the draft is still inside the six-week detailed planning horizon;
- the promotion is scheduled to operate a show in that target PPW week;
- market, venue and ticket strategy are selected;
- the wrestler roster is even, meets the minimum event size, and does not exceed the promotion/event roster target;
- every selected wrestler is currently active;
- every selected wrestler has a signed contract with that promotion covering the target PPW date;
- an unconsumed/unreserved contract date remains;
- wrestler same-day availability and weekly Service Capacity remain available;
- the venue is not already occupied or reserved on that PPW day;
- the promotion does not already have another committed or reserved show in that PPW week.

The reservation records the exact contract date chosen for every wrestler plus the wrestler's Service Capacity snapshot at reservation time.

## Shared-World fairness

Reservations live inside the already transactional World `planning_state` persisted by Gate B.4.

The PostgreSQL repository already locks the World row for mutations. Therefore two players racing for the same scarce venue or wrestler do not independently commit from stale state: one transaction commits first, and the later transaction revalidates against the now-persisted reservation state.

This avoids adding another database table merely to gain concurrency semantics we already possess.

The reservation rules count both:

- existing real `ScheduledAppearance` commitments; and
- other future planning reservations.

Contract entitlement also counts:

- dates already used;
- pending committed scheduled appearances; and
- future reservation claims.

This prevents a limited-date contract from being silently promised more times than was purchased.

## Draft edits after reservation

Editing a draft does **not** silently alter its existing reservation.

That is intentional. Changing a draft is a private planning edit; changing a reservation affects other players and shared scarcity.

To apply revised logistics or participants, the player explicitly reserves the draft again. Re-reserving the same draft atomically excludes its existing reservation during conflict checks, then replaces it with the new commitment.

This means moving a show does not briefly double-book its own resources.

## Release

A reservation may be explicitly released while the World is OPEN.

Release:

- removes the scarce-resource commitment;
- is ownership-authorized;
- is idempotent through the application command envelope;
- does not delete the underlying draft;
- does not mutate the simulation World.

Likewise, deleting/editing a draft does not implicitly cancel a reservation. Shared commitments require an explicit shared-commitment command.

## Persistence compatibility

C.2 extends the existing `planning_state` JSON with `showReservations`.

No new PostgreSQL column or table is required. C.1 snapshots and database rows that predate this field are normalized to `showReservations: []` on restore.

This is an additive, backward-compatible application-state extension rather than a simulation-state schema change.

## What a reservation guarantees — and what it does not

A reservation guarantees that, **at the moment it commits**, PPW has accepted the shared-resource claim against the authoritative World state.

It does not freeze reality.

Before the show reaches materialization, later World developments can invalidate or weaken the plan, including:

- wrestler injury or retirement;
- contract expiry/release/change;
- Service Capacity changes;
- promotion dormancy or operating-cadence changes;
- other lifecycle changes that make the planned show impossible.

Future Gate C materialization/revalidation will classify such plans as at risk and require player/staff handling rather than pretending the reservation can force an impossible historical outcome.

## Deliberately deferred from C.2

C.2 does **not** yet:

- create future `WrestlingEvent` rows;
- create `ScheduledAppearance` rows;
- allocate simulation event/appearance/match IDs;
- materialize match cards;
- consume contract dates;
- charge appearance/event costs;
- resolve championships;
- guarantee a wrestler remains healthy/contracted until the future date;
- introduce storylines, rivalries or longer strategic programmes;
- expose a PWA planning UI.

Those boundaries remain separate so advance planning cannot corrupt deterministic resolution.

## Validation

The final scratch head passed the full functional suite, including seven reservation tests and the C.1 compatibility test. The live PostgreSQL integration also passed reservation transaction/reload coverage, and the 10-year all-AI regression remained at deterministic hash `6a5dcd3b` with invariants PASS.

The exact promoted `alpha-1a` head must additionally pass the standard 100-year `[long]` gate at hash `7662b626` before C.2 is considered sealed.

## Next boundary

The next Gate C slice should be **materialization + at-risk revalidation**:

- identify reservations due in the current PPW week;
- revalidate lifecycle, contract, wrestler, venue and capacity conditions;
- classify valid versus at-risk commitments;
- materialize valid reservations into the existing deterministic human show/card path exactly once;
- preserve Routine Continuity when required work remains unresolved at lock;
- release or roll forward reservation state without leaking stale scarce-resource claims.

That should be implemented before deeper storyline/programme planning or UI work.
