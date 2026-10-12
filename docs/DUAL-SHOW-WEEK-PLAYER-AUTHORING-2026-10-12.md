# PPW dual-show PPW week — Player Authoring and World Lock
**12 October 2026 · Protected draft stacked on PR #43 (CI #948 green). Do not merge, deploy, preview or reset.**

## Diagnosis

PR #42's 26-week player-owned trial ended with one staff takeover in each tested World even after the expired-contract roster display bug was fixed (PR #43). Week 25 contains **two different due show identities**, an ordinary flagship and an annual premium event.

Existing server infrastructure is already series-aware:
- The six-week Planner lists all `promotionShowSeriesDueForDate` identities individually and allows multiple separate show drafts in one PPW week.
- Cards are addressable by **draftId** and do not need to overwrite the primary current-week draft.
- Reservations enforce different venues / days, correct identity-slot limits, same-day nonduplication, weekly workload, valid signed contracts and unused appearance entitlements.
- `playerCurrentWeekPreparation` already requires **every due show** to have a complete ready reservation before marking the player's week ready.

The older Alpha home and current-week quick-card path, however, assume only **one** primary due show identity. The home screen could therefore fail to direct the player towards a second premium card.

## Additional finding from end-to-end CI #951

The initial legal six-wrestler test showed that the server successfully persisted two independent reservations and cards, but the Planner did **not** mark both READY_TO_LOCK. Reason: `playerShowPlanningStatus` compared the **global** `workspace.version` to the earlier reserved plan version. Editing/reserving the premium show advances the same promotion workspace version and falsely marks the untouched flagship reservation `RESERVATION_DUE`. Refreshing the flagship in turn would stale the premium, making both impossible to mark ready together.

The correction uses **show-specific reservable details** instead: exact PPW date, show identity, market, venue, ticket strategy and complete distinct wrestler set. Modifying the second show no longer invalidates the first; altering the original show's venue, day or people still requires an actual re-reservation. We preserve the persisted `reservedPlanVersion` for historical/optimistic concurrency records and retain the existing status field's wire shape for old clients.

Regression now tests both **independent-show stability** and **own-show logistics invalidation**. No World Lock bypass, blind acceptance, extra talent dates or changes to signed wages.

## This small, complete first wave

1. Expose every due show identity (and name) in the authorized Alpha Home projection; this remains a **read-only** presentation of canonical schedule data.
2. When two shows are due, prominently tell the owner about both, and link to the **six-week Planner** instead of the single-current-show card. A single-show week retains existing shortcuts.
3. Add a persisted, player-authored **Week 25 dual-show regression**: use a real seeded Alpha World containing a flagship and premium show due, establish two legal **nonoverlapping** sets of signed wrestling dates within the isolated test fixture, save flagship logistics/card on PPW Day 6, premium logistics/card on Day 7, and resolve both via the actual **player-triggered** World Lock. Assert separate stable draft IDs, reservations, ready-to-lock status, completed events and no staff takeover for either show.
4. The isolated fixture adjusts only its own signed booking terms to provide enough legally bookable dates for two independent legal six-wrestler cards. This does not grant additional dates, wages or power to the production World.
5. Complete full application, Backstage, web build, HTTP/PostgreSQL, seven-seed economics, 26-week player-owned regressions and 10-year CI before recommending integration.

## Guardrails / downstream

This does not expand weekly service capacity, permit duplicate same-day appearances, undermine wrestler consent, change date entitlement, create additional simulation cycles, charge money twice or alter the 1-real-day-per-PPW-week calendar. The premium event retains its own accounting/show identity.

The six-week Planner already knows what is due, and each separate Show Card has its own booking state. If end-to-end tests uncover an unexpected missing backend path, fix that path with a targeted regression instead of replacing the planner wholesale.

**Next:** clearer booked-versus-purchased date indicators for both roster and specific show days, and batch-friendly voluntary date negotiations to reduce the 17–21 separate successful addenda recorded in the 26-week indie trial.
