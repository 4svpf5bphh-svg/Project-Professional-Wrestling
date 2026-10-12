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

## Locked extension: entrances, debuts, returns, packages and purposeful angles

This is a **design requirement**, not functionality delivered by PR #55. PR #55 still maps only the 14 currently supported types. Extend it through typed, validated gameplay changes instead of showing options that do not yet work.

### Shape: purpose → format → script → consequences

- First choose the **story goal** (introduce someone; build anticipation; build character; heat a rivalry; announce stakes; surprise the audience; pay off a story).
- Then choose a **format** (live appearance, video package, in-ring promo, confrontation, backstage scene, ceremony, post-match incident, etc.).
- Next choose an appropriate **subtype**, participants/subjects, planned timing, reveal level, on-screen outcome and desired audience feeling.
- The World resolves **how convincingly** it landed, not whether the player-selected appearance or scripted response occurred. Narrative Results must describe the verified beat rather than quoting calculation weights.
- Avoid a single exhaustive dropdown or duplicating formats that are just variations of the same underlying system.

### New segment family: live introduction / appearance

Add a real **LIVE_APPEARANCE** typed segment (name subject to UI polish) with subtypes:
- **In-person debut**: public introduction of a wrestler's first on-screen appearance **for this promotion**, not first-ever career appearance.
- **Return / comeback**: wrestler comes back after a meaningful absence from this promotion, including but not limited to injury-related absence.
- **Surprise reveal**: reveal an established signed person live, including as a mystery entrant, without deciding an unscripted match result.
- **Non-wrestling appearance**: appearance, announcement or entrance that introduces someone without a match.
- **Intervention / save** belongs with established Attack/Rescue/Interruption logic if it is the core storyline act; do not create an incompatible parallel execution path.

Possible scripted objectives: establish a star, introduce a new persona, excite fans, unsettle a rival, build sympathy, generate heel heat, reignite a Programme, or reveal a surprise. Player chooses whether there is an introduction, interruption, confrontation, accompanying ally and scripted outcome (where applicable).

Invariants: a wrestler must be signed/bookable and able to make an on-screen live appearance on that date. Do not silently sign a free agent. An on-screen live appearance participates in event reservation, capacity, contracted appearance/date consumption and availability checks. The *debut* label is promotion-relative, using verified appearances/history; the *return* label should require a meaningful promotion-specific absence (exact threshold is tunable later), never fabricate an injury. If a wrestler already wrestles earlier on the same card, the segment should not incorrectly claim the same-night appearance is their first reveal. Use one unique person, not duplicate World identities.

### New segment family: video package

Add **VIDEO_PACKAGE** with subtypes that share the same media format and differ in script/intended effect:
- **Debut teaser / coming soon**: announce or cryptically tease a confirmed future arrival.
- **Return teaser**: announce or hint at a wrestler's comeback.
- **Wrestler spotlight / character vignette**: explain a persona, history, style or motivation.
- **Rivalry recap / feud hype**: contextualise recent beats and set stakes.
- **Upcoming match / premium-event hype**: advertise a booked or plausible future match/show; cannot falsely advertise one as confirmed.
- **Training / recovery montage**: build anticipation without inventing recovery dates or changing injury status.

Suboptions: subject(s), programme or upcoming event link, tone (ominous, triumphant, intense, emotional, cryptic, etc.), reveal level (anonymous tease, silhouette, named reveal, full footage), intended objective (create intrigue, build sympathy, highlight threat, recap stakes, raise anticipation), and approximate duration. An anonymous teaser must not expose hidden future contract details to rivals or players.

Critical modeling separation: a **video subject** is not automatically a **live event participant**. Pre-recorded footage must not consume an on-site booked date, increase live talent reservations, invent an in-person appearance/debut, or grant a live segment's backstage exposure. Future media-rights, footage recording, production quality and cost are separate considerations, not unearned simulation advantages. For the first complete version, restrict confirmed talent-specific promotional videos to subjects whose footage/usage eligibility is verifiably authorized by the player promotion; no showing an unsigned wrestler as a confirmed signing.

### Other missing families/angles to review

- **Backstage vignette / scripted scene** (character-building skit, discovery, secret meeting, alliance tension), distinguish live performers from pre-tape.
- **Announcement** (GM/authority decision, tournament reveal, championship stipulation, upcoming match), with validity checks against real championships and planned events.
- **Ceremony** (title presentation, retirement tribute, Hall of Fame/recognition, homecoming), distinct from a generic celebration.
- **Injury/medical update** that reports actual health/availability rather than causing or curing injuries.
- **Open challenge / mystery-opponent reveal** built on challenge/match bookings; no surprise talent outside shared-world availability.
- **Faction introduction / betrayal aftermath**: extend existing stable and Turn mechanics, don't duplicate them.
- **Press conference / face-to-face / signing** can be specialist presentation choices built on existing directed outcomes.

These are a prioritized **candidate catalogue**, not commitments to ship each as a separate primitive. Evaluate user value, simulation meaning, and overlap before adding them.

### Suggested delivery slices

1. Implement **VIDEO_PACKAGE** with debut/return/spotlight/feud/match subtypes and an explicit *subject vs present performer* model, tested end-to-end. It can run without a live wrestler/date if only permitted archived footage is played.
2. Implement **LIVE_APPEARANCE** debut/return/reveal with promotion history, availability/date usage, World Lock and results verification.
3. Expand backstage, announcements and ceremonies only where their script/state consequences are distinct from the existing 14 segment types.
4. Join packages and appearances into the same show-story ledger so post-show reporting and future AI journalism can accurately distinguish a teaser from an actual arrival.

Required full chain for each: domain schema/versioning → card editor → authoritative request validation → persistence → materialization/roster/date rules → deterministic scoring/resolution → written ledger event → programme/relationship consequences → Results report → focused tests and longevity audits.
 
## Four-question rule
- **Depends on:** existing unique wrestler identities, signed card reservations, Programme history, World Lock, creative control, 14 typed segment formats and deterministic engine.
- **Downstream consumers:** show Results, narrative press, Trust/Morale, storyline heat, promo statistics and long-lived wrestler histories.
- **Simulation vs presentation:** typed intent and scripted outcome are persisted/authoritative; category tiles, prose hints and visual grouping are presentation. Later AI may describe settled outcomes only, never judge or create them.
- **Smallest complete version:** one coherent authored promo-purpose choice with saved roundtrip, deterministic match/context-sensitive reception, private test fixture and narrative ledger record. No partial UI-only scoring claims.

## Release conditions
No launch until unit tests, application/card persistence tests, HTTP, PostgreSQL and long-run simulations pass on the combined stack with Contracts #52; no production changes during the player's live test.
