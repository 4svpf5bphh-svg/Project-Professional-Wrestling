import type { Id, PpwDate, StableStatus } from "../../domain/src/types.js";
import { currentRosterPersonIds } from "../../sim-core/src/contracts.js";
import { comparePpwDates, ppwDateToWeekIndex } from "../../sim-core/src/clock.js";
import { activePromotionControlForPlayer, activeWorldMembership } from "./ownership.js";
import type { ApplicationWorldAggregate } from "./world-aggregate.js";

export interface PlayerStableMemberView {
  membershipId: Id;
  personId: Id;
  name: string;
  joinedDate: PpwDate;
  leftDate: PpwDate | null;
  active: boolean;
  currentlyOnRoster: boolean;
}
export interface PlayerStableEntryView {
  stableId: Id;
  name: string;
  status: StableStatus;
  formedDate: PpwDate;
  disbandedDate: PpwDate | null;
  currentMembers: PlayerStableMemberView[];
  memberHistory: PlayerStableMemberView[];
}
/** A completed on-screen storyline that still needs an explicit roster choice.
 * Read-only: this is never a membership command or free simulation power. */
export interface PlayerStableStoryFollowThroughView {
  sourceSegmentId: Id;
  stableId: Id;
  stableName: string;
  personId: Id;
  personName: string;
  storyDate: PpwDate;
  storyType: "STABLE_INVITATION" | "STABLE_EXIT" | "STABLE_RECONCILIATION";
  action: "ADD" | "REMOVE";
  status: "READY" | "NOT_ON_ROSTER" | "OTHER_STABLE" | "STABLE_FULL" | "STABLE_INACTIVE";
}

export interface PlayerStableRosterView {
  world: { worldId: Id; name: string; currentDate: PpwDate; revision: number };
  player: { playerId: string; promotionId: Id | null };
  canEdit: boolean;
  roster: { personId: Id; name: string; stableId: Id | null }[];
  stables: PlayerStableEntryView[];
  /** The newest *performed* stable story per stable + wrestler, maximum six PPW weeks old. */
  storyFollowThrough: PlayerStableStoryFollowThroughView[];
}

/** Read-only projection. No contracts, hidden morale, or simulation adjustments. */
export function buildPlayerStableRosterView(aggregate: ApplicationWorldAggregate, playerId: string): PlayerStableRosterView {
  const membership = activeWorldMembership(aggregate.ownership, playerId);
  if (!membership) throw new Error("player is not an active member of the World");
  const control = activePromotionControlForPlayer(aggregate.ownership, playerId);
  const promotionId = control?.promotionId ?? null;
  const rosterIds = promotionId ? new Set(currentRosterPersonIds(aggregate.state, promotionId)) : new Set<string>();
  const people = new Map(aggregate.state.people.map((person) => [person.id, person]));
  const stables = (aggregate.state.stables ?? [])
    .filter((stable) => stable.promotionId === promotionId)
    .map((stable): PlayerStableEntryView => {
      const memberHistory = (aggregate.state.stableMemberships ?? [])
        .filter((member) => member.stableId === stable.id)
        .map((member): PlayerStableMemberView => ({
          membershipId: member.id,
          personId: member.personId,
          name: people.get(member.personId)?.name ?? "Unknown wrestler",
          joinedDate: { ...member.joinedDate },
          leftDate: member.leftDate ? { ...member.leftDate } : null,
          active: member.active,
          currentlyOnRoster: rosterIds.has(member.personId),
        }));
      return {
        stableId: stable.id,
        name: stable.name,
        status: stable.status,
        formedDate: { ...stable.formedDate },
        disbandedDate: stable.disbandedDate ? { ...stable.disbandedDate } : null,
        currentMembers: memberHistory.filter((m) => m.active),
        memberHistory,
      };
    })
    .sort((a, b) => (a.status === b.status ? a.name.localeCompare(b.name) : a.status === "ACTIVE" ? -1 : 1));
  const activeStableByPerson = new Map<string, Id>();
  for (const stable of stables.filter((entry) => entry.status === "ACTIVE")) {
    for (const member of stable.currentMembers) activeStableByPerson.set(member.personId, stable.stableId);
  }
  // Real history only; a draft, a reserved show or a rival promotion's
  // storyline is never presented as an owner roster task. The latest completed
  // beat supersedes an older invitation/exit for the same stable and person.
  const now = aggregate.state.world.currentDate;
  const weeksPerYear = aggregate.state.ruleset.weeksPerYear;
  const recentStory = new Map<string, typeof aggregate.state.ledger[number]>();
  const completedEventIds = new Set(aggregate.state.events
    .filter((event) => event.promotionId === promotionId && event.status === "COMPLETED")
    .map((event) => event.id));
  if (promotionId !== null) {
    const completed = aggregate.state.ledger.filter((entry) => {
      if (entry.type !== "SHOW_SEGMENT_COMPLETED" || entry.payload.promotionId !== promotionId) return false;
      if (typeof entry.payload.stableId !== "string" || typeof entry.payload.targetPersonId !== "string") return false;
      if (!["STABLE_INVITATION", "STABLE_EXIT", "STABLE_RECONCILIATION"].includes(String(entry.payload.segmentType))) return false;
      const age = ppwDateToWeekIndex(now, weeksPerYear) - ppwDateToWeekIndex(entry.date, weeksPerYear);
      if (age < 0 || age > 6 || comparePpwDates(entry.date, now, weeksPerYear) > 0) return false;
      return completedEventIds.has(String(entry.payload.eventId));
    }).sort((left, right) =>
      comparePpwDates(left.date, right.date, weeksPerYear)
      || left.order - right.order || left.id.localeCompare(right.id));
    for (const entry of completed) {
      recentStory.set(JSON.stringify([entry.payload.stableId, entry.payload.targetPersonId]), entry);
    }
  }
  const storyFollowThrough: PlayerStableStoryFollowThroughView[] = [];
  for (const entry of recentStory.values()) {
    const storyType = entry.payload.segmentType;
    const action = storyType === "STABLE_EXIT" ? "REMOVE"
      : storyType === "STABLE_INVITATION" && entry.payload.stableInvitationOutcome === "ACCEPTED"
        ? "ADD"
        : storyType === "STABLE_RECONCILIATION" && entry.payload.stableReconciliationOutcome === "RECONCILED"
          ? "ADD" : null;
    if (!action) continue; // A refused/rebuffed story cancels the older task.
    const stableId = String(entry.payload.stableId);
    const personId = String(entry.payload.targetPersonId);
    const stable = stables.find((candidate) => candidate.stableId === stableId);
    if (!stable) continue;
    const isMember = stable.currentMembers.some((member) => member.personId === personId);
    // The roster state may already be correct because the player deliberately
    // used the existing Stables control. Never ask for a duplicate command.
    if (action === "ADD" && isMember || action === "REMOVE" && !isMember) continue;
    const otherStable = stables.some((candidate) => candidate.status === "ACTIVE"
      && candidate.stableId !== stableId
      && candidate.currentMembers.some((member) => member.personId === personId));
    const status: PlayerStableStoryFollowThroughView["status"] = stable.status !== "ACTIVE"
      ? "STABLE_INACTIVE" : action === "ADD" && (!rosterIds.has(personId) || people.get(personId)?.status !== "ACTIVE")
        ? "NOT_ON_ROSTER" : action === "ADD" && otherStable
          ? "OTHER_STABLE" : action === "ADD" && stable.currentMembers.length >= 12
            ? "STABLE_FULL" : "READY";
    storyFollowThrough.push({
      sourceSegmentId: entry.id, stableId, stableName: stable.name, personId,
      personName: people.get(personId)?.name ?? "Unknown wrestler",
      storyDate: { ...entry.date },
      storyType: storyType as PlayerStableStoryFollowThroughView["storyType"],
      action, status,
    });
  }
  storyFollowThrough.sort((a, b) =>
    comparePpwDates(b.storyDate, a.storyDate, weeksPerYear)
    || a.stableName.localeCompare(b.stableName) || a.personName.localeCompare(b.personName));

  return {
    world: {
      worldId: aggregate.state.world.id,
      name: aggregate.state.world.name,
      currentDate: { ...aggregate.state.world.currentDate },
      revision: aggregate.runtime.revision,
    },
    player: { playerId: membership.playerId, promotionId },
    canEdit: aggregate.runtime.phase === "OPEN" && promotionId !== null,
    roster: [...rosterIds]
      .filter((personId) => people.get(personId)?.status === "ACTIVE")
      .map((personId) => ({
        personId,
        name: people.get(personId)?.name ?? "Unknown wrestler",
        stableId: activeStableByPerson.get(personId) ?? null,
      }))
      .sort((a, b) => a.name.localeCompare(b.name)),
    stables,
    storyFollowThrough,
  };
}
