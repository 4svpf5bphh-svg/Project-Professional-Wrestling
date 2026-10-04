import type { Id, PersonStatus, PpwDate, PromotionTier, TicketStrategy } from "../../domain/src/types.js";
import { addPpwWeeks, comparePpwDates, ppwDateToWeekIndex } from "../../sim-core/src/clock.js";
import { activePromotionControlForPlayer, activeWorldMembership } from "./ownership.js";
import { DETAILED_PLANNING_HORIZON_WEEKS, type DetailedShowDraft } from "./planning.js";
import {
  playerShowPlanningStatus,
  type PlayerShowPlanningAction,
  type PlayerShowPlanningState,
  type PlayerShowReadiness,
} from "./planning-status.js";
import type { ApplicationWorldAggregate } from "./world-aggregate.js";

export type PlayerPlannerShowState = "UNPLANNED" | PlayerShowPlanningState;

export interface PlayerPlannerParticipantView {
  personId: Id;
  name: string;
}

export interface PlayerPlannerTalentOptionView {
  personId: Id;
  name: string;
  status: PersonStatus;
  popularity: number;
  momentum: number;
  morale: number;
  datesRemaining: number;
}

export interface PlayerPlannerVenueOptionView {
  venueId: Id;
  name: string;
  capacity: number;
  weeklyHireCost: number;
  prestige: number;
}

export interface PlayerPlannerMarketOptionView {
  marketId: Id;
  name: string;
  isHomeMarket: boolean;
  venues: PlayerPlannerVenueOptionView[];
}

export interface PlayerPlannerShowView {
  draftId: string;
  targetDate: PpwDate;
  state: PlayerPlannerShowState;
  readiness: PlayerShowReadiness;
  marketId: Id | null;
  marketName: string | null;
  venueId: Id | null;
  venueName: string | null;
  ticketStrategy: TicketStrategy | null;
  participants: PlayerPlannerParticipantView[];
  reservedParticipantCount: number;
  matchCount: number;
  reservationId: string | null;
  riskReasons: string[];
  workspaceChangedSinceReservation: boolean;
  availableActions: PlayerShowPlanningAction[];
}

export interface PlayerPlannerWeekView {
  offset: number;
  year: number;
  week: number;
  isCurrentWeek: boolean;
  showRequired: boolean;
  canPlan: boolean;
  minParticipants: number;
  maxParticipants: number;
  eligibleParticipants: PlayerPlannerTalentOptionView[];
  shows: PlayerPlannerShowView[];
}

export interface PlayerSixWeekPlannerView {
  world: {
    worldId: Id;
    name: string;
    currentDate: PpwDate;
    phase: ApplicationWorldAggregate["runtime"]["phase"];
    revision: number;
  };
  player: {
    playerId: string;
    promotionId: Id | null;
  };
  promotion: null | {
    promotionId: Id;
    name: string;
    homeMarketId: Id;
    workspaceVersion: number;
    horizonWeeks: number;
    ticketStrategies: TicketStrategy[];
    markets: PlayerPlannerMarketOptionView[];
    weeks: PlayerPlannerWeekView[];
  };
}

const PLANNER_TICKET_STRATEGIES: TicketStrategy[] = ["ACCESSIBLE", "STANDARD", "PREMIUM", "PRESTIGE"];

function sameWeek(left: PpwDate, right: PpwDate): boolean {
  return left.year === right.year && left.week === right.week;
}

function showRequiredInWeek(
  aggregate: ApplicationWorldAggregate,
  promotionId: Id,
  targetDate: PpwDate,
): boolean {
  const promotion = aggregate.state.promotions.find((candidate) => candidate.id === promotionId);
  if (!promotion || promotion.lifecycle === "DORMANT" || promotion.lifecycle === "CLOSED") return false;
  const weekIndex = ppwDateToWeekIndex(targetDate, aggregate.state.ruleset.weeksPerYear);
  return weekIndex % Math.max(1, promotion.eventCadenceWeeks) === 0;
}

function maxShowParticipants(
  tier: PromotionTier,
  date: PpwDate,
  weeksPerYear: number,
  majorEventIntervalWeeks: number,
): number {
  const regular = tier === "GLOBAL"
    ? 16
    : tier === "NATIONAL"
      ? 14
      : tier === "RISING"
        ? 12
        : tier === "INDEPENDENT"
          ? 10
          : 8;
  const weekIndex = ppwDateToWeekIndex(date, weeksPerYear);
  return (weekIndex + 1) % majorEventIntervalWeeks === 0 ? regular + 2 : regular;
}

function contractTouchesWeek(
  aggregate: ApplicationWorldAggregate,
  startDate: PpwDate,
  endDate: PpwDate,
  targetDate: PpwDate,
): boolean {
  for (let day = 1; day <= 7; day += 1) {
    const date = { year: targetDate.year, week: targetDate.week, day };
    if (
      comparePpwDates(date, startDate, aggregate.state.ruleset.weeksPerYear) >= 0
      && comparePpwDates(date, endDate, aggregate.state.ruleset.weeksPerYear) <= 0
    ) return true;
  }
  return false;
}

function eligibleParticipantsForWeek(
  aggregate: ApplicationWorldAggregate,
  promotionId: Id,
  targetDate: PpwDate,
): PlayerPlannerTalentOptionView[] {
  const peopleById = new Map(aggregate.state.people.map((person) => [person.id, person]));
  const remainingByPerson = new Map<Id, number>();

  for (const contract of aggregate.state.contracts) {
    if (contract.promotionId !== promotionId || contract.status !== "SIGNED") continue;
    const remaining = Math.max(0, contract.dateEntitlement - contract.datesUsed);
    if (remaining <= 0) continue;
    if (!contractTouchesWeek(aggregate, contract.startDate, contract.endDate, targetDate)) continue;
    remainingByPerson.set(contract.personId, (remainingByPerson.get(contract.personId) ?? 0) + remaining);
  }

  const result: PlayerPlannerTalentOptionView[] = [];
  for (const [personId, datesRemaining] of remainingByPerson.entries()) {
    const person = peopleById.get(personId);
    if (!person || person.status !== "ACTIVE") continue;
    result.push({
      personId,
      name: person.name,
      status: person.status,
      popularity: person.popularity,
      momentum: person.momentum,
      morale: person.morale,
      datesRemaining,
    });
  }
  return result.sort((left, right) => right.popularity - left.popularity || left.name.localeCompare(right.name));
}

function showView(
  aggregate: ApplicationWorldAggregate,
  promotionId: Id,
  draft: DetailedShowDraft,
): PlayerPlannerShowView {
  const status = playerShowPlanningStatus(
    aggregate.state,
    aggregate.planning,
    aggregate.runtime,
    promotionId,
    draft.draftId,
  );
  const peopleById = new Map(aggregate.state.people.map((person) => [person.id, person]));
  const market = draft.marketId
    ? aggregate.state.markets.find((candidate) => candidate.id === draft.marketId) ?? null
    : null;
  const venue = draft.venueId
    ? aggregate.state.venues.find((candidate) => candidate.id === draft.venueId) ?? null
    : null;
  const reservation = aggregate.planning.showReservations.find((candidate) => (
    candidate.promotionId === promotionId && candidate.sourceDraftId === draft.draftId
  )) ?? null;

  return {
    draftId: draft.draftId,
    targetDate: { ...draft.targetDate },
    state: status.state,
    readiness: status.readiness,
    marketId: draft.marketId,
    marketName: market?.name ?? null,
    venueId: draft.venueId,
    venueName: venue?.name ?? null,
    ticketStrategy: draft.ticketStrategy,
    participants: draft.participantIds.map((personId) => ({
      personId,
      name: peopleById.get(personId)?.name ?? "Unknown wrestler",
    })),
    reservedParticipantCount: reservation?.participants.length ?? 0,
    matchCount: draft.matches.length,
    reservationId: status.reservationId,
    riskReasons: status.riskReasons.map((reason) => String(reason)),
    workspaceChangedSinceReservation: status.workspaceChangedSinceReservation,
    availableActions: [...status.availableActions],
  };
}

export function buildPlayerSixWeekPlannerView(
  aggregate: ApplicationWorldAggregate,
  playerId: string,
): PlayerSixWeekPlannerView {
  const membership = activeWorldMembership(aggregate.ownership, playerId);
  if (!membership) throw new Error(`${playerId} is not an active member of ${aggregate.state.world.id}`);

  const currentDate = aggregate.state.world.currentDate;
  const base = {
    world: {
      worldId: aggregate.state.world.id,
      name: aggregate.state.world.name,
      currentDate: { ...currentDate },
      phase: aggregate.runtime.phase,
      revision: aggregate.runtime.revision,
    },
    player: {
      playerId: membership.playerId,
      promotionId: null as Id | null,
    },
  };

  const control = activePromotionControlForPlayer(aggregate.ownership, playerId);
  if (!control) return { ...base, promotion: null };
  base.player.promotionId = control.promotionId;

  const promotion = aggregate.state.promotions.find((candidate) => candidate.id === control.promotionId);
  if (!promotion) throw new Error(`controlled promotion ${control.promotionId} was not found`);
  const workspace = aggregate.planning.workspaces.find((candidate) => candidate.promotionId === promotion.id) ?? null;
  const markets = aggregate.state.markets
    .map((market) => ({
      marketId: market.id,
      name: market.name,
      isHomeMarket: market.id === promotion.homeMarketId,
      venues: aggregate.state.venues
        .filter((venue) => venue.marketId === market.id)
        .map((venue) => ({
          venueId: venue.id,
          name: venue.name,
          capacity: venue.capacity,
          weeklyHireCost: venue.weeklyHireCost,
          prestige: venue.prestige,
        }))
        .sort((left, right) => left.weeklyHireCost - right.weeklyHireCost || left.name.localeCompare(right.name)),
    }))
    .sort((left, right) => Number(right.isHomeMarket) - Number(left.isHomeMarket) || left.name.localeCompare(right.name));

  const weeks: PlayerPlannerWeekView[] = Array.from(
    { length: DETAILED_PLANNING_HORIZON_WEEKS },
    (_, offset) => {
      const targetDate = addPpwWeeks(
        { year: currentDate.year, week: currentDate.week, day: 1 },
        offset,
        aggregate.state.ruleset.weeksPerYear,
      );
      const required = showRequiredInWeek(aggregate, promotion.id, targetDate);
      const shows = (workspace?.detailedShowDrafts ?? [])
        .filter((draft) => sameWeek(draft.targetDate, targetDate))
        .sort((left, right) => left.targetDate.day - right.targetDate.day || left.draftId.localeCompare(right.draftId))
        .map((draft) => showView(aggregate, promotion.id, draft));
      return {
        offset,
        year: targetDate.year,
        week: targetDate.week,
        isCurrentWeek: offset === 0,
        showRequired: required,
        canPlan: required && aggregate.runtime.phase === "OPEN",
        minParticipants: aggregate.state.ruleset.minEventParticipants,
        maxParticipants: maxShowParticipants(
          promotion.tier,
          targetDate,
          aggregate.state.ruleset.weeksPerYear,
          aggregate.state.ruleset.majorEventIntervalWeeks,
        ),
        eligibleParticipants: eligibleParticipantsForWeek(aggregate, promotion.id, targetDate),
        shows,
      };
    },
  );

  return {
    ...base,
    promotion: {
      promotionId: promotion.id,
      name: promotion.name,
      homeMarketId: promotion.homeMarketId,
      workspaceVersion: workspace?.version ?? 0,
      horizonWeeks: DETAILED_PLANNING_HORIZON_WEEKS,
      ticketStrategies: [...PLANNER_TICKET_STRATEGIES],
      markets,
      weeks,
    },
  };
}
