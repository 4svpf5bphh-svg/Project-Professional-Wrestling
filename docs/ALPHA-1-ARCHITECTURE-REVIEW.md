# PPW ALPHA-1 Architecture Review

Status: **Architecture contract before persistence/API/PWA work**  
Baseline reviewed: `alpha-1a` at `360c457`  
Date: 2026-10-03

## 1. Verdict

The deterministic simulator is a sound foundation and should **not** be rewritten.

SIM-0.0.11 plus the current ALPHA-1A human-control slices have proven the difficult simulation properties: deterministic World generation/resolution, contracts, event economics, matches, injuries, chemistry, teams, championships, promotion standing, Morale, Trust, long-run careers, AI competition, human show/card/title control, and Routine Continuity.

The next work is therefore not “more simulation features” and not “build the UI quickly.” It is to harden the boundary around the simulator so the first UI is built against the same ownership, time, persistence and concurrency model that the eventual multiplayer game needs.

The architectural direction is:

> **Preserve the simulation core. Build a server-authoritative modular-monolith application shell around it.**

ALPHA-1A remains one human promoter plus AI. ALPHA-1B adds a late-joining second human to the same already-running World. The architecture implemented for ALPHA-1A must already be capable of ALPHA-1B; ALPHA-1B should exercise multiplayer rather than force a backend rewrite.

---

## 2. Foundations that are already correct

The following should be preserved:

- deterministic seeded simulation;
- a 52-week PPW Year separated from slower biological Career Time;
- one wrestler existing once per World;
- `worldId` on simulation entities;
- simulation packages independent from HTTP, UI, authentication and hosting;
- a single authoritative weekly resolution pipeline;
- append-first World history through the Ledger;
- identical underlying wrestling, contract, finance and career rules for AI and human promotions;
- server-side resolution of actual match/business consequences;
- human control as commands into the World rather than a second simulation engine;
- Routine Continuity as an orchestration rule at the weekly lock;
- deterministic long-world/invariant CI as a permanent release gate.

The existing headless engine remains the rules engine beneath the application.

---

## 3. Critical findings from the review

### P0 — player ownership does not exist yet

`Promotion.controllerType` is currently only `AI | HUMAN`. `claimIndependentPromotionForHuman()` also enforces the temporary ALPHA-1A rule by searching the simulation state for any existing human promotion.

That is sufficient for a one-user mechanics test but cannot represent:

- which authenticated player owns a promotion;
- one-player/one-promotion enforcement;
- one promotion having exactly one human controller;
- a player leaving/rejoining;
- promotion sale/succession later;
- ALPHA-1B late joining;
- a player whose old promotion becomes dormant/closed and who later founds or assumes another promotion.

**Required before API/UI:** player identity and promotion ownership become application-level first-class records. A player/account ID must not be embedded into wrestling simulation objects.

### P0 — human promotions currently receive lifecycle protection

`processPromotionSurvivalForWeek()` currently skips every promotion whose `controllerType !== "AI"`.

That creates an unintended competitive advantage: AI companies can restructure, downsize and enter Dormancy under sustained failure while a human company is exempt from that survival process.

This violates the locked rule that human and AI promotions share the same underlying finances, obligations and lifecycle consequences.

**Required before play:** split universal survival evaluation/consequences from the AI decision policy. Human promotions must accumulate the same distress/survival state and be capable of restructuring, decline, Dormancy and closure. Where the AI currently makes a strategic remedial decision, the human receives a player-facing Action Required; objective consequences remain universal. No Game Over applies to the player career, not to corporate immortality.

### P0 — current planning state is not editable enough

The current human commands prove the mechanics but are deliberately one-shot:

- show preparation creates the current-week event directly;
- a match card cannot be replaced once created;
- title designation is stored as a Ledger event and later rediscovered by reading historical Ledger entries;
- planning is current-week only.

This conflicts with the locked PPW planning model:

- strategic planning: roughly **up to 52 weeks**;
- creative planning: roughly **12–16 weeks**;
- detailed cards: roughly **4–6 weeks**;
- prepared actions are editable until the applicable lock;
- scheduled commitments progressively become binding.

**Required before UI:** current player intent must live in explicit mutable current-state records. The Ledger records that something happened; it must not be queried as the source of truth for an unresolved booking choice.

### P0 — no authoritative World runtime/lock model exists yet

`resolveWorldWeek()` is currently called directly. That is correct for headless simulation but not for a shared World.

The locked time model is:

- **1 real day = 1 PPW week**;
- one fixed resolution deadline per World;
- internal PPW days provide event ordering inside that resolved week;
- players act asynchronously during the open cycle;
- the server, not a player, advances the shared World.

**Required before UI:** introduce World runtime metadata, an exclusive resolution lock and a scheduled worker. The eventual PWA must not contain an “advance the shared World” authority that one player can trigger.

### P0 — persistence schema needs an explicit version boundary

`World.rulesetVersion` versions simulation rules, but there is no separate persisted-state schema version. Several WorldState collections are optional/lazily created, and `promotionTalentTrust` is attached through TypeScript module augmentation.

That is convenient during SIM development but ambiguous once old Worlds must survive deployments.

**Required before first persistent World:** separate `stateSchemaVersion` from the simulation ruleset version, make persisted collection shape explicit, and provide migrations. A live World must not depend on “undefined means old save; create it lazily” as its long-term migration strategy.

### P1 — history and hot operational state are currently one growing in-memory aggregate

The 100-PPW-Year proof already produces approximately:

- 138k matches;
- 1.7m financial transactions;
- 307k Ledger events.

That is excellent evidence for longevity, but it also proves that a hosted World must not require transferring or reloading its entire historical record for ordinary player commands.

**Architecture rule:** current operational state and append/history storage are separate persistence concerns. The API never returns raw `WorldState`. Historical records can remain queryable forever without every command carrying the full history payload.

### P1 — length-based IDs will not survive archival safely

Simulation entities commonly allocate IDs from `array.length + 1`. That is deterministic while all history remains in one forever-growing array, but it becomes unsafe if old history is later partitioned/pruned from the hot state.

**Required before hot/cold separation:** simulation-generated IDs use persisted per-World entity counters (or an equivalently deterministic allocator), not current loaded-array length. Application records may use database-native globally unique IDs; simulation IDs remain deterministic and World-scoped.

### P1 — Routine Continuity temporarily changes `controllerType`

The current Routine Continuity implementation temporarily flips a human promotion to `AI`, invokes the existing AI planner/resolver, then restores it.

This was a good low-risk way to prove staff takeover behavior, but once `controllerType` coexists with real account ownership it must not double as “who is executing this one operation.”

**Required before multiplayer:** staff/continuity execution becomes an explicit execution policy or planner override. Ownership/control state must remain stable while staff temporarily complete unresolved work.

---

## 4. Locked application architecture

### 4.1 Modular monolith

PPW will remain one repository and one coherent product, but with hard module boundaries.

The intended modules are:

1. **simulation/domain** — deterministic wrestling rules and World resolution;
2. **application/commands** — authenticated use cases, authorization, idempotency, locks and orchestration;
3. **persistence** — relational repositories, migrations, snapshots and recovery;
4. **projections/read models** — player-safe views, Attention, World news/history queries;
5. **worker/scheduler** — daily World locks and deterministic resolution;
6. **web/PWA** — mobile-first client;
7. **account/meta** — account-level systems such as future Kayfabe Points and collections.

The application and persistence layers may call the simulation. The simulation must never depend on authentication, HTTP, a database client, React/Next.js, wall-clock scheduling or account-level KP.

### 4.2 Implementation default

Unless testing gives a reason to change it, the technical default is:

- TypeScript/Node, continuing the existing codebase;
- PostgreSQL as the authoritative relational store;
- Drizzle for typed schema/migrations;
- Next.js App Router PWA as the mobile-first web client;
- thin Route Handlers as the initial HTTP adapter into application services;
- a separate scheduled worker entry point sharing those application/simulation packages.

The important contract is the application/service boundary, not the hosting vendor. The HTTP adapter can later move to a dedicated server without rewriting the simulation.

---

## 5. Player identity and promotion ownership

Ownership belongs outside `WorldState`.

Minimum records:

### WorldMembership

- `world_id`
- `player_id`
- joined PPW week / real timestamp
- membership status
- founding/pre-launch status where applicable

### PromotionControl

- `world_id`
- `promotion_id`
- `player_id`
- control start PPW week
- control end PPW week, nullable
- active/inactive status

Database constraints enforce:

- at most one active promotion controlled by one player in a World;
- at most one active human controller for one promotion;
- no co-ownership/shared control.

For ALPHA-1A, “only one human promotion” is a **World configuration/capacity rule**, not a hard-coded simulation invariant. ALPHA-1B increases the allowed human seats without changing simulation ownership semantics.

`Promotion.controllerType` may remain as a simulation-facing control mode/denormalized flag, but the application ownership records are authoritative about *which player* may issue commands.

The current “claim an active Independent” command remains an ALPHA mechanics test helper, not the final new-player flow.

---

## 6. World entry and late joining

The full entry model remains:

- a player normally creates a **fresh Independent promotion** in the existing World;
- an eligible dormant promotion may be rebranded instead;
- entry uses **World Entry Health**, not artificial catch-up equality;
- the founding package is indexed to the current World economy and targets a credible Independent runway (roughly the previously targeted 20–30 PPW weeks);
- several meaningful wrestlers should be realistically attainable through the live labour market, short-date and non-exclusive contracts;
- no premium wrestler is secretly injected for the new player;
- no incumbent history is erased or rubber-banded away.

A late joiner does not enter a running competitive cycle mid-stream. The promotion receives a short **FOUNDING/pre-launch window** and becomes competitively active at a later PPW week boundary.

A player whose company later fails is not Game Over. Once control of the old corporate entity has ended appropriately, the player may later found/assume another promotion while still obeying one-player/one-promotion and anti-exploit rules.

---

## 7. Authoritative World clock and weekly lock

The hosted World clock is server-authoritative.

### WorldRuntime metadata

Persist outside the deterministic wrestling state:

- `world_id`
- current persistence revision
- state schema version
- runtime phase: `OPEN | LOCKING | RESOLVING`
- current real-cycle start
- current lock/resolution timestamp
- last successfully resolved PPW week
- next resolution timestamp
- configured human-seat limit

The real timestamp is operational metadata. It should not be injected into deterministic wrestling calculations.

### Resolution sequence

At the fixed daily deadline:

1. the worker atomically changes the World from `OPEN` to `LOCKING`;
2. current-cycle competitive commitments and human planning state are frozen;
3. Routine Continuity evaluates unresolved mandatory work;
4. AI commitments for sealed competitive systems are finalized from allowed pre-lock information;
5. one authoritative `resolveWorldWeek()` is executed;
6. invariants are checked;
7. current state, history/Ledger outputs and projections are committed atomically;
8. the World enters the next PPW week and returns to `OPEN` with the next deadline.

A unique resolution key such as `(world_id, ppw_year, ppw_week)` prevents double resolution.

If a worker dies before commit, the transaction rolls back and the same deterministic week can be retried. Recovery must never “advance again and hope.”

During the brief lock/resolution period, current-cycle mutating commands are rejected with a clear “World resolving” response rather than silently racing the worker.

A development/admin trigger may resolve a test World manually, but normal players do not own shared-clock advancement.

---

## 8. Command processing and idempotency

The browser never mutates World state directly.

A player command carries at minimum:

- unique request/idempotency ID;
- World ID;
- authenticated player identity supplied by the server session, not trusted from request payload;
- command type;
- command payload;
- expected aggregate/plan version when editing mutable planning state.

Server processing is:

1. authenticate;
2. load World membership and active promotion control;
3. authorize the requested action;
4. acquire the required World/aggregate transaction lock;
5. reject duplicate request IDs or return the already-committed result;
6. revalidate against authoritative current state;
7. execute the application command and simulation mutation;
8. run applicable invariants;
9. append consequential history/Ledger entries and update projections;
10. commit atomically.

A World revision is incremented and returned for freshness/debugging. Destructive edits to stale planning aggregates use optimistic version checks; simple additive commands can be revalidated against the latest state rather than making unrelated players constantly conflict on one global version.

This command boundary is important for iPhone/PWA behavior as well as multiplayer: retries, double taps and poor connections must not create duplicate offers or bookings.

---

## 9. Competitive commitment and privacy

Competitive multiplayer actions must not reward network timing or allow AI to read private player information.

The existing contract engine already resolves same-week competing offers together by wrestler. Preserve that direction.

Locked rules:

- rival salary/contract details are private by default;
- the server filters private information; privacy is not a client-side hiding convention;
- AI is not passed hidden human contract terms simply because they exist in database state;
- competitive final offers/commitments resolve from a pre-lock snapshot/sealed state rather than “who clicked first”;
- specific appearance reservations are server-authoritative and impossible physical conflicts are blocked;
- Service Capacity remains an actual scheduling constraint;
- exact future contract scheduling-priority clauses remain a balance/design detail, but the reservation/priority framework must support them.

The API must therefore expose player-safe DTO/read models, never raw `WorldState`.

---

## 10. Planning model before UI

PPW needs a real planning aggregate before the PWA is built.

### Strategic horizon — up to roughly 52 weeks

High-level intentions. These are not all binding resource reservations.

Examples include intended show weeks/major-event shape, broad market plans and longer-horizon company direction.

### Creative horizon — roughly 12–16 weeks

Closer intentions such as featured talent/title direction and developing programmes. Deep rivalry/storyline simulation is still deferred; this layer initially provides structure without requiring a full narrative engine.

### Detailed horizon — roughly 4–6 weeks

Binding/near-binding show logistics and detailed booking:

- show date/day;
- market and venue;
- ticket strategy;
- wrestler/date reservations;
- match order/types/sides;
- intended winners;
- match intent and planned length;
- championship designation.

Detailed bookings reserve actual calendar capacity. Future injury, contract change or competing availability can mark a plan **at risk** and create an Attention item. A plan may be repaired before its applicable lock; unresolved mandatory work falls through Routine Continuity at the weekly deadline.

### Required refactor of current Alpha commands

The one-shot proof commands evolve into replace/update/cancel semantics before they become public API commands.

In particular:

- unresolved championship designation becomes explicit current state (for example `ChampionshipMatchBooking` or a field inside the booking-plan aggregate);
- the Ledger may record that a booking decision was made/changed, but competition logic may not query the Ledger to discover the current unresolved booking;
- current and future plans must be editable until their relevant lock;
- planning state has its own aggregate version for safe optimistic editing.

---

## 11. Routine Continuity and Stewardship

### Routine Continuity — locked current behavior

At the weekly lock:

- no mandatory show -> no intervention;
- show + complete card -> run exactly as prepared;
- prepared show but unfinished card -> staff complete only the card;
- missing mandatory show -> staff handle show logistics and card;
- intervention is explicitly recorded;
- control immediately returns to the human after resolution;
- absence by itself is not punished;
- the current Alpha rule adds no arbitrary Morale, Trust or financial penalty simply for a Routine Continuity takeover.

Before persistence/multiplayer, replace temporary `controllerType` flipping with an explicit staff-execution policy.

### Stewardship — required for persistent ALPHA-1A

Routine Continuity covers a missed weekly responsibility. Longer inactivity is different.

The application records recent player activity and, after generous warning/grace behavior, may transition the promotion to `STEWARDED` under the established inactivity policy.

Stewardship:

- preserves minimum organisational continuity;
- may sign replacement-level/free talent necessary to operate;
- does not warehouse scarce stars for an absent owner;
- does not receive competitive protection;
- allows Morale/Trust/commitment pressure, non-renewal, negotiated exits, releases and rival buyout routes to circulate talent over time;
- keeps the promotion recoverable if the player returns.

Exact inactivity thresholds are balance/configuration, not a reason to change this architecture.

---

## 12. Human/AI lifecycle parity

The next simulation-facing refactor must separate **state evaluation** from **controller policy**.

For every promotion, regardless of controller:

- finances settle under the same rules;
- distress/runway update under the same rules;
- survival counters advance under the same rules;
- lifecycle thresholds are the same;
- tier/standing/reputation consequences are the same;
- objective Dormancy/closure conditions are not disabled for humans.

Then controller policy differs:

- AI chooses its remedial/restructuring actions automatically;
- a human receives Action Required choices when a genuine strategic decision exists;
- missed strategic deadlines eventually follow explicitly defined default/Stewardship/lifecycle consequences rather than granting immunity.

This preserves agency without giving the human a different economy.

---

## 13. Persistence model

PPW uses a relational database with **current state + append-first history**, not pure event sourcing.

### Authoritative current-state examples

- Worlds/runtime metadata;
- memberships/control;
- promotion current state;
- people current state;
- active/future contracts and current offer state;
- current promotion-market state/standing/trust;
- injuries/current chemistry;
- active teams/championship pointers;
- unresolved/current/future planning records;
- current lifecycle/survival state;
- opportunities.

### Historical/append records

- World Ledger;
- completed/cancelled events;
- completed matches/participants;
- financial transactions;
- ended contracts/offers where retained historically;
- title contests/reigns;
- historical injuries/team membership and other long-lived history.

Nothing in this distinction means history is deleted. It means a command to change next week’s card should not need to load 100 PPW Years of old gate receipts first.

### Snapshots and recovery

Keep periodic/versioned World snapshots for recovery, diagnostics and deterministic validation. A giant JSON snapshot is **not** the only production source of truth.

Before the first persistent World:

- add a separate `stateSchemaVersion`;
- make persisted simulation collections explicit rather than optional/module-augmented save shape;
- provide migrations;
- take a recoverable snapshot/checkpoint before or around each weekly resolution;
- keep the simulation ruleset version separately so schema migration and gameplay-rule migration are not conflated.

---

## 14. ID strategy

World IDs must be globally unique and must not be derived only from the RNG seed. Two Worlds may legitimately use the same seed.

Simulation entity IDs may remain human-readable and World-local, but allocation must eventually come from persisted deterministic per-entity counters rather than loaded-array length. Database keys always include/associate the owning `world_id`.

Application entities such as command IDs, membership IDs and account/meta records may use database-friendly globally unique IDs.

Real wall-clock creation timestamps belong in application World metadata; they must not leak into deterministic simulation outcomes.

---

## 15. Read models, Attention and Opportunities

### Attention Layer — ALPHA-1A core

The player-facing application must answer “what needs me?” quickly rather than exposing raw simulation tables.

Core categories remain:

1. **Action Required**
2. **Important**
3. **Opportunity**
4. **Watching**
5. **World News**

Attention is a projection/read model over simulation/application state and Ledger events. Read/dismissed state is player/account state, not wrestling simulation state.

Items can carry PPW-week deadlines and deep links into the exact command surface that resolves them.

### Opportunities — ALPHA-1A basic framework

Opportunities are distinct state-created openings, with:

- World scope;
- visibility/eligibility rules;
- open/close PPW-week boundaries;
- optional action;
- no twitch/FOMO requirement based on minutes or seconds.

Richer opportunity generation/presentation can expand later, but the record/framework belongs in ALPHA-1A so the UI does not need to be redesigned around it.

---

## 16. Kayfabe Points boundary

Kayfabe Points remain **account-level, non-competitive meta progression**, separate from World simulation state.

KP must not buy:

- wrestlers;
- contracts;
- cash;
- match outcomes;
- injury/recovery advantages;
- promotion upgrades;
- or any simulation power.

The exact KP earning/catalogue economy remains deferred. When implemented, it belongs in the account/meta module and can react to verified World accomplishments without becoming an input into competitive simulation resolution.

---

## 17. ALPHA scope contract

### ALPHA-1A — one human in a real persistent World

Must include:

- one authenticated human player controlling one Independent promotion;
- AI promotions in the same persistent World;
- 1 real day = 1 PPW week server-authoritative progression;
- first-class membership/ownership even though only one human seat is enabled;
- contracts and live talent market;
- editable advance planning with at least the detailed booking horizon functioning and the wider layered model represented;
- show logistics, cards, finishes/intents and singles/tag championships;
- basic tag-team wrestling;
- finances, injuries, markets, Morale, Trust, standing and history;
- human/AI lifecycle parity;
- Routine Continuity;
- basic Stewardship/inactivity behavior;
- persistence, migrations, idempotency, recovery and weekly worker;
- server-side privacy/read models;
- Attention Layer;
- basic Opportunity framework;
- mobile-first PWA.

ALPHA-1A does **not** need multiple human players to prove the architecture, but it must not contain a one-human hard-code inside the simulation that makes ALPHA-1B a rewrite.

### ALPHA-1B — late human joins the existing World

Adds/exercises:

- second authenticated player;
- World Entry Health;
- fresh Independent creation or eligible dormant rebrand;
- founding/pre-launch window;
- late-join activation at a PPW week boundary;
- two simultaneous human command streams;
- privacy between humans;
- sealed competitive commitment behavior;
- shared resolution locking and contention tests.

The simulation itself should need little or no conceptual redesign for ALPHA-1B.

### Explicitly deferred beyond ALPHA-1

Unless a dependency forces a small foundation earlier:

- exact KP earning rates/caps/catalogue/store structure;
- deep factions/stables and advanced divisions beyond basic singles/tag;
- advanced tournaments;
- rich rivalry/storyline engine and alignment depth;
- advanced TV/streaming/PPV/sponsorship simulation;
- rich AI commentary/press generation;
- awards/Hall of Fame/trends/eras;
- full staff delegation system;
- promotion acquisitions/alliances/mergers/sales mechanics;
- advanced collectible-card economy;
- final legend/deceased-unlock rules and legal/licensing productization;
- sophisticated many-player guardrails beyond what ALPHA-1B needs to validate the architecture.

---

## 18. Pre-UI gate checklist

Status after this review:

| Gate | Status | Notes |
|---|---|---|
| Deterministic simulation | GREEN | 100-Year proof/invariants remain release gate |
| Human core weekly lifecycle | GREEN | Contracts, show, card, titles, readiness, Routine Continuity proven headlessly |
| Player/account ownership | RED | `controllerType` is not ownership |
| Human/AI lifecycle parity | RED | Human promotions currently skip survival processing |
| Editable advance planning | RED | Current one-shot/current-week commands are proof implementations |
| World runtime/daily lock | RED | No server scheduler/phase/revision yet |
| Persistence/migrations/recovery | RED | No production persistence layer yet |
| Idempotent command boundary | RED | No authenticated transactional command service yet |
| Privacy/read models | RED | Raw state has no player-safe projection boundary yet |
| Attention/Opportunity foundation | RED | Required before useful PWA |
| Stewardship/inactivity | RED | Routine Continuity exists; long absence behavior does not |
| Mobile PWA | NOT STARTED | Correctly waiting on contracts above |
| ALPHA-1B second human | DEFERRED UNTIL 1A | Architecture must already support it |

A RED gate here does not mean the project is in trouble. It means the review has prevented us from accidentally hiding these requirements underneath UI code.

---

## 19. Required implementation order from here

Do not return to general gameplay expansion yet.

### Gate A — state/control hardening

1. introduce explicit persisted-state schema version and mandatory save shape;
2. remove Ledger-as-current-booking-state;
3. introduce deterministic entity counters suitable for archived history;
4. separate temporary staff execution from human ownership/control;
5. refactor promotion survival into universal evaluation + AI/human policy.

### Gate B — application ownership and command shell

1. WorldMembership/PromotionControl model;
2. one-player/one-promotion database constraints;
3. application command envelope + idempotency;
4. World runtime phase/revision and authorization;
5. replace the ALPHA-1A global-human guard with configurable human-seat capacity.

### Gate C — planning and scheduling

1. editable show/card/title booking state;
2. detailed future planning horizon;
3. date reservations/Service Capacity/conflict validation;
4. at-risk plan detection;
5. hooks for wider creative/strategic horizons.

### Gate D — persistence and worker

1. PostgreSQL/Drizzle schema and migrations;
2. repository adapters around sim-core;
3. atomic command persistence;
4. daily lock/resolution worker;
5. crash retry, snapshots and once-only resolution tests.

### Gate E — player-facing projections

1. privacy-safe read models;
2. Attention categories/deadlines/deep links;
3. basic Opportunities;
4. activity/Stewardship tracking;
5. late-join/founding records ready even while human-seat limit remains one.

### Gate F — PWA

Only after the command/read contracts above are stable:

1. mobile-first shell;
2. promotion dashboard/Attention;
3. roster/talent market/contracts;
4. planning/booking;
5. results/history/industry;
6. installable iPhone PWA behavior;
7. end-to-end persistence/reload/offline-resume testing.

Then ALPHA-1B enables the second human seat and tests the architecture under genuine asynchronous contention.

---

## 20. Architecture acceptance rule

From this point forward, a new ALPHA feature should not be accepted merely because it works in an in-memory `WorldState` test.

For anything intended to become player-facing, we ask:

1. Who is authorized to issue it?
2. Which World/PPW week does it belong to?
3. Is it editable, and until what lock?
4. Is it current state, historical Ledger output, or account/meta state?
5. Is it private or public to other players/AI?
6. Can a retry duplicate it?
7. What happens if the server dies halfway through it?
8. Does it preserve deterministic resolution?
9. Can ALPHA-1B execute the same operation from a second human without changing the underlying rule?
10. Can a many-year World keep doing this without loading its entire history on every click?

If those answers are sound, the UI can safely be built on top of it.
