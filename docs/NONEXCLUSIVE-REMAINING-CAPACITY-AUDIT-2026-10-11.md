# PPW non-exclusive remaining-capacity and multiplayer availability audit
**Date:** 11 October 2026  
**Status:** Protected draft, stacked on PR #37 / successful CI #934. No merge, deployment, preview, or playable World reset.

## Confirmed admission bug

For new contracts and purchased-date addenda, the contract admission engine summed each already signed agreement's **original** purchased dates divided by original term length. Completed appearances therefore continued reserving capacity, even if the wrestler had used **all** the dates and remained on an otherwise still-current non-exclusive agreement. This could block work for a second or third promotion without any genuine remaining obligation.

A non-exclusive contract is *not* exclusivity: holding an expired purchased-date entitlement is not meant to warehouse a wrestler. Weekly guarantees on signed agreements remain legally payable until their terms end, but already-worked appearance commitments no longer consume *future* service capacity.

## Narrow, server-authoritative correction

- For existing signed LIMITED_NON_EXCLUSIVE or ONE_OFF agreements, admission estimates unworked capacity as **max(0, purchased dates − dates used) ÷ eligible PPW weeks left in the agreement**. Future-starting signed agreements use their own term start; active agreements use the current World week.
- New proposed contracts still reserve their full purchased-date density; merely *submitting* an offer never releases another promoter's commitments.
- Existing exclusive agreements reserve their term and prohibit overlapping non-exclusive contracts **regardless of the historic compatibility-only date counter**. A new exclusive still cannot override another promotion's unexpired signed agreement, even if its dates are exhausted.
- The same calculation applies to new human/AI contract acceptance and purchases of more dates on an existing limited contract. It avoids a special human-only shortcut.
- The client gets no extra capacity by being online or advancing time. All offers remain pending until canonical World resolution.
- At show reservation/materialization, **the actual PPW day and integer weekly service capacity** remain independently enforced. Several promotions may book different days if the wrestler genuinely has workload capacity. An identical day remains unavailable.

## New regressions

1. A 10-of-13-date non-exclusive agreement with all ten dates **unworked** constrains another indie's one-off, while the same agreement with all ten **already worked** releases that future capacity, without being terminated.
2. Exhausting another promotion's purchased dates makes a reasonable add-on purchase possible on the player's same contract; unworked rival dates still block an overcommitted addendum.
3. A competing exclusive continues to be blocked by an overlapping signed term, even if its purchased-date counter is exhausted.
4. Two human promotions can reserve the same PRIME wrestler on separate show days when the signed terms and workload allow it. Existing regression forbids same-day duplicates and preserves resource/idempotency rules.
5. Full app, Backstage, web build, HTTP/PostgreSQL, seven-seed creative audit and 10-year smoke must remain green.

## Affordability / market liquidity — next bounded audit

- Shared World finance still pays weekly guarantees on **active contracts** even when purchased dates are exhausted. This is deliberate: non-exclusive means work elsewhere remains permitted, **not** that original wages stop until expiry.
- Compare median/minimum indie-accessible wrestler counts, recognition threshold, weekly wage burden, median active free-agent count, non-exclusive multiple-affiliation rates, and roster participation under several seeds and future years. Existing paired creative audit already produces an accessible-market diagnostic but is **not** proof of cash sustainability or bookings.
- Capacity admission is intentionally an average commitment estimate rather than claiming exact future dates; actual dates are author-owned and guarded by reservation. Test near-term heavily backloaded dates and competing offers in a subsequent isolated wave before changing this simple model.
- Do not change talent pricing, appearance fee algorithms, World Lock ordering, or signed historical records based only on an assumed balance benefit.

## Dependency check

Depends on signed contract status, datesUsed, World clock and canonical contract indexes. Future market liquidity, renewal, exact-day show bookings and roster finances depend on these rules. Calculation and eligibility are **simulation state**; simple "dates remaining / employed elsewhere" displays belong to presentation. The smallest complete change is to stop counting spent appearances while retaining actual calendar safety and exclusivity.
