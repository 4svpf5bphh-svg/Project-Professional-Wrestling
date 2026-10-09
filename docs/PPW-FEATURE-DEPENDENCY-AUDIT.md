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


---

## 9. Research-derived living-world expansion architecture

Added: 2026-10-09

This section records feature directions surfaced by a review of wrestling-booking and adjacent management games. These are **principles to reinterpret for PPW**, not mechanics to clone.

Cross-cutting rules remain:

- **TEW underneath, EWR on top.**
- **Multiplayer-first:** every persistent mechanic must work in a shared, server-authoritative World before it is accepted.
- **Asynchronous fairness:** being online at a particular moment may give a player authorship/choice, never extra simulation power.
- **World Lock remains canonical:** no player's unresolved UI interaction may pause, rewind or create a separate timeline for the World.
- **One player = one promotion:** delegation, staff and spectatorship must not weaken ownership boundaries.
- **Simulation state is authoritative:** UI explains and exposes mechanics; it does not invent competitive state.
- **Depth should reinforce other systems:** prefer a connected memory/trust/promise/reputation/history system over isolated meters and feature silos.
- **Progressive disclosure:** surface simple decisions first, with deeper context available when wanted.
- **Kayfabe Points remain non-competitive:** none of these systems may turn KP into simulation power.
- **Do not interrupt the current Reality Check sequence:** immediate contained work remains negotiation guidance, then the custom Card wrestler picker. These expansion systems enter only when their dependencies are ready.

### 9.1 Persistent wrestler memories and working relationships

**What does this depend on?**
- existing Trust, Morale, contracts, booking history, Programme history and persistent World state;
- Layer 2 richer expectations/promises;
- stable identifiers for people, promotions, shows and significant decisions.

**What will depend on this later?**
- wrestler pitches and promises;
- contract willingness and renegotiation context;
- loyalty, grievances, morale explanations and relationship drift;
- staff/player reputation;
- post-wrestling employment preferences;
- richer AI decision-making.

**Simulation/application state versus presentation**
- Significant memories are authoritative World state/history with source event, participants, age, weight/significance and decay/retention rules.
- Trust/Morale may consume memory evidence, but a memory is not merely a hidden numeric modifier.
- UI should usually summarise memories in human language rather than expose a ledger of modifiers.

**Smallest complete first version**
- Store only high-signal promotion↔wrestler memories already produced by existing mechanics: honoured/broken expectation, repeated omission, significant win/loss request, title opportunity, injury treatment/support and contract conduct.
- Use them first to explain Trust/Morale and negotiation posture.
- Do not begin with dozens of event types or a freeform AI memory system.

**Multiplayer note**
- Memories are scoped to the actor/relationship that created them. A player's treatment of a wrestler must not leak private intent to rival players; rivals may only see public consequences/reputation where appropriate.

### 9.2 Wrestler creative pitches, requests and promises

**What does this depend on?**
- Layer 2 expectations/promises;
- persistent memories;
- Programme and booking entities;
- contract role expectations and wrestler personality/preferences.

**What will depend on this later?**
- organic storyline generation;
- loyalty/trust consequences;
- booking-team/staff recommendations;
- emergent tag teams, stables, turns and career direction;
- richer negotiation promises.

**Simulation/application state versus presentation**
- A pitch/request is authoritative proposal state with expiry, involved entities, acceptance/rejection/counter state and any resulting promise.
- Narrative copy can vary, but the underlying requested outcome must be structured and deterministic.

**Smallest complete first version**
- A limited set of high-value requests: wants a featured Programme, wants to work with a named wrestler, wants/does not want a clean loss, wants a title opportunity, proposes a team or turn.
- Player may accept, decline or make a constrained counter.
- Accepted requests become expectations/promises and later memories.

**Multiplayer note**
- A wrestler may pitch independently to different promotions where contract rules allow it. No global pause and no first-click advantage unless a scarce contractual resource is genuinely being reserved through existing reservation rules.

### 9.3 Gorilla / live-audible layer

This is accepted only in a PPW-specific asynchronous form.

**Invariant: the World never waits for a player.**

**What does this depend on?**
- authoritative World Lock / Resolution;
- complete show-card intent and protected outcomes before lock;
- staff/delegation architecture (Layer 5);
- richer match/segment resolution with identifiable exceptional situations;
- idempotent commands and deterministic resolution.

**What will depend on this later?**
- producer/road-agent value;
- wrestler memories of promoter decisions;
- public stories around unexpected show events;
- spectator presentation;
- emergency booking and show-management depth.

**Simulation/application state versus presentation**
- Trigger conditions, legal response options, delegated policy and the chosen response are authoritative.
- The "Gorilla" screen is presentation over those options.
- A player who is present chooses from the same legal option set that delegated staff would have used.
- Presence grants authorship, **not a better modifier or extra option purely for being online**.

**Smallest complete first version**
- Pre-show standing instruction: **Stick to the card / Use judgement / Follow the crowd / Protect key plans**.
- Allow individual protected finishes or critical booking constraints.
- Support only a small number of hard events initially: genuine injury/physical inability, extreme crowd reaction, major timing overrun and a participant becoming unavailable.
- If the player is present during resolution, present the legal choice.
- If absent, appointed staff resolve from the same choices using standing instructions, competency and known booking constraints.
- Resolution completes at World Lock either way.
- Store a post-show Gorilla Log so absent players can see what happened and why.

**Explicit rejection**
- Do not pause one promotion's results until its player returns.
- Do not recalculate an already canonical show after other World consequences have resolved.
- Do not create a presence bonus.
- Do not require a player to attend lock time.

### 9.4 Staff as information, judgement and capability

**What does this depend on?**
- Layer 5 first-class staff appointments;
- uncertainty/confidence concepts around scouting, negotiation, medical prognosis and show production;
- delegation policy.

**What will depend on this later?**
- Gorilla resolution;
- negotiation guidance;
- scouting and developmental pipelines;
- injury treatment;
- opponent/market intelligence;
- absence protection.

**Simulation/application state versus presentation**
- Staff role, competency, employment and produced assessments are authoritative.
- UI may turn those assessments into ranges and plain-language advice.
- Avoid invisible blanket buffs wherever a more legible information/capability effect works.

**Smallest complete first version**
- Talent Relations/negotiation guidance is the natural first staff-shaped behaviour even before full staff hiring exists: surface sensible ranges, likely priorities and uncertainty.
- When staff entities arrive, move confidence/quality of that guidance behind the responsible role rather than rewriting negotiation mechanics.

**Multiplayer note**
- Staff reduce uncertainty about the player's own decisions; they must not reveal private rival contract terms or hidden rival plans.

### 9.5 Earned career reputations

**What does this depend on?**
- durable show/match/segment history;
- injuries, match types/styles, crowd reaction and major-show context;
- long-term career state.

**What will depend on this later?**
- scouting language;
- wrestler demands and booking preferences;
- media/history presentation;
- contract market perception;
- generated career narratives.

**Simulation/application state versus presentation**
- Reputation tags are derived or persisted from repeated evidence, not manually granted perks.
- They should describe what the World has learned about a wrestler rather than provide arbitrary stat boosts.

**Smallest complete first version**
- Begin with a handful of evidence-rich reputations such as Big Match Performer, Tag Specialist, Hardcore/Specialty Specialist, Dangerous Opponent and Kingmaker.
- Require repeated qualifying evidence and allow reputations to strengthen, fade or be contradicted over time.

**Multiplayer note**
- Earned reputations are World facts based on canonical history and therefore consistent for every player, although scouting confidence may affect how precisely they are described.

### 9.6 Organic prestige and traditions

Scope includes championships, recurring events, tournaments, teams/stables and later venue/promotion traditions.

**What does this depend on?**
- Layer 1 promotion-owned show/calendar identities;
- championship role/level semantics;
- persistent history and major-event context;
- teams/stables/tournaments as first-class entities where applicable.

**What will depend on this later?**
- audience expectations;
- media value;
- wrestler aspirations;
- event/tournament draw;
- searchable World history.

**Simulation/application state versus presentation**
- Prestige comes from accumulated canonical history and participant/outcome quality, not a manual arbitrary rating.
- Presentation should explain the main reasons an event/title has gained or lost stature.

**Smallest complete first version**
- Start with championship prestige and recurring major-event tradition once Layer 1 exists.
- Track history quality, continuity, major moments and neglect.
- Add tournament/team/venue prestige only when those entities have sufficient first-class history.

**Multiplayer note**
- Prestige is World state; human and AI promotions earn it under the same rules.

### 9.7 Post-wrestling careers

**What does this depend on?**
- retirement/career pipeline;
- Layer 5 staff entities;
- memories, relationships and promotion history.

**What will depend on this later?**
- long-world continuity;
- staff recruitment;
- academies/development;
- promotion culture and lineage.

**Simulation/application state versus presentation**
- retirement from active wrestling and later staff employment are separate authoritative career states.
- Previous career history remains attached to the same person identity.

**Smallest complete first version**
- On retirement, suitable people may become available for a small initial role set such as road agent/producer, trainer, scout or commentator.
- Suitability is derived from career traits/history rather than star status alone.
- No automatic guarantee that a legendary wrestler becomes excellent staff.

**Multiplayer note**
- Retired people remain scarce World resources and can negotiate with different promotions rather than being permanently inherited by their final employer.

### 9.8 Excursions, loans and developmental movement

**What does this depend on?**
- richer contracts/consent;
- first-class promotion relationships/diplomacy;
- career development;
- dates/availability and reservation rules.

**What will depend on this later?**
- developmental systems;
- alliances and working agreements;
- global talent pipelines;
- promotion identity.

**Simulation/application state versus presentation**
- A loan/excursion is a structured agreement covering dates/window, permitted usage, parent promotion, host promotion and wrestler consent.
- Development comes from actual canonical usage and environment, not an automatic "sent away" bonus.

**Smallest complete first version**
- Time/date-limited consensual loan between two promotions with clear booking availability and return conditions.
- Defer complex reciprocal talent exchanges and alliance-wide rules.

**Multiplayer note**
- Never allow one player to seize or warehouse another promotion's contracted wrestler. Consent and contract rights remain authoritative.

### 9.9 Local market memory and affinity

**What does this depend on?**
- existing meaningful markets, venues, attendance and promotion popularity;
- show/calendar identities;
- wrestler draw and event history.

**What will depend on this later?**
- touring strategy;
- venue recommendations;
- media geography;
- event traditions and wrestler hometown/market affinity.

**Simulation/application state versus presentation**
- Market history is World state derived from visits, attendance, show quality, recency, local stars and significant incidents.
- UI should summarise demand/context rather than expose a tuning spreadsheet.

**Smallest complete first version**
- Track promotion-market visit history, recency, attendance performance and a small local-affinity signal for standout wrestlers/events.
- Use it first to improve demand estimates and market-selection guidance.

**Multiplayer note**
- Markets are shared scarce opportunities. Rival activity may change demand/heat, but private future schedules stay private until the existing planning/commitment rules make them public.

### 9.10 Spectator / public-show experience

**What does this depend on?**
- canonical show-resolution events;
- privacy-safe projections;
- multiplayer World membership;
- later Gorilla logs/public incidents where appropriate.

**What will depend on this later?**
- social/shared World identity;
- public event feeds;
- league/world history;
- major-show anticipation.

**Simulation/application state versus presentation**
- Spectator views are read-only projections of already-public/canonical state.
- Never expose hidden booking instructions, finances, contract data or unrevealed plans.

**Smallest complete first version**
- After multiplayer exists, allow another World member to watch/replay the public sequence of a resolved show: segment/match completion, public result and crowd/result summary.
- "Live" presentation may stream already-authoritative resolution events, but it must not create a second timing model.

**Multiplayer note**
- Spectatorship cannot affect the show. It is presentation over the shared timeline.

### 9.11 Promotion diplomacy, alliances and joint shows

**What does this depend on?**
- loans/excursions;
- championship ownership/usage rules;
- scheduling and venue conflict rules;
- privacy and ownership boundaries;
- settlement/revenue rules.

**What will depend on this later?**
- cross-promotion tournaments;
- joint cards;
- shared or travelling championships;
- strategic talent relationships.

**Simulation/application state versus presentation**
- Working agreements are authoritative contracts between promotions with explicit permissions and termination rules.
- Do not model alliances as a single friendliness number.

**Smallest complete first version**
- Begin with a narrow working agreement that can permit defined talent loans and one jointly sanctioned event.
- Defer mergers, shared control and complex revenue structures.

**Multiplayer note**
- Joint activity never creates co-ownership of a promotion. Each player retains sole control of their own promotion and approves only the resources/rights they contribute.

### 9.12 Searchable World history

**What does this depend on?**
- stable canonical history across shows, matches, Programmes, championships, contracts, careers and prestige;
- efficient long-term persistence/indexing.

**What will depend on this later?**
- Hall of Fame/legacy systems;
- World Moment collectibles;
- commentator/media context;
- long-world onboarding.

**Simulation/application state versus presentation**
- Historical records are derived from canonical events, not manually-authored lore that can contradict the World.

**Smallest complete first version**
- Provide queryable title histories, major-event histories, wrestler career milestones and promotion records using data already being persisted.
- Expand only as new first-class systems create reliable history.

**Multiplayer note**
- Public history is shared truth. Private negotiations and hidden plans never become searchable unless later made public by an explicit World event.

---

## 10. Updated dependency placement

These additions do **not** replace the existing Layer order. They attach to it:

- **Layer 1 — Show/calendar:** recurring-event identity, local market memory foundation, later prestige.
- **Layer 2 — Talent expectations:** persistent memories, promises, creative pitches.
- **Layer 3 — Programmes/factions/championships:** organic title/team/story prestige and richer pitch targets.
- **Layer 4 — Business/media:** later consumes event/market prestige; no new research-derived blocker.
- **Layer 5 — Staff/delegation/injury:** staff-as-intelligence and Gorilla delegation foundation.
- **Layer 6 — Long-lived World/career:** earned reputations, post-wrestling careers, searchable history.
- **Layer 7 — Multiplayer World Entry:** spectator projections, human-to-human loans/agreements, asynchronous Gorilla validation.
- **Layer 8 — Account/meta:** World history may feed collectible World Moments, still with no competitive KP power.

### Future ordering within the new systems

Recommended order when dependencies become ready:

1. memories + promises;
2. staff information/capability model;
3. earned reputations and organic prestige foundations;
4. post-wrestling staff careers;
5. Gorilla standing instructions + delegated hard-event resolution;
6. local market memory;
7. loans/excursions;
8. spectator/public-show presentation after multiplayer;
9. diplomacy/joint shows;
10. broad searchable World history as the accumulated data becomes rich enough.

The exact implementation timing remains subordinate to Reality Check findings. A good future system does not outrank a current playability defect.

---

## 11. Immediate checkpoint remains unchanged in intent

At the point of this addendum, the second Reality Check batch had reached commit `c691891e` with CI #723 successful.

Completed in that batch before this planning-only update:
- tag-team Programme slot/start bug fixed;
- purchased-dates editing fixed;
- Results / Industry / Championship navigation loop fixed;
- Roster separated from Market/Offers with Singles / Tag Teams / Trios / Stables structure;
- Talent Market Advanced Search with minimum attribute filters.

Next contained implementation work remains:

1. **Negotiation guidance** — give the player useful context for offers without revealing forbidden rival/private information. This should be designed as the first visible expression of the future staff-as-information principle, while remaining functional before full staff hiring exists.
2. **Custom Card wrestler picker** — improve selection context without turning booking into a configuration spreadsheet.

Neither research-derived expansion system should interrupt those two Reality Check pieces.
