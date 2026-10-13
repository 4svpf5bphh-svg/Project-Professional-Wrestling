# PPW Segment Logic & Story Variety Audit — 13 October 2026

**State:** audit plus bounded implementation, draft-only stacked above PR #69. Do not merge, deploy, reset World state or reopen employment-contract design.

## The core rule

**Player authors on-screen wrestling fiction; World simulates delivery and reactions, not the booking decision.** A finished show is authoritative evidence. Draft, reserved, materialized-but-unperformed, rival-promotion and future shows cannot cause a repeat penalty or rewrite a promoter's chosen outcome.

Creative variety means different *story beats*, not forcing a random new angle every week. Repeated wrestling motifs are legal and useful for rivalry escalation. Penalties are small, capped, six-PPW-week and grounded in completed history. The same wrestler can perform a fresh angle with a new subject, purpose, format or outcome.

## Full 16-type matrix

| Type | Purpose and authoritative authored controls | Reality/prerequisites | Variety rule at this branch | Caveat or next action |
| --- | --- | --- | --- | --- |
| PROMO | Character speaks with a purpose: statement, boast, rally, grievance, warning | Wrestler physically present; does not invent a challenge | Recent same person/purpose/promotion | Add optional pre-booking freshness hints only after factual parity audit |
| INTERVIEW | Neutral host asks career/rivalry/form/future; subject scripts candid/evasive/defiant/walkout; advanced setting | Host never consumes another wrestler contract date; no fictional interview conflict | Same guest/topic/answer/promotion | No interview host roster system at MVP |
| CELEBRATION | Appreciation, self-coronation, rival taunt, real recent victory lap; scripted closing gesture | Victory must be completed in this promotion; boasts are kayfabe not title claims | Same subject/occasion/ending/promotion | Title ceremony needs genuine current reign evidence and lock revalidation |
| CONFRONTATION | Directed instigator/target and staredown, retreat, reluctant handshake | Nonviolent stand-off, not challenge or attack; no automatic relationship | Same ordered pair/ending/promotion | Handshake does not rewrite Backstage relations |
| INTERRUPTION | One speaker's airtime interrupted; books who prevails or brawl | Does not override speaker or create a new match | **New:** same directed pair and response | Distinct from an arriving challenger and standalone attack |
| CHALLENGE | Directed match demand and accepted/refused/open reply | Acceptance is dialogue, not a scheduled match | **New:** same challenger/target/reply | Future match promises require separate scheduling integration |
| CONTRACT_SIGNING | On-screen fictional signing/walkout/brawl with explicit roles | Must never issue an actual talent employment agreement | No extra generic novelty modifier | Requires future feud-beat lifecycle; repeating a literal contract signature without a real pact is a possible storytelling inconsistency |
| STABLE_INVITATION | Current recruiter, recruit, accepted/refused | Actual stable membership remains in Roster, not secretly changed | No generic novelty modifier | Need an authored **kayfabe promise vs official member** state boundary before adding automatic faction progress |
| STABLE_EXIT | On-screen expulsion or voluntary walkout | Only eligible current stable members; roster membership unchanged | No generic novelty modifier | **Unresolved:** same member can be expelled on-screen repeatedly if no roster update; add informative booking warning or formal membership transaction, not silent auto-change |
| STABLE_RECONCILIATION | Current representative and historical former member; embrace/rebuff | Requires actual former-member history; on-screen peace does not auto-rejoin stable | No generic novelty modifier | **Unresolved:** rejoining in character vs actual membership need explicit linkage and a repeat warning |
| ATTACK | Attacker/victim, blindside/beatdown/pull-apart, heat/sympathy/escalation | Direct physical angle; no invented injury, match or faction switch | **New:** same roles/format/objective; modest cross-context memory of same beat after match | Physical assault *can* advance a feud even if familiar |
| RESCUE | Attacker, victim, distinct rescuer; successful save/attacker escape/failed save | Failure must not be described as success | Same complete directed trio/outcome/promotion | No arbitrary injury or alliance change |
| POST_MATCH_ASSAULT | Real completed source match; aggressor/victim, format, goal, scripted winner after bell | Victim actually competed; immediately follows match; source match result never changes | Same roles/format/goal/ending; **new** weaker cross-context memory of prior standalone attack | An outside attacker and the match winner may both have valid story presence |
| TURN | Script character's target face/heel/tweener, reveal/betrayal | Explicit alignment mutation, with volatility and impossible-repeat safeguards | Career presentation volatility penalty | Do not require superficial six-week generic repeat if the state transition itself already disallows identical turns |
| VIDEO_PACKAGE | Pre-recorded subject, teaser/recap/spotlight/montage, purpose, identity reveal | Contract must cover show date, but NO live participant or appearance reserved | **New:** same subject/kind/objective/reveal | Debut/return teaser never constitutes the actual arrival; no fabricated on-screen return |
| LIVE_APPEARANCE | In-person debut/return/surprise/intro plus goal | Actual roster reservation, historical first/return eligibility, materialized World Lock protections | Historical arrival eligibility | A real debut is nonrepeatable; a return requires time away, so generic repeat penalty would double-punish |

## Changes in this bounded audit

The missing everyday segment family now measures actual **completed** recent exact beats:
- **ATTACK:** directed attacker + victim + physical format + objective; cap 3.5 points. Cross-genre overlap with post-match assault at only 0.5 per equivalent recent beat, inside same overall cap.
- **INTERRUPTION:** ordered interrupter and speaker + exact scripted response; capped 3.3.
- **CHALLENGE:** ordered challenger and target + accepted/refused/open response; capped 3.3.
- **VIDEO_PACKAGE:** real filmed subject + package kind + objective + reveal level; capped 3.0. Video remains non-live and cannot reserve a contract date.

For **POST_MATCH_ASSAULT**, preserve its existing exact repeat check; add only weaker 0.5 credit for the same completed standalone attack beat with same attacker, victim, format and objective, inside its existing 3.5 cap. Changing setting is meaningful variety; do not count contexts as identical.

The other ten types remain either previously covered by their own richer rule or gated by underlying one-time state/history. Avoid a global blanket penalty that would make an evolving feud monotonous and punish ordinary wrestling tropes.

## Reality & parity findings

1. Story-first picker covers all 16 currently supported types with seven player-friendly narrative goals. All 16 have typed server validation and immutable completion ledger/Results projection paths.
2. Main exception to narrative-to-application parity: **stable membership and televised stable story** are deliberately separate authority. That is the most consequential outstanding logical seam. Document this explicitly; do **not** auto-enrol/eject talent from a scripted angle without user intent.
3. Known time distinction: anti-repeat scoring currently looks at **prior PPW weeks** only, not earlier slots on the same show or earlier events in the same PPW week. Same-week causal sequencing must be resolved with canonical World event chronology before changing this. Never let another live player's draft influence a resolved event.
4. Variety penalties alone are not helpful discovery. Future Card UX should explain a warning when exact repeated real history exists, distinguishing it from a hard booking prohibition. Do not leak rival private scripts or wages.
5. Later Results must surface scripted outcomes and reception in compelling wrestling language/icons. Separate artistic presentation from authoritative match results and ledger facts.

## Four dependency questions

- **What this depends on:** typed segment choices, actual role IDs, promoter-scoped authored script, World Lock, immutable `SHOW_SEGMENT_COMPLETED` history, actual match results, Programme heat and stable/contract authority.
- **What later depends on this:** natural trade/press recaps, performer morale and Backstage reactions, phase-based feud progression, fresh crowd reactions, the interactive Results spectacle, and user-visible prebooking variety signals.
- **What is sim state vs presentation:** ledger evidence, scripted response, participant direction, dates, actual title/contract/membership, and deterministic reception are authority; picker categories, explanatory copy, colours, future warning chip, iconography and headlines are presentation.
- **Smallest complete version:** fill everyday anti-repeat holes, make same-pair cross-context physical motif modest not punitive, regress positive/negative scenarios, document exceptions and deferred dependency work. Do not add a broad automatic story generator.

## Regression & release discipline

Tests verify same promotion, ordered roles, exact scripted choice, historical completed time, other wrestler/option, cross-context weaker matching, rival privacy and future/old exclusion. No match result, injury, contract or faction state changed by variety scoring. Run complete CI on the exact head. Draft branch only; restore stack above #69 after green.

**Next bounded work:** address the *stable storyline vs actual membership* authority seam and sensible in-Card story freshness warnings. Only after a complete booking/variety audit should we start the colourful Results redesign.
