# SIM-0.0.9 — Booking Continuity

SIM-0.0.9 makes match cards remember what came before. It builds on SIM-0.0.8's persistent championships and teams so AI promotions can create recognizable competitive continuity without requiring a full storyline engine yet.

## Delivered

### Tag-team continuity

- Established and familiar tag pairings are strongly preferred over constant partner reshuffling.
- Existing primary teams receive a major pairing preference while chemistry and familiarity reinforce organic continuity.
- The system still leaves enough wrestlers outside permanent teams for viable singles divisions.

### Championship booking

- Major singles title matches are treated as top-card attractions.
- Singles champions rotate failed challengers instead of immediately recycling the same opponent.
- A title change can create a meaningful rematch preference for the former champion without turning every defense into a loop.
- Tag champions usually face established teams rather than improvised two-person pairings.
- Title-defense cadence and last-contest history use persistent championship state.

### Non-title programmes and pushes

- Non-title singles programmes are inferred from bounded recent match history rather than stored as a permanent storyline entity.
- A previous meeting can qualify for continuation when match quality or crowd response gives the pairing enough evidence of interest.
- Qualified programmes recur after a gap of 2–10 PPW weeks and stop being deliberately selected after four recognized programme meetings.
- Ordinary fallback singles booking uses a short opponent cooldown so highly ranked wrestlers are not accidentally paired every week.
- Programme rematches are exempt from that fallback cooldown because their repetition is intentional.
- Cards are ordered using momentum, popularity, recognition and presentation so hotter wrestlers naturally move upward without conflating push with match quality.

## Behavioural validation

The complete SIM-0.0.9 test suite passes **52/52 tests**.

A dedicated decade booking sample reports:

- **983 unique tag pairings across 5,950 tag sides**;
- **87.3%** of tag sides use pairings seen at least three times;
- **100/100** major singles championship matches occupy one of the top two card positions;
- **159/173 (91.9%)** defended tag-title challengers are established teams;
- singles champions produce **0.0% immediate failed-challenger repeats**, with a maximum repeat streak of one;
- **47.2%** of repeat non-title singles meetings land in the intended 2–10 week programme window;
- only **1.5%** are immediate non-title rematches;
- the observed maximum is **8 meetings for one pairing inside 16 weeks**, including ordinary booking interactions outside deliberate programme selection;
- upper-card wrestlers average **77.7 push score** against **66.4** for lower-card wrestlers.

## Standard 10-year proof

Seed `20261002` reaches Year 11 with zero invariant failures and contains:

- 2,966 completed events;
- 15,998 completed matches — 12,893 singles and 3,105 tag;
- 63 active teams;
- 665 championship contests;
- 172 title changes and 457 successful defenses;
- deterministic hash `4f34c112`.

## Century performance correction

The first 100-year release gate exposed an important scaling regression. Programme logic correctly limited itself to recent weeks conceptually, but repeatedly searched the entire historical match archive to find those recent records. Additional booking helpers also rescanned historical title contests, match participants, team memberships and chemistry.

SIM-0.0.9 was not released with that behaviour. The booking layer now uses incremental `WeakMap` indexes for:

- matches by event;
- participants by match;
- latest championship contest;
- championship-defense timing;
- active team membership;
- championship reign lookup;
- working chemistry by pair/context.

Recent programme queries now touch recent event records instead of the entire World history. These indexes are derived runtime acceleration structures; canonical World state and deterministic outcomes remain unchanged.

## Final 100-year proof

The final standard seed `20261002` completes **5,200 PPW weeks / 100 PPW Years** with **zero invariant failures**. At Year 101:

- 700 wrestlers have existed, with 385 active, 315 retired and 300 generated talents;
- 143,686 matches have completed — 116,598 singles and 27,088 tag;
- 2,643 tag teams have existed and 36 are active at the snapshot;
- 18 championships remain active;
- 2,790 reigns and 5,907 championship contests have been recorded;
- 1,962 title changes and 3,117 successful defenses have occurred;
- 1,817 injuries have been recorded;
- 316,178 Ledger events and 1,786,203 financial transactions have accumulated;
- deterministic hash is `f94de009`;
- all invariants pass.

The century command completed in roughly **79 seconds including the TypeScript build** on GitHub Actions after the booking-history indexing work.

## Deliberately deferred

SIM-0.0.9 is not the final creative booking system. Deferred work includes persistent storyline/promo/segment entities, deeper AI programme intent and feud escalation, richer fan/audience segmentation, factions and multi-person stories, and narrative AI presentation. Those systems can now build on booking history that already behaves coherently without requiring prose generation to manufacture continuity.
