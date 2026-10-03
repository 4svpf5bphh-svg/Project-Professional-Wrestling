# Project Professional Wrestling (PPW)

PPW is a persistent asynchronous wrestling-management living-world simulation.

The deterministic **SIM-0** headless foundation is now released through **SIM-0.0.11**. The next milestone is **ALPHA-1A**, where one human-controlled Independent promotion enters the same living World as the AI promotions.

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

See [`docs/SIM-0.0.10.md`](docs/SIM-0.0.10.md) and [`docs/SIM-0.0.11.md`](docs/SIM-0.0.11.md) for the latest milestone notes.

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

The complete SIM-0.0.11 behavioural suite contains **85 tests**, all passing.

## Next milestone — ALPHA-1A

ALPHA-1A turns the proven World into the first playable PPW slice:

- one human promoter controlling one Independent promotion;
- AI promotions continuing to operate in the same World;
- founding/claiming the player promotion and managing its roster/contracts;
- player-facing show preparation and booking while preserving the existing match/event simulation;
- advanced booking and Routine Continuity so a prepared show can run normally during a real-life absence;
- mandatory-show fallback only when required work was left unresolved;
- finances, championships, basic tag wrestling, injuries, markets, opportunities, attention and history exposed through a player-facing application;
- server-authoritative persistence so ALPHA-1B can later add a second human to the same existing World rather than rebuilding the game around multiplayer.

## Local commands

```bash
npm install
npm test
npm run sim -- --seed 20261002 --weeks 520
npm run sim -- --seed 20261002 --weeks 5200
```

The simulator remains intentionally dependency-light at the SIM layer. Persistence, API and PWA concerns are added around the simulation core during ALPHA-1A rather than coupling them into deterministic resolution logic.

## Architectural principle

> Small in implemented behaviour, broad in structural capability.

The simulation core stays separate from hosting, UI and narrative layers so the same engine can power one private World or many hosted Worlds without changing the underlying rules of wrestling, contracts, finance or history.
