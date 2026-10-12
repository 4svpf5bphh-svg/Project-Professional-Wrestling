# PPW one-off actual show-calendar alignment — 11 October 2026

Status: draft PR stacked on PR #33 (CI #926 passed). Do not merge, preview, deploy or reset the World.

## Why the next PPW week was not sufficient

The first one-off timing fix ensured that an accepted one-date contract covered a **future** PPW week, day 1–7. A weekly show proved bookable. However, a biweekly or irregularly scheduled promotion might not stage any event in that week. An otherwise accepted one-off could still expire unused.

## Narrow, server-authoritative policy

- A human ONE_OFF offer becomes valid for exactly **one purchased appearance** during the first **actual scheduled promotion show week** after offer resolution, subject to any existing contract's later renewal start date.
- The server searches the authoritative active promotion Show Series (weekly, biweekly, premium, etc.), not the old event-cadence guess. The earliest week is the later of the next PPW week or the existing-contract renewal start week.
- The scan is bounded by the already-existing six-week player planning horizon. If no event occurs there, **reject the attempt before creating any offer, receipt, or World revision**, with an actionable explanation. This prevents a speculative 26-week one-off reservation and encourages negotiating closer to the event.
- The entire chosen PPW week is contract-valid, days 1–7, but **dateEntitlement stays 1**; the contract carries no weekly wage.
- Deterministic resolution and acceptance rules, other wrestlers' simultaneous contracts, capacity/exclusivity, signed rights, idempotency, AI contracts, and the user's scripted booking decisions are untouched.
- This does not guarantee a future show will actually be held. The player controls their planning and may cancel. We do not silently extend purchased dates or hand them to another promotion.

## Tests and release gates

- Weekly one-off remains valid, can enter the show reservation, be placed on a human-scripted card, and consume its single appearance.
- **New** biweekly fixture: empty intervening week, accepted one-off remains waiting, active when the next show becomes due, and can enter a day-6 show reservation.
- **New** distant 26-week fixture: no show inside the six-week horizon means no created offer and no World mutation.
- Next distinct audit: standard/AI/legacy multiweek contracts may have endDate.day=1 and become unavailable for a day-6 show in their nominal final PPW week. Test before broadening the contract date rule.

The agreed fresh playable-World reset remains deferred until the owner explicitly approves the consolidated contract release.
