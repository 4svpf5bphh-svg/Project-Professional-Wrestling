# PPW — player creative-control offer integration audit (11 October 2026)

Status: **protected draft development only**. Stacked on PR #31. Do not merge, preview, deploy, reset, or change existing players' Worlds.

## Integration checks

| Boundary | Audited rule | Evidence |
| --- | --- | --- |
| Player offer UI | Four tap-friendly creative levels; initial recruitment NONE; renewal reads current signed level | `talent-client.tsx`; inherited Web Talent regressions |
| Recruitment and renewal | Clause crosses HTTP, authenticated owner service, application command and persisted pending offer | `talent-service.ts`, `submitContractOfferCommand`, `submitHumanContractOffer` |
| Request safety | Unknown clause rejected; old omission means NONE; changed rights cannot reuse request ID | Web Talent regression suite |
| Multi-promotion privacy | Own pending/roster rights shown; rival cash remains confidential | `buildPlayerTalentManagementView`; ownership-guarded service |
| Signed rights | Offer submission does not change existing agreement; accepted renewal grants rights only within future term | **New accepted future-renewal regression** |
| Additional dates | Uses separate same-contract addendum; cannot change creative clause | Existing date-addendum acceptance/regression |
| Actual booking | Signed rights enforced via creative match review and pre-lock consent; scripts never auto-rewritten | Earlier consent / Programme / World Lock tests |
| Exclusive contracts | Unlimited appearances, while dates field persists only for older transport/snapshots | **New legacy/canonical retry regression and matcher correction** |
| AI parity | Same acceptance scorer, no player-only bargaining bonus | Prior seven-seed audits; CI reruns |

## Corrected integration issue

For exclusive offers, `buildFreshPlan` writes `dateEntitlement = termWeeks`, which is a compatibility field, *not* a purchased-date limit. The replay comparator previously compared it to the incoming raw field instead. Older UI/API callers could submit, but then get a false 'different terms' rejection when safely retrying the identical request. Comparing the **canonical effective entitlement** fixes this without revealing or modifying any hidden booking power.

Idempotency still rejects a reused request ID if the **creative-control clause** or any other material offer promise differs; receipt, revision and World offers are unchanged on rejection. Older callers using a positive date field remain compatible.

## Scope and release gates

- This is a code/read-model and CI integration review, not an assertion of completed real-device multiplayer playtesting.
- Run full application/Backstage suite, web build, HTTP/PostgreSQL, paired multi-seed creative audit and 10-year smoke via draft PR CI. Optional 100-year validation may run separately.
- Before eventual release, real-device tests should include: accidental renewals, fee wording for unlimited exclusive appearances, rapid repeated taps/retries, and two bookers competing for the same non-exclusive wrestler.
- **Reset decision:** user-approved plan remains a fresh playable World immediately before a future explicitly authorised consolidated deployment because changed exclusivity, additional-date and creative contract semantics materially alter the saved game. No reset is performed by this audit.
