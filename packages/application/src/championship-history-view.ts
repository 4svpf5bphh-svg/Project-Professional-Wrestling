import type {
  ChampionshipDivision,
  ChampionshipHolderType,
  ChampionshipReignEndReason,
  ChampionshipReignStatus,
  ChampionshipStatus,
  Id,
  PpwDate,
} from "../../domain/src/types.js";
import { ppwDateToWeekIndex } from "../../sim-core/src/index.js";
import {
  activePromotionControlForPlayer,
  activeWorldMembership,
} from "./ownership.js";
import type { ApplicationWorldAggregate } from "./world-aggregate.js";

export interface PlayerChampionshipReignView {
  reignId: Id;
  holderType: ChampionshipHolderType;
  holderId: Id;
  holderName: string;
  status: ChampionshipReignStatus;
  startDate: PpwDate;
  endDate: PpwDate | null;
  defenses: number;
  endReason: ChampionshipReignEndReason | null;
  isCurrent: boolean;
}

export interface PlayerChampionshipLineageView {
  championshipId: Id;
  promotionId: Id;
  promotionName: string;
  name: string;
  division: ChampionshipDivision;
  status: ChampionshipStatus;
  prestige: number;
  createdDate: PpwDate;
  currentHolderName: string | null;
  totalReigns: number;
  totalDefenses: number;
  lineage: PlayerChampionshipReignView[];
}

export interface PlayerChampionshipHistoryView {
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
  championships: PlayerChampionshipLineageView[];
}

function dateOrder(aggregate: ApplicationWorldAggregate, date: PpwDate): number {
  return ppwDateToWeekIndex(date, aggregate.state.ruleset.weeksPerYear) * 7 + date.day;
}

function holderName(
  aggregate: ApplicationWorldAggregate,
  holderType: ChampionshipHolderType,
  holderId: Id,
): string {
  if (holderType === "PERSON") {
    return aggregate.state.people.find((person) => person.id === holderId)?.name ?? "Unknown wrestler";
  }
  return (aggregate.state.teams ?? []).find((team) => team.id === holderId)?.name ?? "Unknown team";
}

/**
 * Public championship-history projection. Championship lineage is treated as
 * shared wrestling history; rival finances, contract terms, Morale, fatigue,
 * Wear, offers and future planning are deliberately excluded.
 */
export function buildPlayerChampionshipHistoryView(
  aggregate: ApplicationWorldAggregate,
  playerId: string,
): PlayerChampionshipHistoryView {
  const membership = activeWorldMembership(aggregate.ownership, playerId);
  if (!membership) throw new Error(`${playerId} is not an active member of ${aggregate.state.world.id}`);
  const control = activePromotionControlForPlayer(aggregate.ownership, playerId);
  const promotionNamesById = new Map(aggregate.state.promotions.map((promotion) => [promotion.id, promotion.name]));

  const championships = (aggregate.state.championships ?? []).map((championship): PlayerChampionshipLineageView => {
    const lineage = (aggregate.state.championshipReigns ?? [])
      .filter((reign) => reign.championshipId === championship.id)
      .slice()
      .sort((left, right) => (
        dateOrder(aggregate, right.startDate) - dateOrder(aggregate, left.startDate)
        || right.id.localeCompare(left.id)
      ))
      .map((reign): PlayerChampionshipReignView => ({
        reignId: reign.id,
        holderType: reign.holderType,
        holderId: reign.holderId,
        holderName: holderName(aggregate, reign.holderType, reign.holderId),
        status: reign.status,
        startDate: { ...reign.startDate },
        endDate: reign.endDate ? { ...reign.endDate } : null,
        defenses: reign.defenses,
        endReason: reign.endReason,
        isCurrent: championship.currentReignId === reign.id && reign.status === "ACTIVE",
      }));
    const current = lineage.find((reign) => reign.isCurrent) ?? null;

    return {
      championshipId: championship.id,
      promotionId: championship.promotionId,
      promotionName: promotionNamesById.get(championship.promotionId) ?? "Unknown promotion",
      name: championship.name,
      division: championship.division,
      status: championship.status,
      prestige: championship.prestige,
      createdDate: { ...championship.createdDate },
      currentHolderName: current?.holderName ?? null,
      totalReigns: lineage.length,
      totalDefenses: lineage.reduce((total, reign) => total + reign.defenses, 0),
      lineage,
    };
  }).sort((left, right) => {
    if (left.status !== right.status) return left.status === "ACTIVE" ? -1 : 1;
    const prestigeDifference = right.prestige - left.prestige;
    if (prestigeDifference !== 0) return prestigeDifference;
    const promotionDifference = left.promotionName.localeCompare(right.promotionName);
    if (promotionDifference !== 0) return promotionDifference;
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
    championships,
  };
}
