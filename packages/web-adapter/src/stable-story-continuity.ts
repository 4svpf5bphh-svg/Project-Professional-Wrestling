import type { PlayerStableStoryFollowThroughView } from "../../application/src/stable-view.js";
import type { AlphaCardSegmentView } from "./card-service.js";

/** Owner-only, non-blocking booking guidance. Factual prior performed scenes
 * come from the already filtered private stable roster view, never from rival
 * plans. All checks use the current *unsaved* card to respond immediately. */
export function stableStoryContinuityWarnings(
  segment: AlphaCardSegmentView,
  previous: readonly PlayerStableStoryFollowThroughView[],
  cardSegments: readonly AlphaCardSegmentView[],
): string[] {
  if (!["STABLE_INVITATION", "STABLE_EXIT", "STABLE_RECONCILIATION"].includes(segment.type)
    || !segment.stableId || !segment.targetPersonId) return [];

  const notices: string[] = [];
  const prior = previous.find((story) => story.stableId === segment.stableId
    && story.personId === segment.targetPersonId);
  if (prior) {
    const onScreen = prior.storyType === "STABLE_EXIT" ? "left or was expelled from"
      : prior.storyType === "STABLE_RECONCILIATION" ? "reconciled with" : "accepted an invitation to";
    const followThrough = prior.action === "REMOVE" ? "departure" : "membership";
    notices.push(
      `${prior.personName} already ${onScreen} ${prior.stableName} on television `
      + `(Y${prior.storyDate.year} W${prior.storyDate.week}), but the real roster ${followThrough} `
      + "has not been confirmed. You can still book this angle, or review Roster → Stables.",
    );
  }

  const otherOnCard = cardSegments.some((entry) =>
    entry.draftSegmentId !== segment.draftSegmentId
    && ["STABLE_INVITATION", "STABLE_EXIT", "STABLE_RECONCILIATION"].includes(entry.type)
    && entry.stableId === segment.stableId && entry.targetPersonId === segment.targetPersonId);
  if (otherOnCard) {
    notices.push("This show contains another stable storyline for the same wrestler and group. Check the running order and intended progression.");
  }
  return notices;
}
