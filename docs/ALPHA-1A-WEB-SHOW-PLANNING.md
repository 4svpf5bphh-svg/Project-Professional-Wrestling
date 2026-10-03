# ALPHA-1A — Browser Show Planning

This slice turns the Alpha browser from a World viewer/week-resolution harness into the first genuine promotion-management surface.

## Player-facing loop

When a mandatory show is due, the controlled promotion dashboard now exposes a mobile-first show planner. The player chooses:

- PPW day;
- market;
- venue;
- ticket strategy;
- an even show roster within the promotion's event-size limits.

The read model exposes real World markets and venues, venue capacity/hire cost/prestige, the promotion's contracted roster, the current planning workspace version and any current-week reservation.

## Server-authoritative commitment

`POST /api/show-plan` is a real application mutation, not client-only draft state.

The client submits the choices it can make plus the World revision and plan version it observed. The server derives the promotion from player ownership and derives the draft ID/year/week from the current World. The browser cannot nominate another promotion or move the command into another PPW week.

One save is implemented as one database transaction containing two existing application commands:

1. `UPSERT_DETAILED_SHOW_DRAFT`;
2. `RESERVE_DETAILED_SHOW_DRAFT`.

If reservation fails — for example because the venue or wrestler date is unavailable — the draft edit rolls back with it. Successful saves reserve scarce multiplayer resources immediately without creating a simulation event early.

The draft intentionally contains no matches in this slice. At weekly progression, the existing materialization path converts the due reservation into the real show. Until the card-booking slice exists, Routine Continuity remains responsible for the missing card if the player finishes the week.

## Concurrency and retry behaviour

The command requires the observed World revision and planning workspace version. A stale new mutation is rejected.

The browser uses one logical request ID; the server derives stable `:draft` and `:reserve` command IDs. Because both receipts are committed in the same transaction, a retry after a lost response replays the already-committed results without allocating another draft, another reservation or another World revision.

## Validation contract

Before promotion, the slice must pass the complete functional suite, production Next build, live HTTP/PostgreSQL planning flow, repository integration, the unchanged 10-year deterministic hash and the unchanged 100-year deterministic hash. The HTTP path specifically proves that the reserved venue survives materialization into the completed show result.

## Deliberately deferred

This slice does not add:

- manual match/card booking in the browser;
- championship assignment UI;
- multi-week advance booking UI;
- contract-market UI;
- automatic recommendation/optimization of venue, ticket price or talent;
- the final multiplayer deadline scheduler.

The next booking slice can now build on an actual reserved show rather than creating a parallel client-side planning model.
