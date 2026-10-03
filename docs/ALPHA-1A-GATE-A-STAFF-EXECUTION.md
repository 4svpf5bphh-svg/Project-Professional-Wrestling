# ALPHA-1A Gate A — Staff Execution Without Ownership Transfer

Status: implemented and validation-gated before API/PWA work.

## Why this exists

Routine Continuity originally proved staff takeover by temporarily changing a human promotion's `controllerType` to `AI`, running the existing AI event/card pipeline, then changing it back to `HUMAN`. That preserved final ownership state, but it blurred two different concepts that a hosted multiplayer game must keep separate: who owns/controls a promotion, and who is authorized to execute a specific unresolved responsibility for one locked week.

## Current contract

Promotion ownership remains stable. A human-controlled promotion stays `HUMAN` while Routine Continuity executes delegated work.

The event layer now accepts explicit execution authority:

- `staffMayPlanShowFor` allows staff to plan a missing mandatory show for a named promotion.
- `staffMayBookCardFor` allows staff to create a missing card for a named promotion.
- normal AI promotions continue to plan and book through the existing default AI path;
- human promotions do not enter those paths unless the current week explicitly grants the relevant staff authority;
- a player-prepared human card remains authoritative and is not replaced by staff.

Routine Continuity still decides *when* takeover is required. The event/match layers now decide *what delegated staff work is permitted* without reclassifying the promotion's controller.

## Behavior preserved

- Fully prepared mandatory show: runs normally with no takeover.
- Player prepared show but omitted card: staff books only the card; player venue, market, ticket strategy and roster remain intact.
- Missing mandatory show: staff plans the show and card so real-life absence does not simply cancel the promotion's week.
- Off-cadence week: no takeover.

This slice intentionally does not add long-term absence penalties, steward ownership, player accounts, permissions or multiplayer command authorization. It only establishes the correct ownership/execution boundary those later systems can rely on.

## Direct ownership proof

Routine Continuity tests now call the staff show-planning and card-booking paths directly while the promotion is `HUMAN`. They verify that delegated work succeeds and that `controllerType` remains `HUMAN` across the execution boundary, rather than merely being restored afterward.

## Acceptance criteria

This slice is accepted only if:

- the complete functional suite passes;
- all existing Routine Continuity outcomes remain intact;
- explicit staff planning and card execution work for human promotions without controller mutation;
- ordinary AI planning still does not operate a human promotion without explicit authority;
- the standard 10-PPW-Year hash remains `6a5dcd3b`;
- the standard 100-PPW-Year hash remains `7662b626`;
- both long simulations pass invariants.
