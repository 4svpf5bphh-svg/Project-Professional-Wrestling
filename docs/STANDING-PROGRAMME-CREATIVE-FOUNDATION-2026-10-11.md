# PPW — Standing Programme creative agreements (foundation, 11 October 2026)

**Status:** protected development branch. No UI activation, rollout, merge, Vercel preview, World reset or automatic booking effect. Requires CI and future integration work.

## Purpose

Avoid repetitive `Ask for approval` actions on every appearance by allowing a wrestler with FULL_APPROVAL rights to negotiate **one specific, bounded Programme arc**. This is not a global creative-control waiver and should feel like a meaningful backstage negotiation in the future persistent message-thread UI.

## Implemented foundation

- A new `StandingProgrammeCreativeAgreement` record persists in the planning aggregate; legacy World snapshots normalize to `[]`. It binds **World, promotion, active Programme, wrestler, strongest signed contract**, frozen current opposing side identities, match type, exact permitted outcome class, decision, decision PPW date and expiry.
- The proposed Programme must be active and controlled, the wrestler must appear in the Programme, the currently effective contract must provide FULL_APPROVAL, and the duration is limited to **1–6 PPW weeks**. All scope fields are validated.
- Scope choices for the smallest complete policy: **WIN_ONLY** or **WIN_OR_PROTECTED_LOSS**. A losing protected/flash finish can be covered only by an agreement that expressly allows it. Clean pin/submission losses never inherit a standing approval; those remain exact-match discussions. Repackaging/gimmick changes also remain separate.
- The wrestler gives **one deterministic accept/decline decision** from fictional World state. A rejected offer cannot be rerolled by repeating a request or changing proposed terms in the same Programme/contract. No extra advantage from being online.
- Pure coverage testing rejects outside opponents, unrelated teammates, match type changes, third-party interference, expired periods, ended Programmes and changed team membership. It never modifies scripted winners or match results.
- Authenticated application command wrapper applies World/ownership guards, idempotent receipt and World Lock protection. No player-facing control until full Show Card and Programme UI supports explicit reference and consent management.
- New regressions cover scope/expiry, clean-loss safeguards, deterministic refusal, legacy saves, foreign controller protection and lock behaviour.

## Planned bounded integration gates

1. Add an **explicit Programme association per match** in Show Card data/API and validate it server-side; participants alone must never infer or automatically grant a Programme waiver.
2. Connect only genuine FULL_APPROVAL *MATCH_APPROVAL* concerns to the existing blocker/consent read-model. No effect on CONSULTATION, PROTECTED_FINISHES, gimmick changes or unrelated match rights.
3. Expose offer/reply action as **one meaningful conversation** for the wrestler; visible programme/finish/expiry summary and accept/decline, later delivered as chat bubbles in Backstage.
4. Regression-test booked shows before/after lock, role changes, tag-team membership drift, overlapping contracts and two player controllers; standing permission cannot trigger self-approval by editing participants.
5. Only after that: UI ergonomics and economic tradeoffs when making creative-control terms player-selectable.

## Four standing questions

- Depends on shared Programme identities, current contract exclusivity/rights, persisted planning state and World commands.
- Later systems depend on this for repeat appearance consent, Backstage negotiations and narrative continuity.
- Pure simulated agreement/evidence lives server-side; conversational chat bubbles are a presentation of the decision, never state-setting by prose.
- Smallest complete first version is a Programme-scoped agreement with a strict scope and expiry, not unlimited global creative control.
