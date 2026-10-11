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

## Measured results — CI #913 (2026-10-11)

**Result: simulation invariants PASS; creative-control release decision HOLD.** The audit tool returned success with all 14 runs complete, including the real-roster scenarios. CI #913 also passed the established full test suite, web/HTTP/PostgreSQL gates and 10-/100-year seed smoke tests. The audit's success is not a claim that creative economics needs no tuning.

| Metric, treatment scenario across 7 seeds | Result |
| --- | ---: |
| AI offers generated | 5,792 |
| Accepted | 4,793 (82.75%) |
| No creative control | 2,610 (45.06% of offers) |
| Consultation | 2,777 (47.94%) |
| Protected finishes | 380 (6.56%) |
| Full approval | 25 (0.43%) |
| Offers with blocking rights (protected/full) | 405 (6.99%) |
| Accepted with protected finishes | 268 |
| Accepted with full approval | 20 |
| 52-week seed pairs with any automated creative refusal | 1 of 7 |
| Total automated creative refusals | 42 |
| Refusals attributable to one wrestler | 42 |
| Mean paired difference in completed matches | -1.86 per seed |
| Mean paired difference in cancelled shows | -0.57 per seed |
| Mean paired difference in minimum independently accessible candidates | -0.29 per seed |

**Root-cause diagnostic: repeat booking of an unwilling fully protected wrestler.** Real-roster seed `91306` had 42 declined automated attempts involving fictional in-game **Gabe Kidd / NJPW** between PPW Year 1 Week 14 and Week 52. Consent score remained **49–51**, below 55. The AI rejected the match properly, but made new attempts repeatedly rather than recognising a sustained creative impasse. This seed completed **2,004 matches versus 2,035 in control** (-31, about -1.52%). Cancelled shows were **59 vs 60**; do not infer the match shortfall directly caused cancellations. No other seed recorded an automated creative refusal. This is fictional simulator behaviour, not a real-world statement about talent.

Independent-market technical access remained large in all seven seeds; per-seed paired changes were between **-4 and +5** accessible wrestlers. This does **not** prove indie owners can sign most of them. The current market-willingness proxy uses a loose pre-negotiation threshold and counts nearly everyone contractually eligible. Test actual finite-budget indie offers and competitive bidding before asserting an economically healthy free-agent market.

## Release gates after measured results

1. **Required: fix repeated AI creative objections** without undermining wrestler control. A refusal should lead to a period of alternative AI booking (or renegotiated creative context), rather than 42 identical reattempts. Retain no rerolls/online advantages, honor all blocked results, and test long multiweek simulated careers.
2. **Required: credible human-independent economic testing** with realistic available cash, wages, multi-offer competition, and term options—not just the signed-capacity/accessibility proxy.
3. **Review consultation prevalence** (47.94% of AI offers) for alert noise and longer-term narrative consequences; consultation is not itself a veto.
4. **Extend selected horizons** beyond one PPW year once the loop is fixed, watching accumulated protections, rosters and cancellations.
5. Only after these gates, consider exposing full creative rights in the human contract offer editor with clear booking consequences, no deterministic acceptance promises.

The machine-readable source of these figures is the GitHub Actions artifact `creative-control-multiseed-audit` at run #913 and the corresponding prefixed audit entries in workflow logs.
