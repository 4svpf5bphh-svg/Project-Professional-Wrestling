# SIM-0.0.1 Foundation

This milestone implements only the deterministic World skeleton.

## Included
- PPW 52-week clock.
- Separate ruleset with a Career Time factor reserved for later career simulation.
- Seeded deterministic PRNG wrapper.
- World Genesis for markets, AI promotions and generated wrestlers.
- Deliberately preserved free-agent pool.
- Append-first Genesis Ledger.
- Basic world invariants.
- Headless CLI and zero-dependency test runner.

## Deliberately not included yet
- Finance transactions.
- Contracts/date entitlements.
- Shows and matches.
- Injuries and development.
- AI weekly decisions.
- PostgreSQL persistence.
- Human UI.

Those are added in dependency order after determinism and Genesis are proven.
