# SIM-0.0.7 — AI Survival, Restructuring & Promotion Lifecycle

This milestone prevents financially weak AI promotions from remaining indefinitely active as empty or non-viable shells.

## Included

- Persistent per-promotion survival state with baseline operating scale and accumulated stress/recovery history.
- Survival evaluation every four PPW weeks rather than every tick.
- Sustained Distress/Crisis can move an AI promotion into the Distressed lifecycle state.
- Restructuring lowers fixed overhead and slows event cadence rather than creating hidden income.
- Restructuring can terminate a limited number of expensive contracts while preserving a minimum viable roster.
- Contract termination creates an explicit restructuring settlement in the financial ledger.
- Pending offers can be withdrawn when a promotion restructures.
- Distressed/Crises promotions can recruit a small number of affordable free agents on short non-exclusive emergency deals.
- Emergency signings remain probabilistic and wrestler-priority-sensitive rather than forced allocations.
- A Distressed promotion that sustains healthy finances can return to Active and restore its baseline operating scale.
- Prolonged insolvency plus persistent understaffing can move an AI promotion to Dormant.
- Dormancy releases active talent, withdraws pending offers, stops fixed overhead and prevents further events/normal AI recruiting.
- All restructuring, emergency-signing, recovery and Dormancy transitions are written to the World Ledger.
- Promotion survival state is included in deterministic World hashing and diagnostic summaries.
- GitHub Actions now compiles and runs the full SIM regression suite plus 10- and 100-PPW-Year standard-seed validation.

## What this deliberately does not do

- No secret cash injections or AI-only revenue bonuses.
- No guaranteed rescue of every promotion.
- No automatic replacement roster grants.
- No Dormant-promotion relaunch/acquisition system yet.
- No human-player inactivity Stewardship yet; this milestone addresses AI organisational survival, while the wider Stewardship design remains preserved for ALPHA work.
- No promotion sale, merger, acquisition or corporate succession yet.

## Standard-seed 100-year validation

Seed `20261002`, 5,200 PPW weeks, GitHub Actions / Node 24:

- Year 101, Week 1 reached successfully.
- 20 markets and 60 venues.
- 9 promotions.
- 692 historical wrestlers; 385 active and 307 retired.
- 292 generated wrestlers.
- 286 active free agents.
- 55 wrestlers currently working for multiple promotions.
- 27,552 completed events.
- 144,245 completed matches.
- 164,659,600 total live attendance.
- 1,843 recorded injuries, with only 2 active at the endpoint.
- More than 1.79 million financial transactions.
- No active promotion has a zero-person roster.
- Endpoint roster sizes: 14 Global; 36/36 National; 29/29 Rising; 23/17/14/23 Independent.
- Endpoint financial state: all 9 promotions Healthy on this seed.
- Zero World invariant failures.

The endpoint being healthy does not mean failure has been disabled. The lifecycle engine contains and tests a real Dormancy path; promotions only enter it after sustained insolvency and persistent inability to field a viable roster. The simulation therefore allows decline and organisational disappearance without converting economic pressure into an arbitrary Game Over.

## Design consequence

PPW now distinguishes a promotion that is merely losing money from one that is organisationally failing. Financial pressure first changes behaviour—scale, cadence, contracts and recruitment—before it can change lifecycle state. This preserves the living-world principle that companies should react to their circumstances rather than silently receive balancing resources.
