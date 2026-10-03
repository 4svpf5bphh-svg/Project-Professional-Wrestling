# Project Professional Wrestling (PPW)

PPW is a persistent asynchronous wrestling-management living-world simulation.

The deterministic **SIM-0** headless foundation is released through **SIM-0.0.11**. Development is now in **ALPHA-1A**, where one human-controlled Independent promotion enters the same persistent World as the AI promotions through the first real server/API/mobile-web path.

ALPHA-1 is governed by the architecture contract in [`docs/ALPHA-1-ARCHITECTURE-REVIEW.md`](docs/ALPHA-1-ARCHITECTURE-REVIEW.md). The simulator is preserved behind ownership, World locking, editable planning, lifecycle parity, persistence, privacy/read models and recovery so ALPHA-1B can later add a second human without a backend rewrite.

## Released baseline — SIM-0.0.11

The simulator can now:

- create deterministic long-lived Worlds from a seed;
- generate markets, venues, AI promotions and evolving wrestler populations;
- preserve meaningful free agency through one-off, limited non-exclusive and exclusive contracts;
- enforce Service Capacity, contract dates, expiries, renewals and competing offers;
- run promotion-specific live-event schedules with venues, ticket strategies, attendance and gate economics;
- build singles and tag match cards with intended winners, match intent, length, star ratings and crowd response;
- track persistent chemistry, fatigue, Wear, injuries, recovery, slow biological Career Time, retirement pressure and organic replacement talent;
- let financially pressured promotions restructure, reduce operating scale, recruit affordable emergency talent, recover when healthy or enter Dormancy after sustained failure;
- maintain persistent singles and tag championships with reigns, defenses, title changes and historical lineages;
- maintain persistent tag-team identities and membership rather than treating every pairing as disposable;
- rotate championship challengers, protect major title matches as top-card attractions and infer short non-title singles programmes with sensible rematch spacing;
- build and decay local audience strength, awareness and loyalty from actual event outcomes;
- apply live market competition, with stronger and closer rival events suppressing demand more heavily;
- move successful or collapsing promotions through the tier hierarchy at controlled annual boundaries;
- track persistent Promotion Standing across Prestige, Fan Reputation, Business Reputation and Talent Reputation;
- track wrestler–promotion Trust from actual treatment and let Trust influence genuinely marginal contract decisions;
- update wrestler Morale from usage, role expectations, momentum, fatigue and promotion health;
- allow severely damaged Morale/Trust relationships to resist marginal renewals without making relationship state overpower strong contract offers;
- calculate cash flow, runway and financial distress;
- record consequential business and wrestling history in an append-first World Ledger;
- reproduce the same resolved World from the same seed;
- validate the complete simulation through GitHub Actions, including a standard-seed 100-PPW-Year run.

See [`docs/SIM-0.0.10.md`](docs/SIM-0.0.10.md) and [`docs/SIM-0.0.11.md`](docs/SIM-0.0.11.md) for the released SIM milestone notes.

## Current long-world proof

Standard seed `20261002` under SIM-0.0.11 completes **100 PPW Years with zero invariant failures**.

At Year 101 the World contains:

- **385 active wrestlers** from 678 historical wrestlers;
- **278 generated talents** and 293 retired wrestlers;
- **105 contracted wrestlers**, 280 free agents and 211 active contracts;
- **27,083 completed events**;
- **138,114 completed matches**;
- **5,765 championship contests**;
- **1,711 historical injuries**.

Deterministic release hashes are `6a5dcd3b` after 10 PPW Years and `7662b626` after 100 PPW Years.

## ALPHA-1A — application foundation

The Alpha branch now has:

- first-class World membership and one-player/one-promotion ownership;
- configurable human-seat capacity rather than a one-human sim-core assumption;
- idempotent application commands and retry-safe receipts;
- `OPEN → LOCKING → RESOLVING → OPEN` World runtime/revision control;
- transactional PostgreSQL persistence and crash-safe weekly resolution checkpoints;
- editable detailed show planning;
- binding advance reservations for venue/day and wrestler/contract capacity;
- living-World revalidation, At Risk handling and exactly-once show materialization;
- player-facing Draft / Reserved / At Risk / Materialized / Ready-to-Lock / Staff-Owned planning status;
- Routine Continuity without changing human ownership;
- human/AI lifecycle parity for distress, restructuring, recovery and Dormancy.

## First web vertical slice

The first user-facing browser path now exists under `apps/web`.

It proves:

- a mobile-first Next.js application can load the persistent PPW World through PostgreSQL;
- player identity is supplied by the server in ALPHA-1A rather than trusted from the browser;
- the client receives a privacy-safe read model instead of raw `WorldState`;
- a player can choose an eligible Independent promotion;
- the claim goes through the real ownership/idempotency transaction;
- refresh/retry reloads the same persisted promotion and World revision;
- the production web build and live HTTP route flow are tested in CI.

After claiming, the initial dashboard exposes promotion cash, recent net, lifecycle/distress/runway, planning counts and a top-roster summary. Other navigation surfaces remain intentionally disabled until their real command/read paths are wired.

See [`docs/ALPHA-1A-WEB-VERTICAL-SLICE.md`](docs/ALPHA-1A-WEB-VERTICAL-SLICE.md).

## ALPHA-1 direction

The next web slices turn the proven application systems into the actual playable weekly loop:

- week/Attention home and current responsibility state;
- roster/talent market and contract actions;
- show planning/reservation/repair surfaces;
- match-card/championship booking;
- results/history/Industry views;
- server-controlled weekly lock/resolution experience;
- installable iPhone PWA polish and deployed-device verification;
- real authentication before a second human is enabled.

ALPHA-1B then adds a late-joining second human to the **same existing World** using World Entry Health and the same ownership/lock/persistence architecture.

## Local commands

```bash
npm install
npm test
npm run web:build
npm run web:dev
npm run test:web-http
npm run sim -- --seed 20261002 --weeks 520
npm run sim -- --seed 20261002 --weeks 5200
```

The simulator remains intentionally independent of hosting and UI concerns. The web app talks through the application/server adapter rather than coupling Next.js into deterministic wrestling resolution.

## Architectural principle

> Small in implemented behaviour, broad in structural capability.

The simulation core stays separate from hosting, UI and narrative layers so the same engine can power one private World or many hosted Worlds without changing the underlying rules of wrestling, contracts, finance or history.
