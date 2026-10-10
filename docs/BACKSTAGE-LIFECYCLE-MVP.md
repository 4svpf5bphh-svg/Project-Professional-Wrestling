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
