# Backstage conversation lifecycle — first usable slice

## Why this exists
After the booking audit and contract-role evidence, the first Backstage conversation type is a grounded **role-usage concern**. A wrestler with a current main-event/upper-card contract can raise an issue after at least four actual completed in-ring appearances within twelve PPW weeks without the promised featured position. Mere unbooked dates, scripted losses, and stable exits do not trigger a grievance.

## Lifecycle
- World Lock determines facts; a persisted World transaction creates the conversation from resolved booking records.
- Stable ID per source contract and type prevents repetition on retry or successive weeks. Older records are not backfilled on player login.
- The home Attention panel shows an IMPORTANT deep link to Backstage; it is deliberately *not* an ACTION_REQUIRED blocker. Normal World progression and prebooked shows remain unaffected.
- Backstage exposes the request and three first-version replies: **Hear them out**, **Explain your current plans**, and **Stand firm**. A player response is an idempotent, world-authoritative command. The original concern and answer remain in history.
- Responses do **not** create promises, apply morale/trust changes, change contracts or alter scripted wrestling. Delivery-driven promises and later consequences will be separate waves, with clear follow-up evaluation.
- Private conversations are only readable/actionable by the human controller of that promotion; rivals see none.
- No AI inference or forced modal. There may be quiet weeks.

## Dependencies/future hooks
Source: contract-specific appearances, match results, role expectation and Home Attention.
Consumer: future promise tracking, human consequences, relationship and trust state, and later richer dialogue/UI.
Authority: persistent engagement state plus idempotent application commands.
Presentation: Backstage area and Attention deep links; no simulation authority in React.

## Deliberately deferred
Multi-type creative suggestions, interpersonal disputes, scripted-character pitches, staff delegation, graded response impact, time-limited follow-ups, persistent promise obligations, roster personality adaptation, balance caps for a large world and AI dialogue. Do not infer that answering "Hear them out" automatically makes the wrestler happy.

## Attention pacing

A promotion receives at most one new Backstage conversation per PPW week and holds at most three unanswered conversations from this generator. Limits apply even if the player replies during the same week. Eligible candidates are ranked deterministically by actual completed matches, promised role, then contract ID. Deferred requests are reconsidered later, never fabricated as already created and never auto-answered. The limit is per promotion, not a global first-player advantage.

## Explicit booking promises — follow-through read model

A fourth choice, **Promise a featured match**, must pass server-side eligibility: same active promotion contract, an unused contracted appearance, and at least another PPW week to book. This creates a durable commitment to a suitable featured match within four PPW weeks or by contract end if sooner. Other replies do not create promises. The promise is measured only against completed matches under the same contract at the expected position, not against promos, appearance lists alone or AI-scripted outcomes. The first completed suitable match fulfils it; otherwise after the deadline it is recorded as not delivered when shows occurred, or as no opportunity when none occurred. Resolution is deterministic and idempotent. History and a dismissible Home follow-up retain the outcome. **These factual statuses do not yet change morale/trust**; injuries, contract disruptions and absence fairness need a separate consequence policy before tuning such effects.

The four-week deadline covers **every show day of the fourth PPW week**, not just its Monday; an earlier contract end date still takes precedence.

## First consequence policy — small, accountable, auditable

A separate post-resolution pass now assesses **player-authored** promises. There are **no bonus trust/morale points for logging in, talking, or delivering what was already promised**. An unexcused missed featured booking (completed promotion show(s), no delivered featured position, active human controller) applies a *single*, bounded drop in promotion–wrestler trust (2–4 points depending on the wrestler's pre-existing role priority) and 1 point of wrestler morale. The exact **actual** applied deltas, reason and assessment date are persisted with the promise, not inferred afresh on page load. Repeat World resolution, screen refresh and retries cannot stack the penalty. No negative effect for unanswered concerns, declined promise options, delivered promises, or no completed show.

The first conservative exemptions are a documented injury overlapping the promise window, terminated/missing contract, unavailable/retired wrestler, no current human promotion controller, or an owner whose promotion is under AI stewardship. In those cases a missed promise is marked **EXCUSED** rather than blaming the booker. This distinguishes authoring a booking from the multiplayer World's asynchronous operation, and does not rewrite match outcomes. Fine-grained scheduling disruptions and temporary availability will need additional separate evidence before the policy becomes harsher. Contextual reasons appear in Backstage and Home.

## Morale/trust overlap audit (2026-10-10)

Weekly wrestler morale already responds to show usage and missed appearances; annual talent trust is promotion-specific and uses completed appearances and contract disruptions. Adding a separate global morale hit for the same missed booking would double-count that evidence, especially with multi-promotion contracts. The Backstage consequence remains a 2–4 point, one-time promotion-specific trust reduction for an explicit and unexcused broken word. The extra global -1 morale is removed; persisted moraleDelta remains 0 for new decisions. No free bonuses for responding or keeping a promise. Existing base morale/trust algorithms and deterministic sim hashes stay unchanged. Annual trust smoothing may attenuate this discrete signal; balance it later rather than amplifying it now.

## Positive creative proposals — tag team pitch

Backstage can now offer an optional tag-team pairing idea based on two or more completed, well-received tag matches together on the same side in the same promotion within the recent 12-week window. Both wrestlers must be contracted and have available dates; established active tag teams are excluded. The proposal freezes their identities, actual sample size and average crowd response, shares the existing per-promotion weekly and unanswered limits, and appears in Home Attention. The player can Explore the pairing or Not right now. Neither reply mutates tag memberships, contracts, morale, trust, scripted decisions or match outcomes. The Tag Teams management screen is offered as a manual next step. Other pitches and positive relationship updates are deferred until their evidence and player-choice model are specified.

## Scripted rivalry proposal (2026-10-10)

A second optional creative pitch proposes a **scripted on-screen rivalry** between two active contracted wrestlers who completed at least two singles matches opposite one another in the latest 12 PPW weeks, average crowd response at least 70, and have an existing working relationship with professional trust of at least 60. Verified completed appearances from each wrestler's contracted dates are required; no invented chemistry or simulated personal feud. Existing active Programmes between the pair prevent a redundant pitch. The pair gets one stable ID for its proposal, is bounded by the shared per-promotion weekly/inbox limits, and is private to that promotion's controller. Reply choices are Explore the programme or Not the right feud. Responses never book, accept, reject, betray, turn, or otherwise write in-ring or narrative outcomes. There are no stat bonuses for replying. The Programme creator remains the only mechanism for booking a feud.

## Passive locker-room good news

Not every Backstage item asks the booker for a decision. **TEAM_MOMENT** records a positive relationship update for an *existing active team*, after two verified well-received tag matches in the recent 12-week window, TAG working-chemistry familiarity, and professional trust of at least 60. It starts in **NOTED** status and has no response command or deadline. Home shows a dismissible WATCHING alert; Backstage retains the persistent note. The team and wrestler roles are never mutated, no bonus is awarded for being online, and at most one such item may exist per team per PPW year. Good news shares the per-promotion weekly creation cap and is the lowest priority, behind genuine concerns and optional creative proposals.

## Wrestler-led character repackaging proposals (2026-10-10)

**GIMMICK_CHANGE_PITCH** is generated after World Lock only for an actively contracted and currently bookable wrestler with at least four verified, completed in-ring match appearances under **that promotion's exact contract** in the last 12 PPW weeks and an average match crowd response at or below 55/100. No appearance-only, simulated personal disagreement, injury, other promotion's match, or show without a real completed match qualifies. The wrestler must have been with the promotion or current presentation for at least six PPW weeks; recent manual character changes suppress immediate new requests. A conservative deterministic *suggested direction* is derived from the wrestler's current presentation and skills and frozen with the actual match count/average; the score **does not prove** the gimmick is why the crowd is cold. A stable ID per source contract prevents repeated pitches even if declined. Existing per-promotion caps remain: one new conversation per PPW week, at most three awaiting replies, with more consequential role requests considered first. The player can **Explore a repackaging** or **Keep the current gimmick**; neither option mutates character data, results, stats, morale, trust, contract rights, or world simulation. The wrestler's promotion-scoped profile editor is the sole place to commit a gimmick change. A real segment and AI narrative connection remain deferred until there are explicit authoring choices and grounded result packets.

## Wrestler personality and microphone foundation (development branch, 2026-10-10)

A separate read-only **microphone ability (0–100)** now appears on every wrestler profile alongside a compact **backstage temperament** and two *top existing motivations*. This is a first modelling foundation for richer character requests and eventual structured AI promos/results. The six existing contractual priorities remain the source of motivations; they are not duplicated as new stats. Temperaments are explicitly fictional in-game tendencies, never assertions about public wrestlers' real personal lives.

Two optional, shareable fields on the world Person schema allow curation per wrestler in future: `microphoneAbility` and `backstageTemperament`. Existing saves never need migration/reset: a seeded-by-ID estimate derives a separate microphone rating from existing presentation and craft scores plus fixed variation, while a deterministic temperament uses contractual priorities plus fixed variation. The UI distinguishes CURATED from ESTIMATED/DERIVED. Neither the seed fallback nor any view builder modifies authoritative World state. These values do *not* yet alter match/segment scores, wrestler acceptance, contract negotiations, cash, match outcomes, morale, trust, or whether scripted events occur. Player editing, long-term trait development, staff scouting and AI promo voice are explicitly deferred.

## Persona-driven Backstage dialogue (development, 2026-10-10)

The player-private Backstage projection now adds a read-only, deterministic fictional dialogue line. Content is built from the same immutable conversation evidence and the wrestler's derived/curated **in-game** temperament and top existing motivation. Six temperament opener families with stable variants, five conversation-specific facts, and motivation-specific closing lines make staff and wrestlers sound less uniform while keeping the number of interactions capped. The speaker's latest descriptor can influence presentation, but does not add choices or events, change who was involved, infer real-life personality or modify match results. A missing wrestler receives a neutral factual line. The tone is independent of wrestler mic performance; mic ability is a future input to promo presentation, not how someone speaks in a private conversation. Future persisted voice snapshots and AI-written dialogue remain deferred.

## Individual creative interests (development branch, 2026-10-10)

Each wrestler has two read-only, fictional creative interests derived from their existing priorities, microphone estimate and fictional temperament: **team partnerships**, **story rivalries**, **character reinvention**, or **promo spotlight**. These are not real-life psychological claims, not powers or new permanent ratings, and no save migration is needed. The model creates reproducible interests for player profiles and prioritises evidence-eligible backstage pitches; it cannot create outcomes or override the booker's scripted decisions. When choosing who speaks for an already verified pairing, the stronger relevant creative interest wins a deterministic tiebreak. Do not mistake a generated preference for the wrestler actually accepting, joining, turning or agreeing to any booking.

Creative pitch speaker selection now uses the participants' deterministic in-game interest in teamwork or rivalries rather than sorting wrestler IDs. The candidate pitch priority considers evidence-eligible crowd response, speaker interest, and **existing** trust or tag familiarity (unknown values remain unknown), but the original real-match threshold and one-per-week/three-open capacity remain intact. Optional contextual fields freeze the reasoning on each generated pitch. A tag pairing must be an actual two-person match side; filtering out an ineligible third member must never fabricate a team. A gimmick-repackaging archetype and relative priority similarly reflect individual persona/creative interests while still requiring real weak crowd-response evidence. No AI-generated consent, wins, programme creation or match-strength benefits follow.

## Backstage working-history continuity (development, 2026-10-10)

Each *new* Backstage conversation now freezes a promotion-scoped continuity snapshot when the existing server-authoritative conversation is created: prior answered interactions from **that same wrestler under that promotion**, their most recent *creative* consider/pass decision, and prior verified successful-tag moments for the same pair. Replies after a pitch (or in a rival promotion) must never retroactively change the original context. The current Backstage line may refer only to that frozen history; it must describe `CONSIDER_*` as interest in an idea, **never consent, booking, creation of a team, or a scripted turn**. The wrestler's profile privately exposes up to eight recent Backstage records with their actual answer and named counterpart. Older Worlds/conversations need no reset; their missing historical snapshot remains absent rather than retroactively inventing it. This is read-only authorial continuity, not an extra trust/morale economy. Future consequential follow-through requires separate, consent-respecting booking evidence.

## Creative idea follow-through, player-authored evidence (2026-10-10)

Following a **CONSIDER** reply, PPW records factual evidence of follow-through only when the player subsequently books a completed two-person tag match (same promotion and correct source contract), creates an opposing-person Programme in that promotion, or edits that wrestler's ring name, gimmick archetype or gimmick description in that promotion. A move-name-only edit does *not* pretend to be a repackaging; an offer, idle click, response or uncompleted match does not count. A small at-response baseline excludes prior actions, including ones already on the same PPW day. Older saves without baseline only credit events on later dates, never ambiguous same-day history. Follow-through is a one-time, promotion-scoped, immutable factual record visible in Backstage; it is NOT a guaranteed promise, team formation (a tag match is just a match), creative consent, trust bonus or match-strength change. The existing simulation already evolves partnership familiarity and chemistry from match resolution. No double reward.

The UI shows the real follow-through explicitly on the Backstage conversation and the wrestler's private working-history card. It is a factual milestone rather than an automatic character/story change. The matching baseline stores only already-completed same-day matches because matches from older dates cannot satisfy the response date; this bounds save size across long-running Worlds.


## Verified professional partnerships: first relationship-evolution rule (development only)

After completed-show results have been frozen inside the persisted World Lock,
two distinct, completed, adequately executed TAG shows featuring the *same
two-person side* in the past twelve PPW weeks can improve fictional professional
working trust by at most 0.8 points (capped at a conservative 75 for automatic
growth) and pair familiarity by at most 2 points. A qualifying match in the
currently resolving week is required. Both human and AI promotions participate
under the same World-wide eight-week cooldown per pair; booking multiple shows
or booking the same pair across promotions cannot bypass this cap. A pair without
seeded personal history starts with a neutral 50 professional-trust baseline,
not an invented friendship. Each change is recorded as an immutable, sourced
World ledger event with its actual applied deltas.

This pass does not alter affinity, rivalry heat, friendship/alliance tags,
chemistry, promotion trust, morale, contracts, cash, in-ring ratings, scripted
winners or story results. Badly executed matches are not automatically
personal grudges. The owned wrestler profile exposes the most recent factual
professional-respect development. Historical saves are not backfilled, and
reads/retries cannot apply rewards. Full negative interpersonal consequences
require independent evidence and separate balancing; this is only the first
bounded positive working-cooperation consequence.
