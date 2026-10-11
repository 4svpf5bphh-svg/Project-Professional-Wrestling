# PPW contract usability review — 11 October 2026

Status: **design superseded by approved simple contract structure**. Implementation in protected development branches only; no deployment or World reset.

## Approved direction (supersedes the original audit below)

- **Exclusive** = term-based employment with unlimited *contractual* appearances during the term. Health, fatigue, workload, booked dates and World scheduling limits still apply. A signed exclusive wrestler cannot take incompatible outside engagements. Weekly guarantees continue.
- **Limited non-exclusive** = period + purchased appearances; wrestler may work for multiple compatible promotions. When purchased dates are exhausted, work for that promotion pauses but the underlying contract and any weekly guarantee remain.
- **Additional dates** = negotiated addendum **on the existing limited/non-exclusive contract**. Wrestler consent is required. Acceptance only increases total purchased appearances and optionally charges a one-time incremental payment. Original expiry, exclusivity, weekly guarantee, per-appearance fee, role and contract ID remain unchanged. No automatic extension/refund at expiry.
- **One-off** = one purchased show, no weekly wage.
- The extra-dates offer is server-authoritative, idempotent, accepted or declined before it changes the contract, and recorded in ledger/finances.
- Do not add a compulsory fourth contract form. Creative-control options follow contract validation and should be an opt-in concession.
- Existing World compatibility is preserved in the code, but the user has chosen a fresh World reset **after further development and immediately before a future explicitly authorised release**, not now.

### Deferred evaluation

Price/recruitment calibration under unlimited exclusive usage, repeatability of addendum negotiations, save migration stress tests, late-term workload guardrails, proper casual-player cost guidance, special-attraction exceptions, and final mobile UI polish.


## Decision: simplify understanding before altering simulation

A PPW wrestler is one person in a shared, server-authoritative World. They may hold multiple compatible, non-exclusive agreements and accept shows with different promotions, limited by service capacity and scheduling. Never turn contracts into one-employer-only deals to make the UI easier.

The existing families already cover the basic choices:
- **One-off**: one appearance, no weekly wage.
- **Limited non-exclusive**: a term, purchased appearance entitlement, possible weekly guarantee and per-appearance pay; outside work remains possible.
- **Exclusive**: term and purchased dates with a weekly guarantee; restrictions prevent incompatible competing engagements. Exclusive **currently does not mean unlimited appearances**.

An active deal has two different limits:
1. **Expiry (the legal time window)**: current date must fall between the signed start and end. Remaining purchased dates never extend it automatically.
2. **Dates (the booking entitlement)**: appearances consume the purchased dates. A deal may still be in force after all dates have been used. For the current engine, weekly guarantees continue while the signed deal is active, even if its dates are exhausted.

The roster already opens renegotiation when a non-one-off deal's dates reach zero. Exhausted dates do not, on their own, cancel exclusivity, cease weekly guarantees or immediately put talent on the open market. Renewals on exhausted agreements can replace the source deal immediately, avoiding a simultaneous double-contract assumption.

**Risk requiring design/balance before rules change:** months of paid exclusivity with no usable appearances can be both confusing and an unfair way of restricting scarce wrestlers. However, simply auto-releasing or auto-extending a contract would violate expectations, signed rights and shared-World fairness.

## Smallest complete usability-first version

A private booker's roster should show, without opening a separate editor:
- availability **and** expiry together: e.g. “8/12 dates · 26 weeks left”;
- an explicit “0 dates — renegotiate” state, without claiming the contract has expired;
- weekly guarantee and appearance fee as *separate monetary measures*;
- roster **global** sorting by weekly guarantee (high/low), appearance fee (high/low), expiry or dates; financial sorts should not secretly reset within role-group sections;
- whether a deal is exclusive or non-exclusive; no private terms of other promotions.

No new salary estimates, invented total costs, booking powers or hidden offer changes. Existing own-contract values suffice. A signing bonus is a past up-front cost, not a recurring wage. Per-appearance fees are variable costs, not a weekly expense. Do not combine them into a fake single salary.

## Contract-rule decisions before creative-control offers

1. **Exhausted exclusive deals:** keep a small grace / genuine renegotiation window? Allow negotiated extra dates at a cost? What restrictions continue meanwhile? What happens under inactivity? Test effects on scarce talent, cash and roster warehousing.
2. **Unworked date entitlement on expiry:** document that dates lapse unless an explicit new deal is agreed; never auto-extend, auto-book or make an implicit refund.
3. **Wages and guarantees:** distinguish a guaranteed weekly payment from a budget forecast of expected appearances. In the booker's roster, display actual contracted amounts; under Business, distinguish guaranteed payroll from variable booking fees.
4. **Multi-promotion compatibility:** non-exclusive workers keep separate rights and balances for each promotion; overlapping bookings and dates must remain server-authoritatively validated. No promoter may see rival confidential remuneration.
5. **Accessible negotiation UI:** plain terms and sensible default offers first; an optional expanded financial view later, not extra mandatory form fields. A future creative-control clause must be an informed trade-off, not a fourth unrelated time/dates dial.
6. **Asynchronous fairness:** no advantage for last-second online activity. World Lock, secured appearances, renewals and stewardship must preserve contract rights and idempotency.

## Design mantra

- **Depends on:** signed contract terms, paid guarantee accounting, completed-show date consumption, service-capacity and exclusivity guardrails, offer acceptance and renewal, roster private projection.
- **Future consumers:** creative-control scope, persona change negotiations, wrestler promises, staff/agent guidance, contract demands, roster payroll summaries, AI promoter finances.
- **Authoritative vs presentation:** contracts, spent dates, pay, promises and World Lock decisions belong in persisted application/simulation state; labels, compact summaries and financial sorts are read-only UI.
- **First complete version:** improve owned-roster cost/dates visibility without rewriting contract economics. Follow with separately modelled exclusivity/date-exhaustion rule changes and tests before integrating creative control.

## Test and release gates

- Own promotion sees actual weekly guarantees and appearance fees; rival financial terms are not leaked.
- Roster pay sorts are truly global across role groups, stable by name on ties, and do not change contract terms.
- Zero dates remains “active contract, dates exhausted” (not expired); expiry ordering still works.
- Signing bonuses and per-appearance fees are not displayed as weekly wages.
- Future rule adjustments must pass saved-World compatibility, AI/non-exclusive overlaps, long simulation and two-human World fairness tests.
- No changes to production until explicit user-authorised consolidated release.
