# PPW Segment Depth and Variety Audit — 13 October 2026

**Status:** development only; do not merge, deploy or reset. Builds on draft PR #64 (live arrivals and factual Results).

## Design standard

The booker chooses **what happens** in a scripted wrestling segment. The simulation evaluates **how convincingly it lands**; it never changes scripted outcomes, sides, promises, gimmicks or rosters. Keep the everyday UI small and readable on iPhone, with meaningful optional depth rather than a giant form. Story goals are the first choice, with specific booking options within the chosen type.

## Existing types: gaps after live arrivals

| Segment | Existing authored decisions | Distinct next need |
|---|---|---|
| Promo | participants, minutes, programme; now explicit message | Message variety and honest history-based repetition (this slice) |
| Interview | participants only | Format/subject and an actual point to the interview, without duplicating promos |
| Celebration | participants only | Occasion and on-screen ending; do not assert a real title win that didn't happen |
| Confrontation | initiator and target | Scripted stand-off ending, without inventing a challenge or attack |
| Interruption | initiator, target, four scripted results | Context and motivation; avoid duplicating confrontations |
| Challenge | challenger, target, response | Later: meaningful challenge stakes without auto-booking a match |
| Contract signing (kayfabe) | two roles, outcome | Later: consequences for promised kayfabe stipulations, not actual employment |
| Attack | attacker, victim, format, goal | Later: credible rescue/aftermath dependencies; no auto injury |
| Rescue | attacker, victim, rescuer | Later: rescued party reaction and credible scripted ending |
| Post-match assault | real source match, aggressor and victim | Later: differing assault format and intent without altering match result |
| Turn | person, direction, betrayal target | Already consequential; avoid extending until there is a clear missing booking choice |
| Stable invitation, exit, reconciliation | named existing stable and scripted responses | Maintain history integrity before adding micro-variations |
| Video package | subtype, objective, reveal, non-live subject | Already built; review only on testing |
| Live appearance | debut, return, reveal, intro and objective | Already built/audited through draft #64 |

No need for 40 mechanically synonymous segment types. A small palette of distinct choices inside an existing type gives more varied authored stories.

## This slice: five purposes for PROMO

- **Statement of intent:** introduces or reinforces a wrestler's direction.
- **Boast:** establishes arrogance or dominance through speech, with a heel-fit advantage.
- **Rally fans:** reaches for audience support, with a face-fit advantage.
- **Air grievance:** gives a wrestler a believable reason for resentment; a linked feud improves reception.
- **Issue warning:** signals danger and raises existing stakes; remains distinct from a directly addressed CHALLENGE.

Selecting a purpose is a booking choice, never random. Promos remain possible without a programme, but some content is more effective with established context. The performer, length and attached programme are authoritative; historical Worlds whose promos lack this new field continue to behave as generic legacy promos.

### Anti-repetition without punishing a normal weekly promo

Only **completed, frozen, physical show-segment ledger events** count. Penalise the same participant delivering the **same purpose** for the **same promotion** in the previous **six PPW weeks**. No cross-promotion penalty, no penalty for a different speaker or purpose, no penalty for a draft/video/booking that never happened, and no penalty for material beyond the window. Saturate the fit penalty (maximum 3.5) rather than make promos unviable. This influences crowd reception only, **not** the promoter's chosen story, script or talent eligibility.

Repeated wording and natural-language headline variety are separate presentation/narrative work. This pass introduces no random text templates or invented character actions.

## Dependency test

1. **Depends on:** existing typed Show Card, World Lock completion, frozen segment ledger, wrestler alignment and Programme heat. Existing legacy promo data remains valid.
2. **What depends on it later:** interviews, celebrations, performance narratives, crowd-news writeups, the larger Results overhaul, and genuine message evolution.
3. **State versus presentation:** `promoPurpose` and actual completed `SHOW_SEGMENT_COMPLETED` records are authoritative World/application state; picker labels, summaries and Results labels are presentation. Repetition is deterministic from completed history at resolution and its resulting modifier is frozen.
4. **Smallest complete slice:** five meaningfully different purposes on existing PROMO, save/reload validation, immutable outcome and mild same-message fatigue with regression coverage; no migration, new currency or UI navigation changes.

## Next sequence

1. **Interview:** define non-overlapping interview formats and story motivations, with clear participants and controlled on-screen outcomes.
2. **Celebration:** check whether the occasion is supported by real championship/match history, but allow fictionalized kayfabe arrogance with explicit distinctions.
3. **Confrontation/Rescue/Aftermath:** finish the gaps where a promoter cannot fully script how a segment ends, avoiding overlaps with already distinct Attack, Interruption and Challenge.
4. **Cross-segment repetition and variety audit:** ensure programme activity, recency and narrative reporting respect exactly what was actually booked, with meaningful anti-repeat controls, not RNG rewriting.
5. **Full Results theatrical presentation overhaul** after segments are complete.

Keep Contract Desk #52 separate and untouched.
