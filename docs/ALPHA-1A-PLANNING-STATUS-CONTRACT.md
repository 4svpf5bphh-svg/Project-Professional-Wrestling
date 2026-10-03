# ALPHA-1A Player Planning Status Contract

This gate defines the application-facing contract for showing a player where an advance show plan stands and which planning mutations are legal at that point. It does not add UI and it does not change simulation outcomes.

## Principle

Planning lifecycle and week readiness are related but not identical.

A show can be `MATERIALIZED` while still needing a card. A show becomes `READY_TO_LOCK` only when the real current-week event has a complete card. `STAFF_OWNED` means the player mutation window has closed and unresolved responsibility belongs to Routine Continuity.

The application therefore exposes both a primary planning state and readiness metadata.

## Primary states

| State | Meaning | Lifecycle-legal player planning actions |
| --- | --- | --- |
| `DRAFT` | Editable intent exists but no scarce resources are committed. | `EDIT_DRAFT`, `DELETE_DRAFT`, `RESERVE` |
| `RESERVED` | Venue/day, wrestlers and contract dates are committed by C.2. | `EDIT_DRAFT`, `REFRESH_RESERVATION`, `RELEASE_RESERVATION` |
| `AT_RISK` | A due reservation failed C.3 revalidation against the living World. | `EDIT_DRAFT`, `REFRESH_RESERVATION`, `RELEASE_RESERVATION` |
| `MATERIALIZED` | The reservation became a real current/past simulation event. Advance-planning mutation is over. | none |
| `READY_TO_LOCK` | The real current-week event exists and its card is complete. | none in advance planning |
| `STAFF_OWNED` | The World has locked with unresolved responsibility for this target week. Player planning mutation is over. | none |

The action list describes lifecycle legality. Resource-specific validation still occurs when the command executes. This is required in a shared World because another committed action can invalidate a previously observed venue, wrestler, Service Capacity or contract date.

## Readiness values

The status projection also reports one of:

- `FUTURE` — target week has not arrived.
- `RESERVATION_DUE` — the reserved show is due this week and can materialize.
- `SHOW_REQUIRED` — the current mandatory show is not yet real in simulation state.
- `CARD_REQUIRED` — the show exists but the current card is incomplete.
- `READY_TO_LOCK` — the current human show and complete card are ready for World lock.
- `NOT_REQUIRED` — the promotion has no mandatory show responsibility for the current week.
- `STAFF_OWNED` — the player mutation window has closed and staff owns unresolved work.
- `PAST` — the draft target week has passed; advance-planning mutation is closed.

## Reservation edit semantics

Editing a `RESERVED` or `AT_RISK` draft changes intent only. It does **not** silently move venue, wrestler or contract-date commitments. The reservation continues to represent the last explicit reserved version until `REFRESH_RESERVATION` succeeds.

`workspaceChangedSinceReservation` is exposed so a client can warn that planning intent has changed since the reservation was made. It deliberately refers to the planning workspace version rather than pretending to be a per-field diff.

A reserved draft cannot be deleted directly. The player must first `RELEASE_RESERVATION`, which frees scarce resources, and can then delete the draft. This prevents orphaned commitments.

## At Risk repair

`AT_RISK` carries the concrete C.3 risk reasons, including unavailable wrestlers, same-day conflicts, Service Capacity exhaustion, unusable/exhausted contracts, invalid venue/market state, venue conflicts and a promotion that can no longer operate the show.

The player may edit intent and explicitly refresh the reservation. Refresh is revalidated atomically against the current World. If repair is impossible or unwanted, the player can release the reservation. If the World locks while the commitment remains unresolved, C.3 releases it and Routine Continuity owns the missing work.

## Materialized and Ready to Lock

Once C.3 materializes a reservation, advance-planning actions stop. The player is no longer editing a future promise; they are dealing with the real current-week show.

If the materialized reservation carried a complete card, normal human-week readiness can expose `READY_TO_LOCK`. If the card was incomplete, the state remains `MATERIALIZED` with `CARD_REQUIRED`.

Current-show card editing is intentionally a separate live-show application boundary. This contract does not invent UI/API commands for it and does not route live card changes back through future-draft storage.

## Staff-Owned

When the World leaves `OPEN`, all new player mutations are already blocked by the runtime authority boundary. For a draft targeting the locked week whose unresolved commitment did not materialize, the planning projection exposes `STAFF_OWNED`.

This does not transfer promotion ownership. It describes responsibility for the locked week's unresolved show/card work under Routine Continuity.

## Authority

`playerShowPlanningStatus(...)` is the canonical application projection for this planning lifecycle. Application planning and reservation commands consult the same contract before mutating state.

This means the UI will not be responsible for inventing its own lifecycle rules. A stale or malicious client still reaches the server command guard and current resource validation.

## Containment

This gate changes application orchestration only:

- adds the planning-status projection and action guard;
- enforces release-before-delete for reserved commitments;
- prevents advance-draft edits after materialization/lock;
- adds focused contract tests;
- exports the contract for the eventual API/PWA.

It does not change match resolution, contracts, economics, championships, injuries, morale, trust, AI booking or all-AI World behavior.

## Explicitly deferred

- UI design and visual treatment for these states.
- Application wrappers for live current-week card editing.
- Planning-history retention/pruning after target weeks pass.
- Rich per-field reservation diffing; Alpha exposes workspace-version drift only.
- The previously documented promotion tier/roster-cap shrink policy for an existing reservation.
