# PPW first 26 weeks — player-owned indie service-path baseline
**Date:** 11 October 2026
**Status:** protected draft stacked after green finance attribution PR #40 / CI #939. Do not merge, preview, deploy, or reset the user's playable World.

## What this baseline actually exercises

Two isolated real-roster PPW Worlds are created through **the same persisted Alpha bootstrap as the player-facing app**. A human account explicitly claims one of the five takeover-eligible Independent promotions. Each of **26 consecutive PPW weeks**, the scenario:

1. Reads its authoritative current World and player session.
2. If a promotion show is due, attempts an actual **server-side Current Booking show-plan reservation** selecting the home market, venue, ticket-price strategy and a practical even number of active same-division wrestlers with purchased dates remaining.
3. If the reservation succeeds, saves a complete **scripted singles match card**, with deliberate order, participants, intention, winner and duration, using the same Web Card service as iPhone players.
4. Resolves the week through **`advanceAlphaWorldWeek`**, which goes through server World Lock, materialization and the shared simulation. No manual calls to the match engine, forged appearances or private cash edits.
5. Records every failure to reserve, prepare a card or resolve World Lock; reads actual event outcomes, staff continuity takeovers, retained cash, roster sizes and transaction categories.

Seed 94271 keeps its independent promotion with **ACCESSIBLE** tickets; 94272 keeps another independent with **STANDARD** tickets. Both retain their seeded rosters and initial financial positions. The World continues to contain real WWE/AEW/NJPW/TNA/ROH/STARDOM/CMLL/NXT context and AI rivals.

## What it doesn't establish

- This **first baseline intentionally does not recruit or renew talent**, inject cash or change show calendars. It measures how far a new owner gets using inherited contracts alone, and exposes when insufficient purchased dates undermine future bookings. The follow-up must add normal negotiations, same-contract date purchases, wrestler consent and staff decisions to mirror an engaged player.
- These are scripted test strategies, not a survey of individual players' preferences. Two seeds are not enough to justify balancing all indie finances.
- Each test company only authors a primary due event in the lightweight current-week UI. Multiple due show-series occurrences in one week may require fuller future planner support and are counted as staff takeovers, not falsely credited to the player.
- If the normal **user-triggered** World Lock is blocked by creative consent, the scenario records the block and stops. It does **not** bypass consent via a private resolver or pretend that shows progressed.
- Negative cash, bookings lost, early stop, and caretaker intervention appear as **observational warnings**, not an automatic failing policy threshold. The baseline fails CI only for an inconsistent World invariant or a code-level failure before producing the report.

## Evidence and release rationale

This is the explicit second acceptance gate identified after PR #39 and #40. Financial attribution proved the losses were real and explained: weekly deficits, unprofitable shows and signing bonuses. Before changing production salaries or income, collect evidence from **an actual human-controlled persisted World** for the previously agreed 20–30-week survival target.

Execution: `npm run build && npm run audit:human-indie`. Full JSON: `artifacts/human-indie-26week-audit.json`, archived by CI. Run independently of the public playable World; this is **not** a deployment or World reset.

## Dependency mantra

Depends on server-authenticated promotion ownership, current-week planner, match card, signed appearances, World Lock and post-event finance. Later recruitment advice, staff, show scheduling and realistic indie onboarding depend on the findings. User-facing booking choices and actions are modelled through the public service while execution remains server authoritative. The smallest complete initial version is 26 weeks of legitimate roster-only bookings with honest blockers and no artificial AI advantages.
