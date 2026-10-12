# PPW Segment Authoring — Story-First Foundation

Status: **Draft PR #55; no deployment.** Based on the completed Card/Quick Book work in PR #54. Do not merge or deploy during current playtesting.

## Player intent
A promoter books a **scripted moment**, not a generic score bonus. The player decides what happens on screen; wrestlers may negotiate under their creative rights, and the simulation evaluates crowd response, delivery, and consequences without inventing different outcomes.

The story-goal selector is intentionally **presentation-only**. Its five groups map one-to-one to all 14 existing supported formats. Changing the goal calls the existing type-change workflow. Persistence, validation, and World resolution remain authoritative.

## Next slices, each integrated end-to-end

1. **Promo & Interview purpose.** Add a typed authored purpose such as self-promotion, respond to criticism, call out an opponent, champion's address, defiant response. Choose only variants whose outcomes can be represented without inventing dialogue or altering an existing Programme. Required chain: domain schema (backward-compatible optional value) → Card request validation → draft persistence/projection → normalized segment → resolved ledger → contextual reception → qualitative result narrative → tests.
2. **Celebration and Confrontation logic.** A celebration may reflect an achievement, boast or bait an opponent; a confrontation has initiator, target and who gets the better of the exchange. Booked story outcomes must be immutable under resolution; role/alignment/story history affect *reception*.
3. **Continuity and repetition.** A hot programme can add stakes, but repeating the identical segment format for the same performers should eventually cool the crowd. Protect fresh angles and quiet weeks. Never show the scoring weights in public Results.
4. **Story payoff and aftermath.** Persist meaningful links from segment moments to Programme activity, backstage memory and show recap. If a segment is removed or revised before lock, no phantom consequence survives.

## Four-question rule
- **Depends on:** existing unique wrestler identities, signed card reservations, Programme history, World Lock, creative control, 14 typed segment formats and deterministic engine.
- **Downstream consumers:** show Results, narrative press, Trust/Morale, storyline heat, promo statistics and long-lived wrestler histories.
- **Simulation vs presentation:** typed intent and scripted outcome are persisted/authoritative; category tiles, prose hints and visual grouping are presentation. Later AI may describe settled outcomes only, never judge or create them.
- **Smallest complete version:** one coherent authored promo-purpose choice with saved roundtrip, deterministic match/context-sensitive reception, private test fixture and narrative ledger record. No partial UI-only scoring claims.

## Release conditions
No launch until unit tests, application/card persistence tests, HTTP, PostgreSQL and long-run simulations pass on the combined stack with Contracts #52; no production changes during the player's live test.
