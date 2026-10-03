# ALPHA-1A Gate A — Persistent Entity ID Counters

Status: implemented and validation-gated before API/PWA work.

## Why this exists

The SIM-era engine historically allocated many IDs from `collection.length + 1`. That is deterministic while every historical row remains loaded forever, but it is unsafe once a long-lived hosted World separates hot operational state from archived history: pruning old rows could make a collection shorter and cause a future entity to reuse an ID that already existed historically.

## Current contract

PPW now maintains deterministic per-World high-water counters for every simulation ID family that can grow during play, including people, contracts/offers, events/appearances, matches/participants, injuries, chemistry, teams/memberships, championships/reigns/contests, financial transactions and Ledger entries.

The allocator preserves the existing human-readable ID formats and sequence behavior. Counter metadata is runtime/persistence metadata rather than a wrestling attribute, so it is intentionally excluded from the legacy deterministic World hash. The hash remains a regression fingerprint for simulation behavior rather than persistence bookkeeping.

## State Schema v3

World State Schema v3 persists `entityIdCounters` separately from the simulation ruleset version.

- New Worlds initialize counters from Genesis entities before dynamic creation begins.
- Schema v1 and v2 snapshots migrate by deriving the highest numeric suffix currently present in each ID family.
- Current-schema restore rejects malformed counters.
- A persisted counter may be ahead of the highest row still loaded in hot state, which is required after history archiving.
- A persisted counter may never be behind an entity ID that is still loaded.

## Archival safety proof

The ID-allocation tests explicitly persist a World, prune old financial and Ledger rows from the hot snapshot while retaining the high-water counters, restore the World, then create new records. The new IDs must continue from the persisted high-water marks rather than from the shortened collection lengths.

## Acceptance criteria

This slice is accepted only if:

- the complete functional suite passes;
- Schema v1/v2 migration remains supported;
- persistence round-trip remains deterministic;
- the standard 10-PPW-Year hash remains `6a5dcd3b`;
- the standard 100-PPW-Year hash remains `7662b626`;
- both long simulations pass invariants.
