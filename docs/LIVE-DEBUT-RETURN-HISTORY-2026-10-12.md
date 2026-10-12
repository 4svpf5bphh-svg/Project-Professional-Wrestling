# Live Debut / Return — promotion-specific history foundation

Draft development work stacked **after** the Show Rundown, Story-first Segment picker and Video Package drafts. **No merge, deployment, or World reset.**

## Completed slice

`promotionLiveAppearanceHistory(state, promotionId, personId, showDate)` provides the **authoritative context** for a future in-person introduction. It counts one appearance per **completed show** for that promotion before the target date, whether the appearance is recorded through a completed scheduled appearance, a completed match, a resolved on-screen segment, or a completed run-in. It excludes unsigned intentions, unfulfilled appearances, appearances at other promotions, future events, and all prerecorded `VIDEO_PACKAGE` segments.

- **Debut eligible:** no verified completed on-screen history for this promotion before the show date.
- **Return eligible:** prior completed history and at least **four PPW weeks** since last appearance. The 4-week threshold is an initial gameplay rule, not an arbitrary biological time threshold or an injury prerequisite.
- **Established:** has already appeared recently, so show an ordinary introduction or surprise reveal rather than rewriting history.

The calculation is reusable and has regression tests, but the actual `LIVE_APPEARANCE` segment **is not yet implemented** by this PR.

## Next complete slice

1. Add `LIVE_APPEARANCE` to authoritative domain/card with `DEBUT / RETURN / SURPRISE_REVEAL / INTRODUCTION` and explicit booking objective. The live subject is a real participant (unlike video's `videoSubjectPersonId`), selected using the existing roster/availability picker.
2. Validate contractual booking rights for the **exact show date**; consume actual purchased dates through the existing reservation/materialisation route. No unauthorised talent, extra dated appearance or bypass of World Lock.
3. Re-evaluate debut/return history at save and World Lock. A booked appearance earlier in the same event must prevent an inaccurate "first appearance" claim; cross-show scheduling must preserve the chronological truth.
4. Preserve precisely scripted presentation; judge **crowd response** based on wrestler recognition, previous promotion history, absence length, hype videos, momentum and fit, with diminishing returns for repetitive reveals.
5. Record a verified event-ledger beat with match/segment running order, participant ID, requested reveal subtype and promotion-specific history, then project it into both private and public Results.
6. Develop full Card Quick Book/Advanced Booking controls and tests for debut/return eligibility, same-show conflicts, actual attendance/date usage, historic video-only teaser, World Lock, public privacy, and rollback.

## PPW core dependency questions

**Depends on:** contract dates; pre-recorded Video Package distinction; completed show/segment ledger; promotion-specific identities; card availability; deterministic World Lock.

**Downstream:** show journalism, legacy biographies, 'first appearance' milestones, crowd anticipation, return-from-injury narrative, match/programme events, weekly notifications.

**Authoritative vs UI:** event history/eligibility and scripted outcomes live in the application/World; status badges and presentation labels remain derived UI. A player never gets extra competitive simulation power for being online.

**Smallest complete release:** only after a real live introductory segment round-trips save → booking/appearance date → World Lock → ledger → Results, with comprehensive tests. This helper alone is not marketed as a playable new segment.
