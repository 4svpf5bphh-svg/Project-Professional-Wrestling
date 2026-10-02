# Project Professional Wrestling (PPW)

PPW is a persistent asynchronous wrestling-management living-world simulation.

The repository is currently in **SIM-0**, where the deterministic headless World is being built and stress-tested before any polished player interface.

## Current milestone — SIM-0.0.3

The simulator can now:

- create a deterministic World from a seed;
- generate 20 markets and a configurable AI promotion ecosystem;
- generate a configurable wrestler population while preserving free agency;
- use formal one-off, limited non-exclusive and exclusive contracts instead of roster ownership;
- model contract dates, date entitlements, role expectations, compensation and Service Capacity;
- expire, renew and competitively resolve contracts;
- allow compatible multi-promotion non-exclusive careers;
- derive promotion rosters from current contractual rights;
- settle media, sponsorship, overhead, signing bonuses and contract guarantees through a financial transaction ledger;
- calculate runway and financial distress;
- write consequential history to an append-first World Ledger;
- advance the PPW clock across 52-week PPW Years through a World-week resolver;
- reproduce the same resolved World from the same seed;
- run long-world invariant tests without external dependencies.

## Local commands

```bash
npm run test
npm run sim -- --seed 20261002 --weeks 520
```

The simulator remains intentionally dependency-light. PostgreSQL/Drizzle, Fastify and the PWA layer are introduced only when the domain loop needs persistence or human interaction.

## Architectural principle

> Small in implemented behaviour, broad in structural capability.

The simulation core is kept separate from hosting, UI and narrative layers so the same engine can later power one private World or many hosted Worlds.
