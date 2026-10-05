import type {
  ChampionshipReignEndReason,
  ChampionshipReignStatus,
  Id,
  PpwDate,
  TeamStatus,
} from "../../domain/src/types.js";
import { comparePpwDates } from "../../sim-core/src/index.js";
import {
  activePromotionControlForPlayer,
  activeWorldMembership,
} from "./ownership.js";
import type { ApplicationWorldAggregate } from "./world-aggregate.js";

export interface PlayerTeamMemberHistoryView {
  membershipId: Id;
  personId: Id;
  name: string;
  joinedDate: PpwDate;
  leftDate: PpwDate | null;
  active: boolean;
}

export interface PlayerTeamChampionshipReignView {
  reignId: Id;
  championshipId: Id;
  championshipName: string;
  promotionName: string;
  status: ChampionshipReignStatus;
  startDate: PpwDate;
  endDate: PpwDate | null;
  defenses: number;
  endReason: ChampionshipReignEndReason | null;
  isCurrent: boolean;
}

export interface PlayerTeamHistoryEntryView {
  teamId: Id;
  name: string;
  status: TeamStatus;
  formedDate: PpwDate;
  disbandedDate: PpwDate | null;
  currentMembers: PlayerTeamMemberHistoryView[];
  memberHistory: PlayerTeamMemberHistoryView[];
  championshipReigns: PlayerTeamChampionshipReignView[];
  totalTitleReigns: number;
  totalDefenses: number;
}

export interface PlayerTeamHistoryView {
  world: {
    worldId: Id;
    name: string;
    currentDate: PpwDate;
    revision: number;
  };
  player: {
    playerId: string;
    promotionId: Id | null;
  };
  teams: PlayerTeamHistoryEntryView[];
}

/**
 * Public tag-team history projection. Team identity, membership history and
 * championship lineage are shared World history. It deliberately excludes
 * contracts, money, Morale, fatigue, Wear, offers and future planning.
 */
export function buildPlayerTeamHistoryView(
  aggregate: ApplicationWorldAggregate,
  playerId: string,
): PlayerTeamHistoryView {
  const membership = activeWorldMembership(aggregate.ownership, playerId);
  if (!membership) throw new Error(`${playerId} is not an active member of ${aggregate.state.world.id}`);
  const control = activePromotionControlForPlayer(aggregate.ownership, playerId);

  const peopleById = new Map(aggregate.state.people.map((person) => [person.id, person]));
  const promotionsById = new Map(aggregate.state.promotions.map((promotion) => [promotion.id, promotion]));
  const championshipsById = new Map((aggregate.state.championships ?? []).map((championship) => [championship.id, championship]));

  const teams = (aggregate.state.teams ?? []).map((team): PlayerTeamHistoryEntryView => {
    const memberHistory = (aggregate.state.teamMemberships ?? [])
      .filter((entry) => entry.teamId === team.id)
      .map((entry): PlayerTeamMemberHistoryView => ({
        membershipId: entry.id,
        personId: entry.personId,
        name: peopleById.get(entry.personId)?.name ?? "Unknown wrestler",
        joinedDate: { ...entry.joinedDate },
        leftDate: entry.leftDate ? { ...entry.leftDate } : null,
        active: entry.active && entry.leftDate === null,
      }))
      .sort((left, right) => {
        if (left.active !== right.active) return left.active ? -1 : 1;
        return comparePpwDates(
          right.joinedDate,
          left.joinedDate,
          aggregate.state.ruleset.weeksPerYear,
        ) || left.name.localeCompare(right.name);
      });

    const championshipReigns = (aggregate.state.championshipReigns ?? [])
      .filter((reign) => reign.holderType === "TEAM" && reign.holderId === team.id)
      .map((reign): PlayerTeamChampionshipReignView | null => {
        const championship = championshipsById.get(reign.championshipId);
        if (!championship || championship.division !== "TAG") return null;
        return {
          reignId: reign.id,
          championshipId: championship.id,
          championshipName: championship.name,
          promotionName: promotionsById.get(championship.promotionId)?.name ?? "Unknown promotion",
          status: reign.status,
          startDate: { ...reign.startDate },
          endDate: reign.endDate ? { ...reign.endDate } : null,
          defenses: reign.defenses,
          endReason: reign.endReason,
          isCurrent: championship.currentReignId === reign.id && reign.status === "ACTIVE",
        };
      })
      .filter((entry): entry is PlayerTeamChampionshipReignView => entry !== null)
      .sort((left, right) => (
        comparePpwDates(
          right.startDate,
          left.startDate,
          aggregate.state.ruleset.weeksPerYear,
        ) || right.reignId.localeCompare(left.reignId)
      ));

    return {
      teamId: team.id,
      name: team.name,
      status: team.status,
      formedDate: { ...team.formedDate },
      disbandedDate: team.disbandedDate ? { ...team.disbandedDate } : null,
      currentMembers: memberHistory.filter((entry) => entry.active),
      memberHistory,
      championshipReigns,
      totalTitleReigns: championshipReigns.length,
      totalDefenses: championshipReigns.reduce((total, reign) => total + reign.defenses, 0),
    };
  }).sort((left, right) => {
    if (left.status !== right.status) return left.status === "ACTIVE" ? -1 : 1;
    const reignDifference = right.totalTitleReigns - left.totalTitleReigns;
    if (reignDifference !== 0) return reignDifference;
    return left.name.localeCompare(right.name);
  });

  return {
    world: {
      worldId: aggregate.state.world.id,
      name: aggregate.state.world.name,
      currentDate: { ...aggregate.state.world.currentDate },
      revision: aggregate.runtime.revision,
    },
    player: {
      playerId: membership.playerId,
      promotionId: control?.promotionId ?? null,
    },
    teams,
  };
}
