# PR #49: Talent Manager integration and gameplay-value audit
**12 October 2026 · Protected stacked draft after green PR #48 / CI #979**
Do not merge, deploy, preview, or reset the saved World.

## Design findings
The manager's v1 job is retention administration, not a second contract engine or recruiting AI. An employed person in this shared World has exactly one active employer, a real wage and an authorising human owner. Same-terms renewals are sent through the exact wrestler decision resolver used by manual negotiations.

### Fixes/coverage
- A delegated renewal's **canonical start and end dates, term, source, window, creative terms and financial components** are checked at the application command boundary, not trusted solely to the web-adapter projection. A forged longer/shifted proposal must fail without producing an offer.
- Manager Insight supplies **read-only advice** from the wrestler's current morale, estimated total pay package (weekly guarantee plus spread contracted appearance fees), and expiry urgency. Lower-skill managers provide more general notes. The advice is intentionally non-certain, does not use rivals' hidden contract details, and has no role in acceptance utility.
- Two seeded **26-world-week paired Indie simulations** compare a manually run human Indie with and without one employed manager. The employed manager costs one recorded staff wage each paid week, creates no recruitment offers, makes no extra shows, and survives a persistence round-trip. Preserve distinct financial trajectories rather than offsetting the cost with a hidden subsidy.
- Earlier PR #48 tests already cover two human employers contending for a unique manager, idempotent hire/release, server consent for renewals and player-visible accept/reject messages.

### Four design mantra questions
1. **What does it depend on?** Single authoritative PPW week, player control, salary ledger, one World staff pool, consent resolver, PR #47 same-terms template, PR #48 manager employment.
2. **What depends on this later?** Staff attributes, talent agent advice, full negotiations/counteroffers, promotions competing for personnel, doctors and road agents that reuse employment/payroll primitives.
3. **State or presentation?** Contract decisions, offer IDs, employment, payment and World Tick are authoritative state. Insight advice is a disposable player-scoped read-only projection; it cannot silently cause new contracts or change results.
4. **Smallest complete first version?** Defensive validation, truthful helpful advice, 26-week proof, no mass hire, no automatic renewals, no magic success rolls.

### Constraints and deferred work
- No formal wrestler counteroffer type exists yet: the resolver accepts/rejects. A refusal should tell the player to negotiate again; don't describe fictitious counterterms.
- Better guidance is not equivalent to a numerical acceptance buff or a guaranteed successful renewal.
- This audit does not implement doctors, road agents, staff bidding or standing authorisation.
- Do not allow an employed manager to warehouse wrestlers or participate as an additional online actor during World Lock.

### Release checks
Full TypeScript, world migration, application, reservation, web, HTTP, PostgreSQL, Backstage, indie affordability, 26-week engaged Indie and 10-year smoke. CI must pass on the final head before we consider consolidation. Release/reset stays separately authorised.
