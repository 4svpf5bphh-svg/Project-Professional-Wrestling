# PPW — Stable Storylines and Real Membership Follow-Through
13 October 2026. **Draft only; stacked above PR #70. No merge, deployment, World reset or automatic membership change.**

## The actual problem

PPW distinguishes *kayfabe* from *canonical World state*. The promoter can script a recruit accepting an invitation, an existing member being expelled or walking out, or a former member reconciling. The real stable roster is administered separately through authoritative, idempotent `ADD_STABLE_MEMBER` and `REMOVE_STABLE_MEMBER` commands, with real membership dates and audit ledger events.

Those systems must not be collapsed. Automatic changes following a televised segment would make the game less player-authored and would risk conflicting with World Lock, existing roster decisions, stable size caps and multiplayer chronology. But if the user never follows through, the televised storyline and roster remain inconsistent; repeating an expulsion while the wrestler still appears as a member is confusing.

## First complete implementation

**Read-only owner-scoped projection:** `buildPlayerStableRosterView` now exposes `storyFollowThrough`. It considers only recent `SHOW_SEGMENT_COMPLETED` entries of the **player-controlled promotion** referencing a genuinely **COMPLETED event** within the latest six PPW weeks. It chooses the **latest completed stable story per stable + target wrestler**, ordered by PPW date and canonical ledger order:

- **Invitation accepted** → proposed real **ADD**.
- **Exit: expelled or walked out** → proposed real **REMOVE**.
- **Reconciliation accepted** → proposed real **ADD**.
- **Invitation refused / reconciliation rebuffed** → no real roster action, and they supersede an earlier accepted storyline.

If the roster already matches that storyline, no prompt appears. A draft, reservation, materialized-but-unperformed segment, unrelated promotion, future event, or obsolete earlier storyline never creates an action. The hint ages out after six PPW weeks rather than trying to rewrite ancient story history.

An action can be **READY**, or flagged as blocked when the stable was disbanded, the wrestler is no longer on that active roster, a different stable claims them, or the 12-person cap has been reached. The projection reads World state but **mutates nothing**.

**Private Results** includes a link from eligible completed stable scenes to **Roster → Stables**, describing that the televised result is not an automatic membership update. Public World Results still show only the performed segment; they do not reveal the booker's outstanding administration tasks.

**Roster → Stables** displays recent unresolved stories and a plainly labelled **Confirm stable membership/departure** button. The player gets an explicit confirmation dialog, then the UI calls the **existing** `/api/stables` `ADD`/`REMOVE` command, with the usual revision, idempotency, ownership, world lock and roster-size validations. No new unrestricted write endpoint or power is introduced. A successful command refreshes the view and clears the corresponding task.

## Why this is not an automatic "apply scripted outcome" switch

- A fictional handshake, invitation, expulsion or reconciliation is a kayfabe scene.
- Roster changes may have knock-on effects on membership exclusivity, eligibility, Backstage, introductions and future programmatic validity.
- The *promoter* is the sole author of the real change. Real World state must be server authoritative and ledger recorded.
- Users are never blocked from advancing the World by an unconfirmed stable story. Follow-through is helpful, not a forced workflow or gameplay reward.

## Four dependency questions

1. **Depends on:** existing stable identity and membership command service, promotion ownership, completed-segment ledger, completed events, PPW date ordering, a stable's real membership.
2. **Later depends on this:** roster-relative booking warnings, stable storyline arcs, performer consequences and more expressive Results. The UI can later distinguish "kayfabe stable storyline active" from "official roster member" without assuming they're the same.
3. **Authority vs presentation:** membership commands, World chronology, actual stable records and completed storyline evidence are authority-side. Outstanding reminder status and button text are read-only presentation; confirmation invokes an existing authorised command.
4. **Smallest complete first version:** current owner-only follow-through projection; completed-event and freshness gates; private Results navigation; one explicit confirmation from existing stable UI; regression tests confirming no mutations before confirmation, then actual ledger-backed changes and task reconciliation.

## Boundaries / deferred

- Do not add automatic stable membership changes at show resolution.
- Do not turn a "contract signing" angle into a real employment contract.
- A story reminder expires after six PPW weeks. Historical narrative remains intact, but later storyline-state canon is still a richer separate system.
- Later: owner-only *pre-booking* consistency and freshness hints for repeating faction exits while no roster action has happened, and an optional prompt integrated into show wrap-up. Do not expose rival private booking drafts.
- No changes to title/financial/contracts systems, no state-schema migration, no CI-invisible change to results or World Lock.

**Verification:** Run full CI on latest branch head, then restore stacked PR base to #70; do not merge or deploy.
