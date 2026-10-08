# PPW Feature Dependency Audit

Status: **Architecture contract before the post-reset feature-depth phase**  
Baseline reviewed: `alpha-freeze-promotion-ecosystem` at `4a4b4acd`  
Date: 2026-10-08

## 1. Development mantra

Before coding any major PPW feature, answer these four questions:

1. **What does this depend on?**  
   Which simulation, application, persistence, scheduling or UI systems must already exist?

2. **What will depend on this later?**  
   Which foreseeable systems could be trapped by today's data model or assumptions?

3. **What is simulation/application state versus presentation?**  
   Competitive or persistent mechanics belong in authoritative state. React/UI may display them but must not invent them.

4. **What is the smallest complete first version?**  
   Build the smallest version that creates meaningful gameplay, not merely the smallest code change.

The product rule remains:

> **TEW underneath, EWR on top.**

Deep simulation should support clear player decisions without exposing unnecessary micromanagement.

---

## 2. Audit verdict

The current PPW foundation does **not** need another broad pre-reset rewrite.

The two-stage World clock was the major architectural issue that needed correcting before the next reset. It is now represented as authoritative state and two separate scheduled boundaries:

- **Show Commitment Lock** — venue/logistics and committed talent become fixed while the World remains open for card editing.
- **World Lock / Resolution** — remaining player mutation closes and the PPW week resolves.

The remaining future-depth areas have viable extension paths. Several current assumptions must be changed **before their dependent features are built**, but they do not block the Reality Check reset.

---

## 3. Dependency order after the Reality Check reset

### Layer 1 — Show / calendar architecture

**Why first:** media, premium-event business, Programme payoffs, title prestige, touring and audience expectations all depend on understanding what kind of show is being run.

Current foundations:
- `WrestlingEvent` already has `type` and `eventImportance`.
- The simulation already distinguishes `REGULAR` and `MAJOR`.
- Planning already supports dated shows, markets, venues and a six-week detailed horizon.

Current trap:
- show requirement is driven by one `promotion.eventCadenceWeeks`;
- `REGULAR` versus `MAJOR` is derived from one global `majorEventIntervalWeeks`;
- all promotions effectively share the same major-event rhythm;
- detailed planning does not explicitly choose or reference a show series/category.

**Required before media/business depth:** replace the global derived rhythm with a promotion-owned show/calendar model capable of regular, touring/special and premium/major events without making every event identical.

Do not build detailed broadcast contracts before this layer exists.

Audience expectation should be explicit rather than inferred only from size or cadence. Weekly series should be able to declare roles such as **A-show / flagship**, **B-show / secondary**, developmental or special-purpose programming. Premium/major events should likewise be able to carry an **event identity/tradition** such as the promotion's event of the year, battle-royal showcase, tournament final, cage/gimmick tradition or other signature match expectation.

These identities should shape audience expectations, stakes, booking pressure and future media value. They must **not** act as arbitrary rating buffs; the promotion still has to deliver on the promise.

---

### Layer 2 — Talent expectations and consequences

Current foundations:
- contracts already persist `RoleExpectation`;
- Morale, Trust, momentum, booking history, appearances and contract history already exist;
- weekly Morale currently uses role expectation as evidence when talent is or is not used.

Current limitation:
- role expectation is primarily contractual/static;
- wrestlers do not yet evaluate booking position, repeated losses, promises, Programme prominence, title opportunities or sustained under/over-use in a rich way.

**Architecture direction:** richer expectations/promises should be first-class promotion↔talent state/history rather than adding dozens of booleans to `Contract`.

The contract remains the legal deal. Expectations/promises represent the working relationship around that deal.

---

### Layer 3 — Programmes, factions and championships

#### Programmes

Current foundations are strong:
- persistent Programmes;
- participant references may be PERSON or TEAM;
- two opposing sides;
- activities/history;
- Heat and repetition;
- championship linkage.

Current trap:
- Programmes currently require exactly two sides and cap the total participant references at four.

That is sufficient for standard feuds but too restrictive for faction wars or larger multi-person stories.

**Required before faction-driven storytelling:** loosen Programme participation so larger stories can be represented without replacing Programme history.

Do not turn Programmes into a script-writing spreadsheet.

#### Factions / stables

Current `Team` should remain a **tag-team entity**, not be overloaded into factions.

Why:
- current tag logic deliberately assumes two active members;
- chemistry, titles, booking and team recognition depend on pair semantics.

**Architecture direction:** add a separate first-class Faction/Stable entity with membership and leadership/history, while allowing Programmes to reference factions later if useful.

This avoids breaking working tag-team mechanics.

#### Championships

Current data model can store multiple Championship records per promotion.

Current trap:
- automatic creation and AI booking commonly search by promotion + division and therefore behave as though each promotion has one active singles title and one active tag title.

**Required before secondary/tertiary title depth:** introduce championship role/level semantics such as primary/secondary/tag/specialty before AI, prestige and booking logic starts assuming all singles belts are equivalent.

Do not encode “secondary belt” through its name.

---

### Layer 4 — Business / media

Current foundations:
- media reach;
- weekly media income;
- weekly sponsor income;
- financial transaction categories;
- promotion standing and distress;
- event economics and gate revenue.

Current limitation:
- media and sponsorship are flat promotion-level numbers;
- finance records them as baseline recurring income.

**Architecture direction:** future broadcast/streaming and sponsorship arrangements become first-class deal entities. Existing weekly income fields may remain as derived/current aggregate values during migration, but must not become the contract model itself.

Media deals should reference the show/calendar model created in Layer 1.

---

### Layer 5 — Staff, delegation and injury management

Current foundations:
- Routine Continuity already distinguishes `SHOW_AND_CARD` and `CARD_ONLY`;
- execution policy can allow staff to plan or complete a card without transferring promotion ownership;
- injuries and recovery already exist.

There is currently no first-class staff roster.

**Architecture direction:** staff become separate entities/appointments with roles and competencies. Do not encode staff as wrestlers, promotion stat boosts or temporary changes to ownership.

Likely later roles include booker/agent, doctor/surgeon, trainer and scout.

Medical spending/treatment may affect recovery time and complication risk, but must not use Kayfabe Points or bypass the simulation economy.

---

### Layer 6 — Long-lived World and career pipeline

This area already has more foundation than it appears:
- accelerated PPW calendar separated from biological Career Time;
- Career Stages;
- development;
- age/wear decline;
- retirement;
- deterministic new-talent generation.

Future depth still needed:
- richer development/academy pipeline;
- historical continuity and records;
- promotion rise/fall;
- recognizable long-term generations;
- join-in-progress health after many real months/years.

**Important:** do not reconnect biological aging directly to the fast PPW calendar.

---

### Layer 7 — Multiplayer World Entry

Architecture already supports much of this:
- server-authoritative World;
- World memberships;
- promotion ownership;
- one-player/one-promotion enforcement;
- idempotent commands;
- persisted scheduling;
- privacy-safe projections;
- scarce-resource reservations;
- Stewardship and inactivity handling.

Do not add human player #2 until running one promotion is sufficiently deep to be worth sharing.

Late joining should create structural opportunity, not rubber-band equality.

---

### Layer 8 — Account/meta systems

Kayfabe Points remain:
- earn-only;
- account-level;
- non-competitive;
- unable to buy wrestlers, contracts, cash, outcomes, recovery advantages or simulation power.

Suitable uses remain collectibles, history/legend cards, World Moment cards, badges and cosmetics.

Legend/deceased-wrestler unlocks may be World achievements, with unlocked wrestlers entering the World market rather than being awarded directly to the triggering player.

---

## 4. Additional structural watchlist

### Match types

Current `MatchType` is `SINGLES | TAG`, and validation hard-codes 1v1 / 2v2 side sizes.

That is correct for the current Alpha scope but is a known extension boundary for:
- triple threats / four-ways;
- trios;
- battle royals;
- handicap matches;
- specialty match structures.

Do not fake these future match types through ordinary TAG/SINGLES records.

This is not a pre-reset blocker; address it before match-engine depth expands.

### Teams

The generic membership tables can technically hold more members, but active tag-team logic intentionally treats a valid team as exactly two people.

Preserve that contract. Factions should be separate.

### Persistence

PPW already has explicit World state schema versions and migrations. New first-class systems should receive explicit persisted collections/migrations rather than relying indefinitely on optional/lazy state.

Because the project is still Alpha, another World reset remains acceptable when a cleaner model is preferable to a fragile migration.

---

## 5. Reset decision

The feature dependency audit finds **no additional architecture-critical blocker before the next Reality Check reset**.

The safe sequence is now:

1. preserve the current green freeze-branch checkpoint;
2. perform the controlled Alpha World reset;
3. expose the audited real-world Genesis;
4. run a short Reality Check playtest (roughly 5–10 PPW weeks);
5. fix any real behavior/UI problems revealed by the reset;
6. begin Layer 1 — Show / calendar architecture;
7. continue in dependency order above.

The Reality Check is not the final “is PPW fun for years?” test. It verifies that the large real-world cutover, two-stage clock, contracts, planning, teams, relationships, divisions, economy and current booking loop behave correctly in the actual product before more feature depth is stacked on top.
