# ALPHA-1A Gate A — Human/AI Lifecycle Parity

Status: **Complete**

This slice removes the unintended lifecycle immunity previously granted to human-controlled promotions.

## Objective lifecycle state is controller-neutral

`processPromotionSurvivalForWeek()` now evaluates every operating promotion, regardless of `controllerType`.

The following are universal:

- financial-distress survival counters;
- healthy/stress/crisis/understaffed week accumulation;
- entering the objective `DISTRESSED` lifecycle state;
- recovery after the normal healthy threshold;
- hard Dormancy conditions;
- contract termination and offer withdrawal when Dormancy occurs.

A human-owned promotion therefore cannot avoid decline simply because it is player controlled.

## Strategic policy remains controller-specific

AI promotions retain the existing automatic policy:

- restructure when the survival threshold is due;
- perform emergency recruitment when required.

Human promotions are not automatically managed in the same way. Instead the simulation exposes the derived current-state query:

- `humanPromotionSurvivalAction(state, promotionId)`

When restructuring is due it returns `RESTRUCTURE_REQUIRED` with current distress/roster context.

The human command:

- `applyHumanPromotionRestructure(state, promotionId)`

uses the exact existing restructuring and emergency-recruitment mechanics. It does not change ownership/control.

The future application Attention layer can therefore surface this derived action without using the Ledger as current decision state.

## Ignoring the action is not immunity

If a human promotion remains in a sufficiently severe insolvent and understaffed crisis, the same hard Dormancy threshold applies even if the restructuring action was not taken.

Dormancy does not silently convert or remove the human controller. Corporate failure and player identity remain separate concerns; later application ownership/succession/founding rules decide what the player can do next.

## Regression contract

The existing AI policy and deterministic simulation must remain unchanged. Validation requires:

- the complete functional suite;
- the standard 10-year hash `6a5dcd3b`;
- the standard 100-year hash `7662b626`;
- zero invariant failures.

With this slice, Gate A is complete:

1. explicit persistence schema/version;
2. live championship booking state;
3. persistent deterministic entity IDs;
4. staff execution separated from ownership/control;
5. human/AI promotion lifecycle parity.
