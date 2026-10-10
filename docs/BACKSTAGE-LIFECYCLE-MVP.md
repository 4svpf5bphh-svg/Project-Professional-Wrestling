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
