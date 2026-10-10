# PPW booking-system audit — 10 October 2026

Baseline: `alpha-attack-roles-work` at `731ae307` (CI #767 green).
Scope: read-through of planning validation, authored segment resolution, immutable ledger, programme signals, booking, morale, relationship foundation and existing regression tests. This audit is not a claim of exhaustive playtesting.

## Invariants retained

- **The player authors the wrestling script.** Named roles, outcomes, run-ins, stables, betrayals, challenges, contract signings and turn intentions are inputs to booking. Ratings and reactions are calculated separately. Story outcomes must never be rerolled by the sim.
- **World Lock is factual.** `SHOW_SEGMENT_COMPLETED` records only a completed show; drafted angles are not history. The resolver checks already-recorded draft segment IDs, so retries must not duplicate events.
- **Stable identity is persistent.** Invitations, expulsions, walkouts and reconciliations freeze stable ID, name, people and on-screen result. None of those theatrical acts silently creates/removes real `stableMemberships`.
- **Real state is a separate decision.** A turn's alignment change is an explicit, idempotently applied effect. That existing exception does not license changing contract, team or stable membership when a wrestling storyline says otherwise.
- **Show structure matters.** Post-match assault has to follow its referenced match immediately; actual match result is frozen independently from the angle.
- **Multiplayer first.** World Lock and persisted World state remain authoritative; this wave must give no more simulation power to whoever happens to be online.

## Findings and follow-up gates

1. **Multiple angles, one Programme signal** — `recordResolvedShowSegments` currently records at most one Programme `SEGMENT` activity per event, and `evaluateProgrammeSignals` stores a single resolved-segment impact per event (effectively the latest one). A multi-angle show can therefore underrepresent or misattribute what drove its heat. Preserve current balance until a targeted change decides whether to aggregate or weight angles; add multi-angle regression tests before modifying programme math.
2. **Legacy directed angles** — older saved directed segments may lack explicit initiator/target. Preserve compatibility, but never infer an authored refusal, acceptance or victim for those historical records.
3. **No causal talent response yet** — scripted segments provide delivery, crowd response and ledger facts, but they currently do not form a per-wrestler memory/read model or independently shape expectations, backstage trust and morale. Model cause before applying penalties: a wrestler can play a rejected recruit convincingly without their real counterpart automatically deciding to leave.
4. **Scale** — avoid rescanning all historical Ledger entries on every weekly sim tick. A bounded, on-demand memory view is appropriate for the first iteration; materialized/indexed consequences should be introduced only with measured performance and replay coverage.
5. **Presentation debt, intentionally deferred** — current booking controls have not received the full card-picker UX polish or consistent wrestling vocabulary review. Preserve a clean surface for the upcoming overhaul, but do not mix redesign with mechanical consequences.

## This bounded next slice

`talentStoryMemoriesForPerson` is a **read-only** view over resolved `SHOW_SEGMENT_COMPLETED` records. It captures the participant's role, counterpart, stable as named on the night, scripted beat and separate evaluated execution. It does not change the ruleset, simulation hash, persistent schema, active relationships, morale, trust, contracts, stable memberships or the UI. Regression coverage verifies draft-vs-resolved separation, factual history, non-duplication, frozen identity and role labels.

## Next development increments (not part of this commit)

1. **Talent expectations** — distinguish contractual role expectations from booker-visible promises and what has actually been delivered; use completed shows, not unscheduled narrative drafts.
2. **Consequences** — deterministic, bounded, explainable backstage reactions to repeated booking treatment. A scripted rejection/attack/betrayal stays scripted; wrestlers react to believable treatment and working relationships, not randomly change the on-screen result.
3. **Relationship and trust integration** — reuse `wrestlerRelationships`, promotion talent trust and existing morale processing, with a single World Lock pass, replay protection and no new hidden competitive advantage.
4. **Exposure and explanation** — surface the leading causes on wrestler profiles/booker briefings later, after the underlying behaviour is proven and UI consolidation is designed.
