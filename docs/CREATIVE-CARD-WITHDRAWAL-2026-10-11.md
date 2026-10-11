# PPW — Pending creative-card withdrawal

**Development only, protected draft.** This wave builds on the verified PR #21 baseline. Do not merge, deploy, reset Worlds or enable contract creative tiers until release gates are complete.

## User-facing intent
When a player proposes a change to an already-materialized show and a wrestler's contractual approval is outstanding, the *existing committed card remains live*. The promoter may:
- negotiate for approval and apply the amended script;
- revise their proposed booking and seek fresh approval;
- **Withdraw changes · restore committed card**, which immediately discards the unapproved proposal and any unsaved local edits without running any booking simulation.

The restore action is one button, not a multi-screen workflow.

## Persistence and transaction guarantees
- On the first unapproved amendment to an already-materialized show, capture exactly one `PendingCreativeCardAmendment` for that promotion/show/event, containing the last applied `DetailedShowDraft` and any matching committed consent records.
- Repeated proposed edits must never overwrite that checkpoint.
- Once every required permission is granted **or** a revised card is saved without blockers, apply the new card and clear the stale checkpoint.
- Withdrawal operates only for the controlling player while the materialized show is editable, with expected World and planning revisions and idempotent command receipts.
- Restore the original draft, ordered matches, segments, roles, interfering talent, finishes, champion assignments and previously granted consents *atomically*.
- Do not re-create or replace the actual scheduled match records during withdrawal: they were not altered by an unapproved proposal. Keep match IDs, appearance fees, consumed dates, contracts, outcomes and other promotions intact.
- Existing World planning snapshots without this optional field normalize to an empty checkpoint collection. A missing checkpoint must fail closed rather than invent a historical card.

## Validation
- Saved protected loss remains proposed; current scheduled match IDs remain stable through withdrawal.
- Multiple edits retain only the original committed checkpoint.
- Unauthorized controller and stale version rejected.
- Same request returns prior receipt without duplicate writes.
- Accepted previous match approval is restored when a changed version was declined.
- Both normal approval and a non-blocked revised booking clear their checkpoints.
- Run full CI including Next build, HTTP, PostgreSQL and sim.

**Next:** policy for scheduled locks when a declined *materialized amendment* exists; programme-wide standing agreements and economic trade-offs; real multiplayer fairness and AI alternatives. No new public creative-control option yet.
