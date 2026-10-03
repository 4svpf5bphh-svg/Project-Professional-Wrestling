# Project Professional Wrestling (PPW)

PPW is a persistent asynchronous wrestling-management living-world simulation.

The deterministic **SIM-0** headless foundation is now released through **SIM-0.0.11**. Development has moved into **ALPHA-1A**, where one human-controlled Independent promotion enters the same living World as the AI promotions.

Before persistence/API/PWA work, ALPHA-1 is governed by the architecture contract in [`docs/ALPHA-1-ARCHITECTURE-REVIEW.md`](docs/ALPHA-1-ARCHITECTURE-REVIEW.md). The simulator is being preserved; the next work hardens ownership, World locking, editable planning, lifecycle parity, persistence, privacy/read models and recovery around it so ALPHA-1B can later add a second human without a backend rewrite.

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

See [`docs/SIM-0.0.10.md`](docs/SIM-0.0.10.md) and [`docs/SIM-0.0.11.md`](docs/SIM-0.0.11.md) for the latest released SIM milestone notes.

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

Deterministic release hashes are `6a5dcd3b` after 10 PPW Years and `7662b626` after 100 PPW Years. The optimized SIM-0.0.11 century Actions step completed in roughly **86 seconds** on its release-validation runner after the weekly Morale contract lookup was made incremental.

## ALPHA-1A — current headless human lifecycle

The ALPHA branch now proves the human command path through the same living World:

- claim/control one Independent promotion for the one-human ALPHA-1A test seat;
- submit exact player contract offers through the normal wrestler decision system;
- prepare show logistics, venue, market, ticket strategy and contracted participants;
- manually book singles/tag match cards, sides, intended winners, match intent and length;
- explicitly designate promotion-owned singles/tag championship matches;
- evaluate mandatory-show readiness;
- run fully prepared work unchanged;
- invoke Routine Continuity at the weekly lock when required show/card work is incomplete;
- restore human control immediately after any staff completion;
- resolve all consequences through the normal deterministic World engine.

This is still a **headless application boundary**, not yet the user-facing PWA. The architecture review intentionally stops general gameplay expansion here until the pre-UI gates are hardened.

## ALPHA-1 direction

ALPHA-1A will turn the proven human lifecycle into one real persistent, server-authoritative World with:

- one authenticated human player and AI promotions;
- 1 real day = 1 PPW week;
- first-class player/promotion ownership;
- editable advance planning;
- human/AI lifecycle parity;
- Routine Continuity and basic long-absence Stewardship;
- relational persistence, migrations, idempotent commands and recoverable weekly resolution;
- privacy-safe read models;
- Attention and basic Opportunities;
- mobile-first installable PWA.

ALPHA-1B then adds a late-joining second human to the **same existing World** using World Entry Health and the same ownership/lock/persistence architecture.

## Local commands

```bash
npm install
npm test
npm run sim -- --seed 20261002 --weeks 520
npm run sim -- --seed 20261002 --weeks 5200
```

The simulator remains intentionally dependency-light at the SIM layer. Persistence, API and PWA concerns are added around the simulation core rather than coupled into deterministic wrestling resolution logic.

## Architectural principle

> Small in implemented behaviour, broad in structural capability.

The simulation core stays separate from hosting, UI and narrative layers so the same engine can power one private World or many hosted Worlds without changing the underlying rules of wrestling, contracts, finance or history.
