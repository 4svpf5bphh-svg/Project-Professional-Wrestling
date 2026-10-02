# Project Professional Wrestling (PPW)

PPW is a persistent asynchronous wrestling-management living-world simulation.

The repository is currently in **SIM-0**, where the deterministic headless World is being built and stress-tested before any polished player interface.

## Current milestone — SIM-0.0.2

The simulator can now:

- create a deterministic World from a seed;
- generate 20 markets;
- generate a configurable AI promotion ecosystem (default 9 promotions);
- generate a configurable wrestler population (default 400 wrestlers);
- preserve a healthy uncontracted starting talent pool;
- write Genesis and financial-state events to an append-first World Ledger;
- settle deterministic weekly media, sponsorship, overhead and talent-commitment transactions;
- calculate weekly net cash flow, runway and financial distress;
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
