# Live arrivals — branch reconciliation and World Lock audit (2026-10-13)

## Status and scope

Draft #54 = Show Rundown; #55 = story-first segment picker; #56 = authoritative non-live video packages; #59 = historical physical-appearance resolver; #60 = playable live-appearance integration. Draft #52 (Contract Desk) is separate. PR #58 diverged as an alternative implementation with a narrower history check; PR #61 was closed as superseded by #60. Do not merge them indiscriminately. The next line of development should remain stacked on #60.

No merge, deploy, migration, promotion ownership change or World reset is part of this audit.

## Confirmed invariants

- A LIVE_APPEARANCE is a physical booking. It must be under contract for the show date, consume one appearance reservation per unique booked wrestler per show, and respect calendar/service-capacity conflict checks.
- A VIDEO_PACKAGE is footage rather than a physical appearance and never counts as the debut. Cryptic video subjects remain private in World Results.
- Debut and return labels describe verified history **in this promotion**, not the wrestler's whole career. A RETURN requires an earlier live appearance and 4+ PPW weeks away.
- Wrestlers can appear in a segment and match on the same card with one booked live date; a claimed debut/return must precede that wrestler's first physical card appearance.
- World simulation judges reception but must not change a player-written debut, reveal, acceptance, or match outcome to paper over invalid history.

## Small audit fix

A show can be booked before an earlier chronological show has completed. Its debut/return claim was valid on save, but could become false before materialization. Previously the due reservation assessment checked capacity, contracts, injuries and creative vetoes but **did not re-evaluate the historical arrival claim**.

Reservation assessment now rechecks DEBUT and RETURN segments against completed promotion history for the exact show date. If no longer truthful, `LIVE_APPEARANCE_HISTORY_CHANGED` marks the reservation AT_RISK before the existing commitment-lock path can materialize the impossible booking. The draft's scripted kind is unchanged. Regression: reserved debut, newly completed earlier live promo, at-risk explanation, no false event materialization, unchanged script and intact reservation until the existing lock policy runs.

## Remaining blockers; do not call the live-arrival feature release-ready yet

1. **Already-materialized shows**: an earlier chronologically relevant event might resolve after this show's reservation has already materialized. Assessing only unmaterialized reservations is insufficient. The final World Lock needs an explicit, deterministic check for both newly materialized and already materialized cards, without letting a scheduled tick stall or rewriting authorial intent.
2. **Player-friendly repair before lock**: the current generic AT_RISK lock policy can release a whole reservation and let Routine Continuity take over. That is truthful, but may disproportionately punish a promoter for one segment becoming invalid. Ideally the card is flagged with a deep link and an actionable 'choose INTRODUCTION or revise the show' choice, with fair scheduled-world fallback when the player is offline.
3. **Chronological multi-show cases**: explicitly test two events in one PPW week, especially different days, same-day independent shows, both promotions, run-ins, and old save histories. Keep existing physical double-booking and dates limits; never give extra capacity.
4. **Return expiry and future-contract loss**: a historical return that is no longer eligible, and a booked appearance whose contract no longer covers the show date, must both surface meaningful separate reasons.
5. **Performance**: repeated promotion history scans over all historical matches and ledger entries per Card subject should be profiled and eventually indexed/cached deterministically. No speculative change in this narrow patch.
6. **Verification**: full TypeScript build, application tests, web/HTTP/Postgres CI and long-run simulation, followed by manual iPhone UI review before any release. The default CI workflow currently targets PRs based on main; a stacked draft might not automatically trigger a new run.

## Design dependency questions

- **Depends on**: exact dated contract service capacity, booked show identity, completed appearance history, immutable player script, World Lock and the event ledger.
- **Downstream**: turn/debut news, wrestler biography, awards and milestones, programme continuity, Results highlights, commentary, future arrivals.
- **World-authoritative versus presentation**: historical eligibility and reservation risk stay authoritative. Cards and notifications display those facts and offer revisions; presentation cannot fabricate a first appearance.
- **Smallest complete safe next slice**: protect already-materialized cards at final lock with a deterministic, discoverable way to repair stale labels; test across a multi-show chronological fixture. Keep this branch separate from Contracts #52 and the later Results UI redesign.
