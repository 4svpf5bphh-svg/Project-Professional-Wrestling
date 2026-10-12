# Pre-recorded Video Package — first complete slice

Draft PR #56, stacked on #55 (story-purpose picker) and #54 (Show Rundown). No merges, production releases, World resets or changes to the player's current game.

## Invariants

1. A `VIDEO_PACKAGE` is **pre-recorded footage**, not the live appearance of the featured subject. It has `participantIds: []` and a separate `videoSubjectPersonId`. The subject never contributes to the show's on-site participant count or contracted live dates.
2. The subject must have an **active contract with the booking promotion**. This first slice treats such a contract as consent to present footage; no unsigned talent can be advertised as a confirmed debut. Future footage media-rights contracts should be explicit and separately validated.
3. Each video has a scriptable kind, intended objective and reveal level (cryptic, named, full). The simulator may evaluate quality and crowd response, but cannot invent a different reveal, real debut, contract, match confirmation, alignment or recovery event.
4. A linked Programme must include the video subject. Programme activity history can record the package even though no wrestler was physically at the venue.
5. Public Results omit the featured identity from cryptic packages. The authoritative ledger and private player Results can retain the real subject for continuity without leaking through the public projection.
6. Existing `WORLD LOCK` remains the only authority for booked shows and their historical events. The event ledger is idempotent and date-scoped.

## Supported packages
- `DEBUT_TEASER`: coming soon
- `RETURN_TEASER`: a future comeback is advertised, not executed
- `CHARACTER_SPOTLIGHT`: character and personality vignette
- `RIVALRY_RECAP`: ongoing storyline reminder
- `EVENT_HYPE`: hype without claiming a scheduled bout or title change
- `TRAINING_MONTAGE`: atmosphere, not medical recovery or a fitness boost

Goals: Create intrigue, build anticipation, establish threat, build sympathy, recap stakes.
Reveal: cryptic/silhouette, name reveal, full footage.

## Next dependency
Live appearances, including genuine promotion-relative debuts and returns, must be a **different** type with actual event reservations and consumed dates. Check prior promotion appearance history and avoid counting video as a live debut. Do not implement real-time progression or an AI event generator before foundational World Lock/Results integration is tested.

## Verification
Regression tests target (a) authoritative draft roundtrip and the ledger, (b) forbidden unsigned subjects, (c) no video-induced physical booking or date usage, (d) opaque public teaser identity, and (e) existing World/simulation tests. Final readiness requires full GitHub CI on the stacked branch plus manual iPhone review in a future controlled release.

## Final UI and disclosure checks
The segment editor uses touch-friendly format and objective choices rather than large grey dropdowns. A separate private/public Results regression verifies that a cryptic teaser remains cryptic to other players. Neither the footage nor its reported crowd response is allowed to create the subject's actual promotion debut.
