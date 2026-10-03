# Project Professional Wrestling (PPW)

PPW is a persistent asynchronous wrestling-management living-world simulation.

The repository is currently in **SIM-0**, where the deterministic headless World is being built and stress-tested before any polished player interface.

## Current milestone — SIM-0.0.7

The simulator can now:

- create deterministic long-lived Worlds from a seed;
- generate markets, venues, AI promotions and evolving wrestler populations;
- preserve meaningful free agency through one-off, limited non-exclusive and exclusive contracts;
- enforce Service Capacity, contract dates, expiries, renewals and competing offers;
- run promotion-specific live-event schedules with venues, ticket strategies, attendance and gate economics;
- build singles/tag match cards with intended winners, match intent, length, star ratings and crowd response;
- track persistent chemistry, fatigue, Wear, injuries and recovery;
- advance a separate slow biological Career Time;
- develop wrestlers through actual match experience and generate new prospects as careers end;
- let financially pressured AI promotions restructure rather than becoming permanent zombie companies;
- reduce distressed operating costs and show cadence, release expensive contracts with settlements and recruit affordable emergency talent;
- allow healthy distressed promotions to recover their normal operating scale;
- move prolonged insolvent/understaffed promotions into Dormancy, releasing talent back to the shared World;
- calculate cash flow, runway and financial distress;
- record consequential business and wrestling history in an append-first World Ledger;
- reproduce the same resolved World from the same seed;
- validate the complete simulation through GitHub Actions, including a standard-seed 100-PPW-Year run.

## Current long-world proof

The standard seed `20261002` completes 100 PPW Years with **zero invariant failures**. At Year 101 it contains 385 active wrestlers from 692 historical wrestlers, 292 generated talents, more than 144,000 completed matches and no active zero-roster promotion. Promotion lifecycle/survival state is part of deterministic diagnostics.

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
