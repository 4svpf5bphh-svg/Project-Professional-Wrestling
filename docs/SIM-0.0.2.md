# SIM-0.0.2 Finance Foundation

This milestone introduces the first deterministic weekly simulation consequences.

## Included
- Signed financial transaction ledger separate from the historical World Ledger.
- Baseline media and sponsorship income by promotion scale.
- Fixed promotion overhead.
- Genesis roster talent commitments as an interim recurring cost until formal contracts replace them.
- Weekly net result and cash movement.
- Runway estimation.
- Financial health states: Healthy, Watch, Distressed, Crisis.
- Ledger events when financial distress changes.
- World-week resolver that settles finance before advancing the PPW clock.
- Deterministic multi-week finance testing.

## Important limitation
The talent commitment is deliberately a Genesis-era recurring obligation, not the final contract/payroll model. SIM-0.0.3 replaces roster ownership with formal contracts and date entitlements; finance transactions remain the permanent accounting mechanism.

SIM-0.0.2 does not yet make AI promotions respond to financial distress. Bad economics are allowed to become visible so later AI behaviour can be tested against real pressure rather than hidden balancing.
