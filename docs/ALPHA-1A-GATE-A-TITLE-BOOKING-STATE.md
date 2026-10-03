# ALPHA-1A Gate A — Explicit Championship Booking State

This Gate A slice removes unresolved human championship booking intent from the World Ledger as a source of truth.

- `championshipMatchBookings` is explicit mutable current World state.
- Human title booking and unbooking update that live state.
- The Ledger remains append-only audit/history and is not consulted to decide the current title match.
- Completed title bookings are removed from live planning state after competition resolution.
- World persistence advances to schema v2 and persists the new collection explicitly.
- Schema v1 restores migrate any still-scheduled human title booking from historical Ledger entries once, preserving old Alpha snapshots without keeping the Ledger dependency.
- Persisted live bookings are reference-validated before restore.
- Live championship booking state participates in deterministic diagnostics when present, while all-AI Worlds preserve the established SIM hashes.

This slice intentionally does not implement the wider future planning horizon, player ownership, lifecycle parity, deterministic entity counters, database persistence, or PWA work.
