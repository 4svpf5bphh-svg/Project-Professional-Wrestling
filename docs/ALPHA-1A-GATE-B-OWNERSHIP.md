# ALPHA-1A Gate B.1 — Player Membership and Promotion Ownership

Status: **Complete**

This slice introduces first-class application ownership without embedding account identity into deterministic simulation state.

## Ownership boundary

`WorldState` still knows only whether a promotion is controlled by `AI` or `HUMAN` for simulation-policy purposes.

The new application layer owns player identity through:

- `WorldMembership`
- `PromotionControl`
- `WorldOwnershipState`

Player/account IDs therefore remain outside deterministic wrestling state and outside the World Ledger.

## World membership

A player must be an active member of a World before they can acquire promotion control.

Membership records include:

- World ID;
- player ID;
- joined PPW date;
- active/left status.

Cross-World ownership records cannot authorize mutations in another World.

## Promotion control

An active `PromotionControl` records:

- World ID;
- promotion ID;
- player ID;
- control start PPW date;
- optional end PPW date;
- active/ended status.

The application layer enforces:

- one active promotion per player per World;
- one active human controller per promotion;
- active World membership before control is granted.

These are application ownership rules rather than wrestling simulation rules.

## Human seat capacity

The temporary ALPHA-1A rule "only one human promotion exists in a World" has been removed from `sim-core`.

`WorldOwnershipState.humanSeatLimit` now owns that policy.

For ALPHA-1A the limit is `1`.

A World configured with a limit of `2` can already grant two different players control of two different Independent promotions without any change to the simulator. This is the structural bridge to ALPHA-1B.

## Simulation responsibility

`claimIndependentPromotionForHuman()` remains a low-level simulation operation. It validates only simulation eligibility:

- the promotion exists;
- it is currently AI-controlled;
- it is an active Independent promotion;
- any requested promotion name is valid and unique.

It no longer decides how many human players the World supports or whether one account already owns another company.

The application command `claimIndependentPromotionForPlayer()` performs membership/ownership/seat authorization first and then invokes the simulation operation.

## Regression contract

Validation requires:

- the complete functional suite;
- application ownership tests proving membership, one-player/one-promotion, one-controller-per-promotion, seat capacity and World isolation;
- the standard 10-year hash `6a5dcd3b`;
- the standard 100-year hash `7662b626`;
- zero invariant failures.

## Gate B status

Completed:

1. first-class World membership and promotion ownership;
2. configurable human-seat capacity outside sim-core.

Remaining Gate B work:

- application command envelope and idempotency;
- World runtime phase/revision and command authorization;
- transactional/repository persistence of ownership and commands;
- replacement of direct player-facing sim calls with authorized application commands.
