# PPW — Show Results Wave 2: authoritative finishes and cheating
13 October 2026. Draft branch stacked directly on PR #73. **No merge, deployment, migration or World reset.**

## What changed

- Two distinct **player-authored finishes**: `DISQUALIFICATION` (opposing/losing side caught cheating, intended winner gets the match) and `FOREIGN_OBJECT` (referee misses the illegal object and the intended winning side gets the victory).
- A tag finish attributes the outcome to a **side**, not an invented individual attacker. DQ and successful run-in cannot be simultaneously booked because run-in resolution otherwise changes `actualFinish` to `PROTECTED_FINISH`.
- The engine records the actual performed finish in the completed match and immutable `MATCH_COMPLETED` ledger. Serious injury to the booked winner may still cause an `INJURY_STOPPAGE`, an existing documented exception. The sim never randomly changes authored DQ to foreign-object or vice versa.
- **Championship rule:** winning by disqualification never takes a reigning champion's title; the champion retains it even when losing the match. A vacant championship cannot be crowned by DQ. A recorded foreign-object victory can change hands / crown a champion if title matches are otherwise legal. This derives from `actualFinish`, not planned intent.
- Private and public show results project the real recorded finish, preferring immutable completed ledger evidence. Historic matches with no finish evidence return `null`, not an invented pin/submission. Public projection exposes only public completed wrestling results.
- Distinct finish replay band with real wrestling vocabulary, recorded-cheating highlights, and preserved winner / rating / interference / title consequences. No made-up weapon type, referee name, specific tag attacker or play-by-play.
- AI baseline match finish distributions remain unchanged. New scoring adjustments apply only when these newly selected finish types occur, to avoid unexpectedly altering long-run baseline simulations.

## Dependencies / contract

1. **Depends on:** player-authored Card `plannedFinish`, persisted match result `actualFinish`, actual winner side, immutable match completion, title contest logic, owner/world result projections.
2. **Later depends on this:** richer stipulation-specific endings, named cheating participants, actual weapon-choice storytelling, a dedicated immediate post-show reveal, media commentary.
3. **Simulation vs UI:** authority determines booking choices, allowed combinations, winner, actual finish and real title-holder consequences. Public copy, colours, highlight priority and replay layout are **presentation only**.
4. **Smallest complete version:** a legal authored DQ and foreign object victory work from Card -> validation -> materialization -> resolution -> title logic -> private & public replay; old records remain honest.

## Tests / verification

- Browser Card end-to-end resolution of both finishes and immutable ledger.
- Private/public projection parity; no invented finish on historical records.
- Empty-belt DQ no crown, existing-belt DQ no title transfer despite match loss, dirty win may crown.
- Full application, web build, API/HTTP, Postgres and deterministic long-run CI to be verified on exact branch head.

## Deliberately deferred

We should not yet pretend to know which tag wrestler used a weapon, which particular item was used, or which finisher was hit. Future booked-level performer / weapon choice could support these details if captured immutably. Also defer double DQ, no-contest, ropes/feet-on-ropes and count-out pending rule review.
