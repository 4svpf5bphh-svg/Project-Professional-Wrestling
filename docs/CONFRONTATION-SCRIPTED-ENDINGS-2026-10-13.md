# Face-to-Face Confrontations: authored endings and variety

Draft-only follow-up to PR #67 — 13 October 2026. No merge, World reset, production or preview deployment.

## Why

A direct CONFRONTATION currently records the instigator and target but not **how the encounter ends**. For a scripted wrestling game that makes the simulation accidentally author the most memorable part of the segment.

Use one existing CONFRONTATION type and four clear nonviolent endings:

- **Staredown:** neither yields; tension remains.
- **Instigator backs down:** player decides exactly who retreats.
- **Target backs down:** the target visibly retreats.
- **Reluctant handshake:** a scripted on-screen gesture, **not** a real backstage friendship, stable change, new Programme or automatically healed feud.

No BRAWL ending here: that belongs to Attack, physical Interruption or another explicit physical angle. No challenge acceptance, match scheduled, injury or creative veto is generated. The promoter scripts the outcome; the World evaluates credibility and crowd response using wrestler alignment and Programme context. Old confrontations without a chosen ending stay generic and are not retroactively given one.

## Avoid repetition, not meaningful wrestling tropes

Repeated use is measured from actual **SHOW_SEGMENT_COMPLETED** entries from the same promotion in the prior six PPW weeks. The prior booking must have the **same ordered instigator and target** and **same chosen ending**. Different wrestlers, reversing who confronts whom, a different ending, another promotion's show, unfinished drafts and older events do not cause a penalty. Cap repetition at 3.5 angle-fit points; no booking prohibition or arbitrary story rewrite. This is deterministic at World resolution and frozen with the performed segment in ledger history.

## Dependencies / full design versus complete first slice

1. **Depends on:** typed Card and planning validation; directed role selection; show and Programme history; completed-segment ledger; spectator response and alignment.
2. **Future consumers:** display-rich Results, segment and Backstage consequences, programme progression, sensible confrontation-to-attack/challenge chains, future varied news and promos.
3. **Simulation vs UI:** `confrontationEnding` and role IDs are server-authoritative. Crowd reaction is deterministic and saved. Card buttons and Results descriptions are presentation. No extra wrestler, date, title or economic entry is created.
4. **Smallest complete version:** single ending field on existing CONFRONTATION, mobile-friendly four-button selection, server validation, compatibility for legacy absence, freeze to private and public Results, bounded same-beat fatigue, and independent regression tests.

## Next review: aftermath

RESCUE already records aggressor, victim and rescuer; POST_MATCH_ASSAULT already requires a completed source match, true victim, and adjacent position. Next audit should **not** reintroduce duplicate Attack functionality. Prioritize a genuine authored rescue ending and a clear post-match assault objective/format only where these affect story and results, with player control and no accidental injury or result alteration.

CI still required on this exact draft. PR #67's green CI #1014 confirms its parent, not this code.
