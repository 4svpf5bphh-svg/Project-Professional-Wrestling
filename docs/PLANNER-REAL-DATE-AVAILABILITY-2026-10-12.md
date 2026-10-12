# PPW six-week Planner — Purchased dates vs actual day-by-day availability
**12 October 2026 · Protected draft, stacked on green PR #44/CI #954. No merge, preview, deployment or saved World reset.**

## Problem

A wrestler may have unused contract dates on the roster while being unavailable for a specific event because of a prior reservation, an already committed appearance, their weekly service-capacity ceiling or the actual signed contract window. PPW's Planner previously counted `dateEntitlement - datesUsed` as its list of eligible participants, and applied a separate literal D1–D7 window check. That check was inconsistent with the canonical rule allowing the whole *final PPW week* (including Day 7) when the stored end date was Day 1.

The booking engine correctly rejected unavailable commitments, but players needed the distinction **before** opening the Show Card.

## Small end-to-end change

- The same **read-only show-date eligibility function** now powers both a Planner projection and the actual authoritative scarce-resource reservation validator. It tests: person active, competing same-day reservations/appearances across the shared World, weekly service capacity, paid dates already consumed or reserved and actual contract coverage. The server still checks venue and show-slot conflicts separately.
- Every private Planner week now exposes `datesRemaining` (purchased and unused, including already reserved), `unreservedDatesRemaining` (purchased and uncommitted across signed contracts covering that week), and `bookableDays` (zero to seven actual PPW day numbers). EXCLUSIVE deals continue to show unlimited paid appearances, but **never** bypass same-day conflicts or Service Capacity.
- Within the Show Details editor, changing the chosen Day 1–7 displays how many wrestlers are genuinely available on that day and a small roster preview with both remaining figures. This is guidance, **not** an automatic assignment; wrestlers are still selected on their individual scripted Show Cards.
- A following-week contract cannot leak forward just because its stored status remains SIGNED. Contracts ending on Day 1 remain bookable **through Day 7 of their final paid week**.
- All viewed data remains scoped to the controlling promotion. No rival private wages/contracts are exposed; World Lock remains authoritative and every rival can compete for genuinely shared dates.

## Tests

A focused fixture verifies an active LIMITED_NON_EXCLUSIVE worker whose contract ends D1 of the current week: three purchased/unconsumed dates, bookable Day 7; after a bona fide D6 reservation the Planner still shows **3 purchased but only 2 unreserved**, cannot offer an additional Day-6 commitment, and no longer includes the wrestler in the following PPW week. Existing reservation conflicts, date usage, right-to-refuse and the two-show same-week test continue under full CI.

## Deferred — independent contract admin wave

The first 26-week engaged-owner audit required **21** and **17** individually accepted date addenda, despite much better show authorship. The next development wave should present a batch negotiation *workspace* and a transparent upfront full-cost preview, while still submitting **separate, independently evaluated wrestler offers**, allowing partial acceptance/refusal and unchanged idempotency/cash charges. No automatic consent, bulk force-signing or entitlement grants.

### Dependency check

Depends on canonical signed terms, seven-day contract calendar and global competing commitments. Future contract UX, roster planning and multi-show week readiness depend on truthful day projections. Actual booking rights and cash are server-authoritative; the projected day list is UI/read-only, with the authoritative validator sharing the same checks. Smallest complete version: day-specific availability + purchased/unreserved distinction + regression tests.
