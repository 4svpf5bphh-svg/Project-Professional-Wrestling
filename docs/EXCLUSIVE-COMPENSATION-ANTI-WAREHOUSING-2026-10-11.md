# PPW shared World — Exclusive compensation & anti-warehousing audit
**Date:** 11 October 2026  
**Status:** Protected draft, stacked on validated PR #36 / CI #933. Do not merge, preview, deploy, or reset the saved World.

## Evidence

Before this wave, a player could offer a contract with 13–52 weeks of EXCLUSIVE rights, zero guaranteed weekly cash, and extremely high appearance-only fees. That structure might score as an attractive offer because the valuation multiplied the appearance fee by the legacy EXCLUSIVE date-entitlement field. But that field is **not** a purchased-date cap: exclusives now allow unlimited actual appearances. The promoter could then lock that wrestler out of every competitor and simply never book them, paying neither wages nor appearance fees. The existing UI already recommended a weekly salary with zero appearance fees; the authoritative core did not enforce it.

This is a shared-world anti-warehousing and credible-offer defect, not a reason to arbitrarily reprice every wrestler or turn back the limited-date contract model.

## Bounded rule for *new offers only*

1. **EXCLUSIVE contracts pay recurring wages** of at least **50% of the wrestler's calculated weekly market value**; this is below the AI generator's normal market-level guaranteed compensation and leaves room for genuine lower-budget bargaining.
2. EXCLUSIVE includes **unlimited contractual appearances** (still limited by actual health, fatigue, calendar, and service capacity), so **there is no separate appearance fee**. Signing bonuses and creative concessions remain negotiable, but cannot replace the recurring wage floor. Other contract families retain paid-date and per-appearance flexibility.
3. The shared server's acceptance-capacity validator enforces the same rule when a human offer is submitted and when offers resolve. AI-generated exclusive terms already exceed the floor and use no appearance fee. No human-only advantage in evaluation.
4. Valuation no longer treats exclusive historical dateEntitlement as a promised number of separately paid appearances. This affects offer scoring only for abnormal EXCLUSIVE proposals; genuine AI offers have appearanceFee=0 already.
5. Existing **signed** exclusives (including legacy bargains) are **not edited, invalidated, refunded, or repriced**. They continue to operate under their signed historical terms.
6. Touch-friendly recruitment/renewal screen shows the wage floor, disables the EXCLUSIVE appearance-fee field, and prevents submission with invalid exclusive compensation. Human negotiated salary must be explicit, not silently upgraded by the server.

## Regression coverage

- Direct human server command rejects zero-pay and below-floor / appearance-only exclusivity with **no state mutation**.
- Minimum-priced valid exclusive proposal preserves the negotiated guarantee, rather than repricing it.
- A high, genuinely paid exclusive wins the same World offer resolution against a competing non-exclusive bid, with only one signed contract. The competitor cannot use overlapping dates.
- AI exclusive generated salaries and structure remain within policy, with no modification of previously signed legacy agreements.
- Full Web Talent path rejects invalid proposals without consuming idempotency receipts/revisions; a later valid request with the same ID succeeds and retries deterministically.

## Deferred decisions (must not be silently folded into this PR)

- Test future historical/migrated *pending* offers under the new acceptance rule across save versions, before consolidated World reset.
- Audit no-show short-dated one-offs and week-level guaranteed cash for promoting fewer shows, without blocking legitimate freelancers.
- Audit realistic salary affordability, roster-size concentration and available wrestler liquidity using paired human/AI multi-seed Worlds. If the 50% floor proves too harsh on indie finances, tune with test data while preserving a **nonzero ongoing-pay principle**.
- Evaluate multi-promotion nonexclusive density checks and precise same-day double booking; keep legal overlapping dates usable.
- Consider whether an exclusive's contract obligations should trigger morale exits during sustained nonuse; don't mix this with the wage floor.

**Architecture mantra:** depends on canonical market value, signed terms and World Resolution; later booking and roster liquidity depend on exclusive locks; authoritative validation and pay are simulation state while the displayed floor is presentation; first complete version is a clear exclusive-only wage and no-appearance-fee constraint with end-to-end tests.
