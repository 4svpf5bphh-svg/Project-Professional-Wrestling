# SIM-0.0.10 — Audience, Scale, Competition and Promotion Standing

SIM-0.0.10 made PPW's promotions respond to the world around them rather than operating as isolated event machines.

## Scope

### Local audience consequence

Completed shows now change local promotion-market strength. Strong demand, sell-through and show quality can build live strength, awareness and loyalty; weak outcomes can reduce them. Short-term audience heat decays gradually rather than resetting immediately, so repeated success in a market can create a durable advantage without becoming permanent.

### Organic promotion scale

Promotion tier movement is evaluated at the annual boundary from genuine business and audience performance. Strong promotions can rise and collapsed promotions can fall, with movement capped at one tier per annual evaluation so the industry hierarchy changes gradually rather than oscillating week to week.

### Live market competition

Events now compete for the same local audience. Competition pressure depends on the strength of the rival promotion and is strongest when events occur on the same PPW day, with weaker pressure as dates separate within the week. A market with no rival event receives no competitive demand penalty.

### Promotion standing

Promotions now carry persistent standing rather than being described only by current tier and cash. SIM-0.0.10 introduced:

- Prestige
- Fan Reputation
- Business Reputation

Current fan/business reputation can move materially after a strong or poor year, while accumulated Prestige changes more slowly. This lets a historically important promotion have a bad current period without instantly losing all long-term stature.

## Validation

The SIM-0.0.10 branch passed **67 behavioural tests** plus the standard deterministic long-world gates.

Standard seed `20261002`:

- 10 PPW Years: deterministic hash `e688c076`
- 100 PPW Years: deterministic hash `c8613313`
- Year 101: 384 active wrestlers from 680 historical wrestlers
- 280 generated talents
- 203 active contracts
- 26,975 completed events
- 139,556 completed matches
- 5,731 championship contests
- 1,991 title changes
- zero invariant failures

## Architectural consequence

SIM-0.0.10 established the distinction between **promotion scale**, **current reputation**, **historical prestige**, **local market strength** and **direct competitive pressure**. Later player-facing systems can therefore show meaningful consequences without deriving every judgement from a single hidden company rating.
