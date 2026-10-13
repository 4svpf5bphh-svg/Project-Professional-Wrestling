# PPW — Owner-Only Card Stable Story Continuity
13 October 2026 — draft stacked above #71, no merge/deploy/reset.

## Problem & minimal solution

A wrestler may accept a stable invitation, leave the group on television, or reconcile on-screen, while the authoritative roster awaits the promoter's separate confirmation. The roster now exposes those pending completed-show story events. The **Card also needs to tell the booker before accidentally scripting the same unresolved beat again**.

This pass provides **non-blocking guidance, not a creative veto**. The booker still decides the segment, participants, outcome and when (or whether) to reconcile real membership. World Lock and simulation state are unchanged.

### Mechanism

- The existing owner-authorised `buildPlayerStableRosterView` projection provides `storyFollowThrough`. It includes only that player's promotion, completed shows, a real `SHOW_SEGMENT_COMPLETED` ledger record, the latest not-superseded story per stable + target, at most six PPW weeks old, which has an unresolved canonical membership action.
- The private Show Card read returns this **filtered projection**, never another promotion's private planning, pending bids or unreconciled backstage history.
- The pure `stableStoryContinuityWarnings` helper receives the **current unsaved segment** and **current unsaved card**. For STABLE_INVITATION, STABLE_EXIT, STABLE_RECONCILIATION with a chosen stable + wrestler, it reports:
  1. An already-performed story for that wrestler/group awaiting real roster follow-through, with the story week and a link direction to Roster → Stables.
  2. Another stable beat for the same wrestler + group on the same card, so the booker can check running-order progression.
- Editing the target, stable, segment type or rundown recalculates immediately. This is an advisory and never disables Save or Advance.
- Styling uses a compact "Story continuity" note within the expanded editor, not an interrupting modal or permanent banner over the card.
- Confirming the existing Add/Remove action in Roster → Stables removes the reminder on the next Card load. No second membership command system or new economic effect is created.

### Four dependency questions

1. **Depends on:** PR #71's completed-story follow-through, stable membership, owner-scoped Card projection and current unsaved booking context.
2. **Later depends on:** visible booking freshness hints for other segment kinds, storyline-aware narrative recaps, richer Show Results presentation, and eventual real stable status in backstage/social narrative.
3. **State vs presentation:** actual show ledger and stable membership remain server-authoritative. These notes are read-only owner-facing presentation, including same-card duplicate detection; they never advance state or affect scoring.
4. **Smallest complete implementation:** filtered Card data; a deterministic pure note helper; reactive UI; regression checks covering performed expulsion, no auto-removal, distinct wrestler/type, duplicate on the same card and clearing after explicit membership confirmation.

### Important guardrails

- No automatic membership changes from a scripted invitation, expulsion, or reconciliation.
- No hard prohibition on intentional callbacks or same-show multi-beat progression.
- No rival-private story leaks.
- No brand-new global repetition penalty.
- No deployment or state reset.
- Keep larger match/segment Results visual overhaul after this logical continuity layer.

**Verification:** A green PR #71 does not validate this branch; run full CI on this exact head, then restore the stacked base.
