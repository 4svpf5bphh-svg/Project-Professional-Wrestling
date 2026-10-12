# Live Appearance booking — Alpha initial implementation

This branch builds on History PR #59 → Video Packages #56 → Story-first Segments #55 → Show Rundown #54. Contracts PR #52 is separate.

**No merge, production deployment, release, World reset, or migration.**

## Shipped to this development draft

- `LIVE_APPEARANCE` is an authoritative, one-person, **on-site** segment. It is not a video. Its booked wrestler participates in show reservation and contract-date checks through the existing Card/World Lock route.
- Formats: `DEBUT` (first verified on-screen promotion appearance), `RETURN` (previous history with at least four PPW weeks away), `SURPRISE_REVEAL` and `INTRODUCTION` (no special historical claim).
- Promoter selects the scripted appearance and one qualitative booking intention. Deterministic engine judges reaction; it never cancels or invents a debut.
- A `DEBUT` or `RETURN` cannot be the person's second on-screen appearance in the same show's running order. Matches, run-ins and earlier live angles count. Prerecorded packages are excluded.
- The performer must belong to the promotion's authorised show participants, subject to on-site availability, World Lock, contracted rights and real dates; one wrestler appearing in a segment **and** a match uses one show reservation, not two.
- Booking, reloading, resolver event ledger, private and public Results each retain the scripted introduction type. Future AI reporting will read the factual ledger, not write outcomes.

## Follow-up hardening before deployment

- Audit multiple practical same-day show arrangements; if the same wrestler is double-booked, existing commitment rules must prevail.
- Revalidate future-scripted debut/return claims as earlier shows resolve, before World Lock. If the truth has changed, prompt the controlling promoter for a fresh scripted choice; never silently invent an arrival or rewrite a settled finish. This remains an open design/implementation blocker for long-horizon use.
- Future network of live appearances should prefer clearly labelled promotion history in the Card picker; don't perform N historical full scans on every talent card.
- Add audiovisual hype payoff and anti-repetition memory only through deterministic capped reception logic; no automatic free recognition or unjustified star status just for the format.
- Validate end-to-end across multi-year and historical World saves; use the existing backward-compatible optional attributes on segment records.
- Manual iPhone review is required in a controlled later release.

A test suite verifies history, same-card ordering, invalid returns, Card reservations, resolved scripted ledger and public reporting. Full CI must pass before marking this PR ready.

Further regression: an earlier *completed match run-in* also counts as a wrestler's first physical promotion appearance, even without a billed match or completed scheduled appearance record. A video package never does.
