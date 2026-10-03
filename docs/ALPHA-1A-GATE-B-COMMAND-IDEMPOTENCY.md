# ALPHA-1A Gate B.2 — Application Command Envelope and Idempotency

Status: **Complete**

This slice introduces the retry-safe application command boundary that player-facing APIs will use before they are allowed to mutate PPW World state.

## Command envelope

Every application mutation now has a command envelope containing:

- `requestId` — client-generated idempotency identity;
- `worldId` — target World;
- `playerId` — acting player identity supplied to the application layer;
- `commandType` — explicit application use case;
- `payload` — command-specific input.

The envelope remains outside deterministic `WorldState`.

## Command receipts

`WorldCommandState` stores committed application command receipts outside simulation state.

A receipt records:

- World ID;
- request ID;
- player ID;
- command type;
- canonicalized payload;
- serialized committed result;
- committed PPW date.

The exact canonical payload is retained instead of relying on a short non-cryptographic digest, avoiding accidental idempotency collisions.

## Retry behavior

If a request is retried with the same:

- request ID;
- World;
- player;
- command type;
- semantic payload;

PPW returns the originally committed result without invoking the simulation mutation again.

Object key order does not affect payload identity.

This has been proven with real mutations:

- promotion claiming does not create a second `PromotionControl` or second claim Ledger entry;
- contract-offer retry returns the original offer ID without creating another offer, consuming another entity ID or adding another Ledger event.

## Conflicting request reuse

A committed request ID cannot later be reused with a different:

- player;
- command type;
- payload.

Such reuse is rejected before the underlying mutation runs.

Request IDs are currently scoped to one `WorldCommandState`; cross-World command state is rejected explicitly.

## Failed commands

Only successful committed commands create receipts.

A failed authorization/validation attempt therefore does not permanently consume the request ID. If the underlying condition is corrected, the same request can be retried normally.

The eventual database transaction boundary must atomically commit World/application mutation plus the receipt. This slice defines the semantics only; transactional persistence belongs to Gate B.4.

## First player-facing commands behind the boundary

The application layer now provides retry-safe wrappers for:

- `CLAIM_INDEPENDENT_PROMOTION`;
- `SUBMIT_CONTRACT_OFFER`.

The contract command also proves application ownership authorization: the player must be an active World member and must control the promotion named in the contract payload.

More human actions will move behind this command boundary in later Gate B work rather than exposing sim-core directly to an HTTP client.

## Separation from authentication and runtime locking

This slice does not yet implement session authentication, World `OPEN/LOCKING/RESOLVING` phases, optimistic revision checks or relational persistence.

Those remain separate Gate B responsibilities so idempotency semantics can be validated independently.

## Regression contract

Validation requires:

- complete functional suite;
- retry-safe promotion claim;
- request-ID conflict rejection;
- failed-command retry semantics;
- retry-safe contract offer;
- ownership authorization on contract commands;
- standard 10-year hash `6a5dcd3b`;
- standard 100-year hash `7662b626`;
- zero invariant failures.

## Gate B status

Completed:

1. first-class World membership and promotion ownership;
2. configurable human-seat capacity outside sim-core;
3. application command envelope and idempotency semantics.

Remaining:

- World runtime phase/revision and full command authorization;
- transactional/repository persistence of ownership, command receipts and World state;
- migration of remaining player-facing sim operations behind authorized commands.
