import type { Id, PpwDate, StableStatus } from "../../domain/src/types.js";
import { currentRosterPersonIds } from "../../sim-core/src/contracts.js";
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
export interface PlayerStableRosterView {
  world: { worldId: Id; name: string; currentDate: PpwDate; revision: number };
  player: { playerId: string; promotionId: Id | null };
  canEdit: boolean;
  roster: { personId: Id; name: string; stableId: Id | null }[];
  stables: PlayerStableEntryView[];
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
  };
}
