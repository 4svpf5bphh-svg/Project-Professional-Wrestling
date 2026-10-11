# PPW — Creative-control multi-seed contract & booking balance audit

Status: CI-only draft based on PR #28 / CI #910. Never merge, deploy, preview or reset a World as a side effect of this audit.

## Question
Would granting reasonable creative rights in AI promotion contract offers make the shared World unplayable for human independent owners, flood AI companies with protected wrestlers, or generate too many match refusals?

## Method
- Seven fixed, reproducible seeds: **four** procedural 400-person Worlds and **three** real-roster 643-person Worlds using the current real-promotion and roster assignment sources. Every seed is played through **52 PPW weeks**.
- Each seed produces two separate **paired counterfactual Worlds**: the actual prospective AI creative policy and a control with exactly the same initial seed and pay/offer generation, except *new AI contract offers* have no new creative clause before standard wrestler evaluation. The production simulator is unchanged when no audit hook is passed.
- Total: **14 independently resolved Worlds, 728 PPW weeks**. No asynchronous owner power, no synthetic takeover or fake auto-login. Actual AI's scripted booking respects its signed creative clauses in both arms.
- World outcomes can diverge after one contract decision; deltas indicate direction of systemic impact, **not a causal proof** of an isolated match result.

## Quantitative readouts
For each seed, cohort, and paired arm:
- Generated AI offers and accepted offers, by each of the four creative-rights levels.
- Active signed contract prevalence (including Genesis contracts), acceptance percentage, and rights offered by promotion tier.
- Actual automated approvals, refusals, and protected finishes from the sim ledger.
- Completed matches, completed shows, cancellations, overall cancellations as a fraction of concluded shows.
- Independent-market *technical* accessibility and likely willingness: how many active wrestlers could accept a modest 13-week nonexclusive proposal, how many have recognition at least 60, and how many clear the wrestler's **preliminary utility** threshold window. Min/median across takeover-eligible independent promotions. This is a *proxy*, not a promise of acceptance or affordability.

The report writes machine-readable `artifacts/creative-multiseed-audit.json`, and each pair plus summary prints prefixed JSON in CI logs. GitHub Actions retains the JSON as a downloadable audit artifact; no Vercel deployment is created.

## Structural test gates versus advisory watchlist
**Hard fail**: any World invariant error, or an entire seed fails to generate AI offers; these invalidate a balance audit.

**Advisory investigation** (do not automatically label a release safe): any paired increase in show cancellations or refused match assignments, any loss in completed matches, reduction in hypothetical independent market access, no willing independent-market candidates, or complete lack of newly granted blocking rights. Review actual magnitudes, affected wrestler tiers and signs over longer horizons before enabling contract UI.

**Intentionally deferred**: 3+ real-world PPW years of actual human managers making offers in a multiplayer World, contract negotiation UI/consumer copy, a large sampled set of different dynamic booking scripts, production monitoring and release/reset.

## Dependency/mantra
- Depends on deterministic contract evaluation, full AI creative consent and scripted-booking separation.
- Later unlocks a meaningful four-choice human contract-negotiation editor and repeated Backstage/Programme consent playtesting.
- Metrics are from server-authoritative simulation and signed states; the reporting/graph is **presentation**, not a new balance rule.
- Smallest useful first gate is paired multi-seed 52-week runs with diagnostics and full invariant checks, not blindly choosing an untested rejection/offer cap.

Audit release gate: review the recorded numbers before deciding if contract rights are ready for player-facing offer selection; a green CI run alone is insufficient.
