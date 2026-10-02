# SIM-0.0.3 Contracts & Talent Market

This milestone replaces static roster ownership with explicit contractual rights.

## Included
- Formal Contract entities as the source of truth for talent relationships.
- Contract families: one-off, limited non-exclusive and exclusive.
- Start/end PPW dates, date entitlements, dates used, role expectations and compensation.
- Weekly guarantees, appearance fees and signing bonuses represented separately.
- Contract signing bonuses and weekly guarantees flow through the financial transaction ledger.
- Service Capacity prevents impossible workload accumulation.
- Exclusive contracts block overlapping outside work; compatible non-exclusive contracts can coexist.
- Contract expiry and renewal windows.
- AI recruitment and renewal offers.
- Wrestler offer evaluation across money, role, prestige, schedule, loyalty and exposure.
- Small deterministic uncertainty for genuinely close offers.
- Competing offers resolved without giving AI hidden future information.
- Promotion rosters are derived from active contracts rather than wrestler ownership.
- Genesis roster allocation now uses tier-appropriate size targets instead of allowing the Global promotion to warehouse most talent.
- Long-running Worlds produce free agency, accepted/rejected offers and multi-promotion careers.

## Deliberate limitations
- Appearance fees are not paid yet because shows/appearances do not exist until the next simulation layer.
- No promise/morale consequences yet for unused purchased dates.
- No agents or advanced clauses.
- AI recruitment is intentionally simple and only responds to broad roster need and financial distress.
- One-off contracts are supported by the engine but are not autonomously booked by AI before shows exist.

## Current diagnostic finding
At 520 weeks the contract system remains invariant-safe and roster movement continues, but several smaller promotions commonly reach financial crisis and reduce recruitment. This is expected at this stage because PPW does not yet simulate live events, gate receipts or venue economics. Those missing revenues/costs belong in the show layer rather than being hidden by artificial finance balancing here.
