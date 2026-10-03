# Project Professional Wrestling (PPW)

PPW is a persistent asynchronous wrestling-management living-world simulation.

The repository is currently in **SIM-0**, where the deterministic headless World is being built and stress-tested before any polished player interface.

## Current milestone — SIM-0.0.9

The simulator can now:

- create deterministic long-lived Worlds from a seed;
- generate markets, venues, AI promotions and evolving wrestler populations;
- preserve meaningful free agency through one-off, limited non-exclusive and exclusive contracts;
- enforce Service Capacity, contract dates, expiries, renewals and competing offers;
- run promotion-specific live-event schedules with venues, ticket strategies, attendance and gate economics;
- build singles and tag match cards with intended winners, match intent, length, star ratings and crowd response;
- track persistent chemistry, fatigue, Wear, injuries and recovery;
- advance a separate slow biological Career Time, retire wrestlers under pressure rather than at a fixed birthday, and generate replacement prospects organically;
- let financially pressured AI promotions restructure, reduce operating scale, recruit affordable emergency talent, recover when healthy or enter Dormancy after sustained failure;
- maintain persistent singles and tag championships with reigns, defenses, title changes and historical lineages;
- maintain persistent tag-team identities and membership rather than treating every tag pairing as disposable;
- book established tag teams repeatedly without consuming the entire wrestler population;
- rotate championship challengers, protect major title matches as top-card attractions and avoid automatic failed-challenger loops;
- infer short non-title singles programmes from recent match history, continue qualified rivalries with sensible spacing, and stop ordinary fallback booking from creating accidental weekly rematches;
- place hotter wrestlers higher on cards while keeping match quality and crowd response separate from push;
- calculate cash flow, runway and financial distress;
- record consequential business and wrestling history in an append-first World Ledger;
- reproduce the same resolved World from the same seed;
- validate the complete simulation through GitHub Actions, including a standard-seed 100-PPW-Year run.

## Current long-world proof

The standard seed `20261002` completes **100 PPW Years with zero invariant failures** under SIM-0.0.9. At Year 101 the World contains **385 active wrestlers from 700 historical wrestlers**, including **300 generated talents**, alongside **143,686 completed matches**, **2,643 historical tag teams**, **5,907 championship contests**, **1,962 title changes** and **3,117 successful defenses**.

The century simulation completed in roughly **79 seconds including the TypeScript build** on GitHub Actions after 0.0.9's booking-history lookups were moved to incremental indexes. The same milestone also passes the complete behavioural suite and the standard 10-year smoke simulation.

## Local commands

```bash
npm install
npm test
npm run sim -- --seed 20261002 --weeks 520
npm run sim -- --seed 20261002 --weeks 5200
```

The simulator remains intentionally dependency-light. PostgreSQL/Drizzle, Fastify and the PWA layer are introduced when the domain loop needs persistence or human interaction.

## Architectural principle

> Small in implemented behaviour, broad in structural capability.

The simulation core is kept separate from hosting, UI and narrative layers so the same engine can later power one private World or many hosted Worlds.
