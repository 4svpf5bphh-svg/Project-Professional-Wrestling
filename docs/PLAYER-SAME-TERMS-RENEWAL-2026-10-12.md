# PPW player-authorised same-terms renewals (protected PR #47)
**12 October 2026 · Stacked after validated PR #46 / CI #958. Draft only: no merge, deployment, preview or saved World reset.**

## Design contract
- The **player alone chooses new wrestlers to sign**. Staff never auto-recruit new talent.
- This first wave introduces no staff member and no staff-side World commands.
- Existing signed multiweek contracts may supply a **standing-terms renewal template** to their own promoter, if their original term is supported by human-offer restrictions. Copy family, role, creative rights, paid weekly guarantee, appearance fee and date entitlement, **but NOT a previous signing bonus**. One-off dates and unsupported historical term lengths require explicit manual negotiation.
- Offer is presented in an authorisation screen; only a deliberate player click submits it through existing server-authenticated `SUBMIT_CONTRACT_OFFER` with `sourceContractId`. It does not sign instantly. The wrestler still independently accepts or rejects during canonical World resolution, including shared capacity, rival offers, exclusivity and realistic compensation.
- Manual negotiations remain fully available. Selling more appearance dates remains a separate consensual **same-contract dates addendum** and does not extend term.
- Show cash separately: one-time bonus due only if accepted, weekly guarantees over the entire term, appearance fees only if purchased dates are worked, and maximum potential contract pay if all relevant dates are used. This is not the cash due at offer submission.
- Private contract details and the standing-terms proposal are visible only to the controlling promotion. No public or rival wage leakage.

## Future Talent Manager dependency
The `sameTermsRenewalTemplate(state, contract)` function is a reusable **read-only application helper**, not a special authority or source of extra simulation power. When a Talent Manager is introduced, staff can recommend or submit this existing command **only on explicit player authorisation**, must escalate material counters/refusals, and must not silently change guarantees, bonuses, dates or creative rights. Competence improves warnings and administration, not chance by fiat. A shared-world authoritative staff employment model and salary costs are separate future work.

## Four mantra questions
1. **Depends on:** signed terms, real source-contract ID, shared capacity, renewal window, original World resolver.
2. **Future dependants:** Talent Manager renewal delegation and expiry reminders; wider staff framework and human-first retention UX.
3. **Application vs presentation:** request source and offers are authenticated, idempotent server World state; template and cost disclosure are read-only presentation. No player permission inferred from client controls.
4. **Smallest complete first version:** explicit same-terms preview/authorise action, no bonus repeat, clear contract costs, regression; no batch-sign or global staff system.

## Release gates
Application/player-view and browser tests; full Backstage, seven-day, multi-promotion reservations, HTTP/PostgreSQL, creative-control, affordability, 26-week engaged and decade simulations. Any failure blocks subsequent waves until diagnosed.
