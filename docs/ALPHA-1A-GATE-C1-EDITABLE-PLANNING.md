# ALPHA-1A Gate C.1 — Editable Planning Workspace

Status: **Implemented and validated**  
Date: 2026-10-03

## Purpose

Gate C.1 introduces the first real player planning aggregate before a PWA is built around one-shot booking commands.

The architectural rule is now explicit:

> **Draft intent is editable application state. Committed wrestling obligations are simulation state.**

A player can therefore prepare and revise future show intent without prematurely creating events, allocating simulation IDs, consuming contract dates, reserving Service Capacity or blocking another promotion from using a wrestler.

## Detailed planning horizon

The first supported planning layer is the detailed horizon:

- current PPW week plus the next five weeks;
- six PPW weeks total;
- show date/day;
- market and venue when selected;
- ticket strategy when selected;
- intended participant pool;
- singles/tag match slots;
- sides;
- intended winner;
- match intent;
- planned length;
- championship designation against a draft match slot.

Strategic (~52-week) and creative (~12–16-week) planning remain part of the locked architecture, but are deliberately not implemented in this slice. Gate C.1 first establishes the editable/versioned state model that those layers can later share.

## Drafts may be incomplete

A draft is not a committed show.

The player may save a show before selecting every logistics/creative field. Missing market, venue, ticket strategy or card entries can remain `null`/empty while work is in progress.

Where data is supplied, obvious structural errors are rejected—for example:

- missing market/venue references;
- venue in the wrong market;
- duplicate participant IDs;
- malformed match sides;
- a wrestler occupying multiple card positions;
- match participants not present in the draft participant pool;
- duplicate draft match IDs;
- championship assigned to the wrong promotion/division;
- duplicate championship/match assignments.

Full commitment feasibility—contract-date ownership, live Service Capacity, conflicting reservations, injury risk, venue occupancy and lock-time execution—is intentionally deferred to the commitment/reservation slice.

## Stable draft identifiers

Draft show and match IDs are application planning identifiers, not simulation entity IDs.

Editing, deleting or reordering a future card therefore does **not** allocate/burn `event-*` or `match-*` IDs. Real deterministic simulation IDs are allocated only when a future commitment becomes actual simulation state.

This avoids draft churn affecting deterministic World identity.

## Optimistic plan versioning

Each promotion has at most one planning workspace with its own `version`.

A planning mutation supplies `expectedPlanVersion`.

- correct version -> edit commits and the plan version increments once;
- stale version -> edit is rejected before mutation;
- idempotent retry -> returns the already committed result without incrementing either World revision or plan version again.

This is deliberately separate from the global World revision. It lets future UIs detect a stale card edit without making unrelated World activity invalidate every open planning screen.

## Ownership and command boundary

Planning commands use the existing Gate B application boundary:

- active World membership required;
- player must actively control the promotion;
- World must be `OPEN` for a new planning mutation;
- commands are idempotent by request ID;
- successful edits increment the application World revision;
- planning state is not placed inside deterministic `WorldState`.

The two initial commands are:

- `UPSERT_DETAILED_SHOW_DRAFT`
- `REMOVE_DETAILED_SHOW_DRAFT`

## Persistence

Planning is now part of `ApplicationWorldAggregate` and `PersistedApplicationWorld`.

An application-state schema boundary is introduced separately from the simulation-state schema. Pre-C.1 application snapshots that have no planning state migrate to an empty `WorldPlanningState` when restored.

The PostgreSQL repository now has a nullable `planning_state jsonb` column added through an additive migration. Existing B.4 database rows with no planning value load as an empty workspace and are upgraded naturally on their next write.

For this stage, JSONB is appropriate because the planning model is small, private mutable current state and still evolving. The repository abstraction remains free to normalize planning records later if querying/contention demands it.

## What drafts do NOT do yet

Gate C.1 deliberately does **not**:

- reserve a wrestler/date;
- consume a contract date;
- reserve Service Capacity;
- reserve a venue;
- create a `WrestlingEvent`;
- create a `Match`;
- create `ScheduledAppearance` rows;
- create live championship booking state;
- guarantee that a future plan remains feasible;
- automatically reconcile plans after injuries/contracts/world resolution;
- replace Routine Continuity behavior for the current locked week.

Those are commitment/reconciliation concerns and belong to subsequent Gate C slices.

## Validation

Scratch validation passed:

- application planning tests: **8/8**;
- application repository tests: **6/6**;
- live PostgreSQL repository tests: **4/4**;
- standard 10-year deterministic hash: **`6a5dcd3b`**;
- invariants: **PASS**.

The promoted Alpha head must also pass the standard 100-year `7662b626` gate before C.1 is considered sealed.

## Next Gate C slice

Gate C.2 should introduce the explicit transition from **draft intent -> committed/reserved detailed plan**.

That slice must define:

- which fields are mandatory to commit;
- wrestler/date reservations;
- contract/date/Service Capacity validation;
- venue/date reservation rules;
- replacement/update/cancel semantics before lock;
- what becomes `AT_RISK` when later World changes threaten a committed plan;
- how current-week committed plans materialize into the existing deterministic human show/card/title execution path.

No strategic/creative narrative depth is required to solve that commitment boundary.
