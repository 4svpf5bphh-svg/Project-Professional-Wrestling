# PPW — Standing Programme Creative Talks in Backstage

Development-only draft, 11 October 2026. Based on passed PR #26 / CI #905. No merge, preview, deploy or World reset.

## One source of authority
- Backstage lists active Programmes and wrestlers whose signed effective contract includes FULL_APPROVAL. A promoter chooses win-only or wins-plus-protected-losses for 2, 4 or 6 PPW weeks.
- The request uses the existing server-authoritative REQUEST_STANDING_PROGRAMME_CREATIVE_AGREEMENT command, not a new simulator. Ownership, refusal, exact terms, deterministic acceptance and World Lock are all checked there.
- The negotiated decision is recorded in the existing promotion-private Backstage conversation history with frozen terms, Programme label and expiry. Consent authority itself remains in WorldPlanningState, not conversation dialogue.
- Subsequent attempts with a new request ID or changed terms cannot reroll a refusal. Identical retries are idempotent, with no duplicate history or additional world revisions.
- Player-initiated discussions do not consume the weekly organic Backstage conversation limit.
- Discussion never books a match, result, character, contract or angle. Only player-authored booking determines scripted wrestling.

## Mobile-first presentation
The first screen has tap-friendly reply options and shows a deterministic wrestler response in Backstage history. The eventual phone-like inbox with headshots, persistent conversational chat bubbles, unread counts and contextual reply chips remains the larger UI polish wave, recorded in docs/BACKSTAGE-MESSAGING-UX-DIRECTION-2026-10-11.md. No second relationship engine.

## Tests and remaining gates
- Repository integration for owner privacy, approved and declined talks, persistence, no duplicates, refusal cannot reroll and World Lock.
- Application, Backstage, web build, HTTP/PostgreSQL and 10-year sim CI required.
- Offer economics, permitted creative-control clauses in contract screens, AI balancing, rich history, merged release and reset/deployment remain deferred.
