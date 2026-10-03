# SIM-0.0.11 — Talent Reputation, Trust, Morale and Renewal Resistance

SIM-0.0.11 adds a first persistent relationship layer between promotions and wrestlers. The goal is deliberately restrained: treatment now matters, but the simulation does not yet turn every unhappy wrestler into a disruptive event generator.

## Scope

### Talent Reputation

Promotion Standing gains a fourth dimension: **Talent Reputation**.

It is derived from observable treatment rather than declared identity. Annual evidence includes roster usage, renewal acceptance, continuity, restructuring and involuntary releases. A promotion can therefore be commercially healthy while developing a poor reputation among talent, or vice versa.

### Wrestler–promotion Trust

Each wrestler/promotion relationship can carry persistent Trust. Trust begins neutral and is evaluated annually from the actual history of that relationship, including:

- appearances and meaningful usage;
- being contracted but rarely used;
- restructuring-related termination;
- promotion dormancy.

Trust is relationship-specific rather than a universal wrestler mood.

### Trust-aware contract decisions

Trust feeds contract utility as a secondary factor. Money and contract terms remain the dominant drivers, but strong or poor Trust can decide a genuinely marginal offer. Neutral Trust preserves the previous contract baseline.

### Weekly wrestler Morale

Wrestlers now carry dynamic Morale. Weekly evidence includes:

- whether contracted wrestlers are actually used when their promotion runs;
- role expectation when a wrestler is omitted;
- momentum;
- fatigue;
- promotion financial distress;
- promotion dormancy/closure pressure.

Free agents drift gently toward neutral rather than collapsing simply because they were not booked by a promotion that does not employ them. Injured wrestlers are not penalized as if they were deliberately omitted from shows.

### Renewal relationship resistance

Morale and Trust now have one deliberately narrow gameplay consequence: they can veto a **marginal renewal** when the relationship is severely damaged.

Guardrails:

- strong renewal offers survive even very poor Morale and Trust;
- strong Trust can cushion a temporary Morale dip;
- recruitment offers are not filtered by this renewal-specific resistance;
- the system does not yet create automatic walkouts, release requests, ultimatums or other broad relationship events.

## Performance work

The first release candidate exposed a century-scale runtime regression. Two behaviour-preserving optimizations were added:

1. renewal resistance scans only the current week's relevant offer tail rather than all historical offers;
2. weekly Morale no longer rescans the complete historical contract archive. It maintains an incremental candidate cache and prunes contracts that can no longer be active.

The second change removed the dominant regression: the standard 100-year Actions step fell from roughly 166 seconds to roughly 86 seconds on comparable hosted runners while preserving every deterministic output checked by the release gate.

## Validation

SIM-0.0.11 passes **85/85 behavioural tests**.

Standard seed `20261002`:

- 10 PPW Years: deterministic hash `6a5dcd3b`
- 100 PPW Years: deterministic hash `7662b626`
- Year 101: 385 active wrestlers from 678 historical wrestlers
- 293 retired wrestlers
- 278 generated talents
- 105 contracted wrestlers and 280 free agents
- 211 active contracts
- 102,197 historical contract offers
- 27,083 completed events
- 138,114 completed matches
- 5,765 championship contests
- 1,711 historical injuries
- zero invariant failures

## Milestone consequence

SIM-0.0.11 is the final planned SIM-0.0.x milestone before **ALPHA-1A**. The headless World now has enough economy, labour market, competition, history and human-readable consequence to begin introducing a real human-controlled promotion without replacing the deterministic simulation underneath it.
