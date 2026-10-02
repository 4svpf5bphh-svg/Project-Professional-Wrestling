# Project Professional Wrestling (PPW)

PPW is a persistent asynchronous wrestling-management living-world simulation.

This repository currently contains **SIM-0.0.1**, the deterministic headless foundation. It deliberately has no polished web UI and no generative AI.

## Current milestone

SIM-0.0.1 can:

- create a deterministic World from a seed;
- generate 20 markets;
- generate a configurable AI promotion ecosystem (default 9 promotions);
- generate a configurable wrestler population (default 400 wrestlers);
- preserve a healthy uncontracted starting talent pool;
- write Genesis events to an append-first World Ledger;
- advance the PPW clock across 52-week PPW Years;
- reproduce the same World snapshot from the same seed;
- run core invariant tests without external dependencies.

## Local commands

```bash
npm run test
npm run sim -- --seed 20261002 --weeks 520
```

The simulator is intentionally dependency-light at this stage. PostgreSQL/Drizzle, Fastify, Vitest and the PWA layer are introduced only when the domain loop needs them.

## Architectural principle

> Small in implemented behaviour, broad in structural capability.

The simulation core is kept separate from future hosting, UI and narrative layers so the same engine can later power one private World or many hosted Worlds.
