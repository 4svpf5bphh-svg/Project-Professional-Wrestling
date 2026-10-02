# Project Professional Wrestling (PPW)

PPW is a persistent asynchronous wrestling-management living-world simulation.

The repository is currently in **SIM-0**, where the deterministic headless World is being built and stress-tested before any polished player interface.

## Current milestone — SIM-0.0.6

The simulator can now:

- create a deterministic World from a seed;
- generate 20 markets with three venue bands each;
- generate a configurable AI promotion ecosystem and wrestler population;
- preserve meaningful free agency;
- use formal one-off, limited non-exclusive and exclusive contracts;
- model contract dates, Service Capacity, expiries, renewals and competing offers;
- run promotion-specific live-event schedules;
- select markets, venues and broad ticket strategies;
- calculate event demand, attendance and gate revenue;
- charge venue, production, travel, guarantees and appearance fees through a transaction ledger;
- consume purchased contract dates only when a wrestler actually appears;
- build real singles/tag match cards for each event;
- simulate intended winners, match intent, length, execution quality, visible star ratings and crowd response;
- track persistent working chemistry/familiarity;
- accumulate fatigue and long-term Wear;
- generate injuries, temporary unavailability and recovery;
- advance a separate slow biological Career Time;
- develop wrestlers through actual match experience with diminishing returns;
- transition career stages, retire worn/older wrestlers and generate new prospects when population supply falls;
- allow serious in-match injuries to force rare changes to the booked finish;
- evolve wrestler momentum and promotion strength through actual wrestling results;
- calculate cash flow, runway and financial distress;
- record consequential business and wrestling history in an append-first World Ledger;
- reproduce the same resolved World from the same seed;
- run long-world invariant tests without external dependencies.

## Local commands

```bash
npm run test
npm run sim -- --seed 20261002 --weeks 520
```

The simulator remains intentionally dependency-light. PostgreSQL/Drizzle, Fastify and the PWA layer are introduced when the domain loop needs persistence or human interaction.

## Architectural principle

> Small in implemented behaviour, broad in structural capability.

The simulation core is kept separate from hosting, UI and narrative layers so the same engine can later power one private World or many hosted Worlds.
