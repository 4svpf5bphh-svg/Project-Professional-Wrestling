import type { WrestlerAlignment } from "../../domain/src/alignment.js";
import type { Id, MatchType, PersonStatus, PpwDate, TicketStrategy } from "../../domain/src/types.js";
import { addPpwWeeks, comparePpwDates, ppwDateToWeekIndex } from "../../sim-core/src/clock.js";
import { activePromotionControlForPlayer, activeWorldMembership } from "./ownership.js";
import {
  DETAILED_PLANNING_HORIZON_WEEKS,
  type DetailedShowDraft,
  type DetailedShowSegmentType,
} from "./planning.js";
import {
  playerShowPlanningStatus,
  type PlayerShowPlanningAction,
  type PlayerShowPlanningState,
  type PlayerShowReadiness,
} from "./planning-status.js";
import { maxShowParticipantsForDate } from "./show-capacity.js";
import type { ApplicationWorldAggregate } from "./world-aggregate.js";

export type PlayerPlannerShowState = "UNPLANNED" | PlayerShowPlanningState;

export interface PlayerPlannerParticipantView {
  personId: Id;
  name: string;
}

export interface PlayerPlannerMatchView {
  draftMatchId: string;
  order: number;
  isMainEvent: boolean;
  type: MatchType;
  sideANames: string[];
  sideBNames: string[];
  plannedLengthMinutes: number | null;
}

export interface PlayerPlannerSegmentView {
  draftSegmentId: string;
  type: DetailedShowSegmentType;
  participantNames: string[];
  programmeId: Id | null;
  plannedLengthMinutes: number;
  turnPersonName: string | null;
  turnTargetAlignment: WrestlerAlignment | null;
}

export type PlayerPlannerRunningOrderView =
  | { kind: "MATCH"; refId: string; order: number; match: PlayerPlannerMatchView }
  | { kind: "SEGMENT"; refId: string; order: number; segment: PlayerPlannerSegmentView };

export interface PlayerPlannerTalentOptionView {
  personId: Id;
  name: string;
  status: PersonStatus;
  popularity: number;
  momentum: number;
  morale: number;
  datesRemaining: number;
}

export type PlayerPlannerMarketPresence = "STRONG" | "ESTABLISHED" | "DEVELOPING" | "LIGHT";

export interface PlayerPlannerMarketRivalView {
  promotionId: Id;
  name: string;
  tier: PromotionTier;
  isHomePromotion: boolean;
  presence: PlayerPlannerMarketPresence;
}

export interface PlayerPlannerVenueOptionView {
  venueId: Id;
  name: string;
  capacity: number;
  weeklyHireCost: number;
  prestige: number;
  productionSuitability: number;
}

export interface PlayerPlannerMarketOptionView {
  marketId: Id;
  name: string;
  isHomeMarket: boolean;
  audiencePotential: number;
  wrestlingInterest: number;
  spendingIndex: number;
  maturity: number;
  yourAwareness: number;
  yourLiveStrength: number;
  yourLoyalty: number;
  yourPresence: PlayerPlannerMarketPresence;
  homePromotions: Array<{
    promotionId: Id;
    name: string;
    tier: PromotionTier;
  }>;
  strongestRivals: PlayerPlannerMarketRivalView[];
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
  matches: PlayerPlannerMatchView[];
  segments: PlayerPlannerSegmentView[];
  runningOrder: PlayerPlannerRunningOrderView[];
  plannedMatchMinutes: number;
  plannedSegmentMinutes: number;
  plannedShowMinutes: number;
  reservedParticipantCount: number;
  matchCount: number;
  segmentCount: number;
  slotCount: number;
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

function marketPresenceScore(awareness: number, liveStrength: number, loyalty: number): number {
  return liveStrength * 0.5 + awareness * 0.3 + loyalty * 0.2;
}

function marketPresenceBand(score: number): PlayerPlannerMarketPresence {
  if (score >= 70) return "STRONG";
  if (score >= 45) return "ESTABLISHED";
  if (score >= 25) return "DEVELOPING";
  return "LIGHT";
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
  const lastMatchId = draft.runningOrder
    ? [...draft.runningOrder].reverse().find((slot) => slot.kind === "MATCH")?.refId ?? draft.matches.at(-1)?.draftMatchId ?? null
    : draft.matches.at(-1)?.draftMatchId ?? null;
  const matches = draft.matches.map((match, index): PlayerPlannerMatchView => ({
    draftMatchId: match.draftMatchId,
    order: index + 1,
    isMainEvent: match.draftMatchId === lastMatchId,
    type: match.type,
    sideANames: match.sideAIds.map((personId) => peopleById.get(personId)?.name ?? "Unknown wrestler"),
    sideBNames: match.sideBIds.map((personId) => peopleById.get(personId)?.name ?? "Unknown wrestler"),
    plannedLengthMinutes: match.plannedLengthMinutes,
  }));
  const segmentDrafts = [
    ...(draft.segments ?? []),
    ...(draft.programmeSegments ?? [])
      .filter((legacy) => !(draft.segments ?? []).some((segment) => segment.draftSegmentId === legacy.draftSegmentId))
      .map((legacy) => ({
        draftSegmentId: legacy.draftSegmentId,
        type: "PROMO" as const,
        participantIds: [...legacy.participantIds],
        programmeId: legacy.programmeId,
        plannedLengthMinutes: 6,
        turnPersonId: null,
        turnTargetAlignment: null,
      })),
  ];
  const segments = segmentDrafts.map((segment): PlayerPlannerSegmentView => ({
    draftSegmentId: segment.draftSegmentId,
    type: segment.type,
    participantNames: segment.participantIds.map((personId) => peopleById.get(personId)?.name ?? "Unknown wrestler"),
    programmeId: segment.programmeId,
    plannedLengthMinutes: segment.plannedLengthMinutes,
    turnPersonName: segment.type === "TURN" && segment.turnPersonId
      ? peopleById.get(segment.turnPersonId)?.name ?? "Unknown wrestler"
      : null,
    turnTargetAlignment: segment.type === "TURN" ? (segment.turnTargetAlignment ?? null) : null,
  }));
  const matchesById = new Map(matches.map((match) => [match.draftMatchId, match]));
  const segmentsById = new Map(segments.map((segment) => [segment.draftSegmentId, segment]));
  const defaultOrder = [
    ...matches.map((match) => ({ kind: "MATCH" as const, refId: match.draftMatchId })),
    ...segments.map((segment) => ({ kind: "SEGMENT" as const, refId: segment.draftSegmentId })),
  ];
  const sourceOrder = draft.runningOrder ?? defaultOrder;
  const runningOrder = sourceOrder.flatMap((slot, index): PlayerPlannerRunningOrderView[] => {
    if (slot.kind === "MATCH") {
      const match = matchesById.get(slot.refId);
      return match ? [{ kind: "MATCH", refId: slot.refId, order: index + 1, match }] : [];
    }
    const segment = segmentsById.get(slot.refId);
    return segment ? [{ kind: "SEGMENT", refId: slot.refId, order: index + 1, segment }] : [];
  });
  const plannedMatchMinutes = matches.reduce((sum, match) => sum + (match.plannedLengthMinutes ?? 0), 0);
  const plannedSegmentMinutes = segments.reduce((sum, segment) => sum + segment.plannedLengthMinutes, 0);

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
    matches,
    segments,
    runningOrder,
    plannedMatchMinutes,
    plannedSegmentMinutes,
    plannedShowMinutes: plannedMatchMinutes + plannedSegmentMinutes,
    reservedParticipantCount: reservation?.participants.length ?? 0,
    matchCount: matches.length,
    segmentCount: segments.length,
    slotCount: runningOrder.length,
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
  const marketStateByKey = new Map(
    aggregate.state.promotionMarketStates.map((entry) => [`${entry.promotionId}:${entry.marketId}`, entry]),
  );
  const markets = aggregate.state.markets
    .map((market): PlayerPlannerMarketOptionView => {
      const ownState = marketStateByKey.get(`${promotion.id}:${market.id}`);
      const yourAwareness = ownState?.awareness ?? 0;
      const yourLiveStrength = ownState?.liveStrength ?? 0;
      const yourLoyalty = ownState?.loyalty ?? 0;
      const activeRivals = aggregate.state.promotions
        .filter((candidate) => (
          candidate.id !== promotion.id
          && candidate.lifecycle !== "DORMANT"
          && candidate.lifecycle !== "CLOSED"
        ))
        .map((candidate) => {
          const local = marketStateByKey.get(`${candidate.id}:${market.id}`);
          const score = marketPresenceScore(
            local?.awareness ?? 0,
            local?.liveStrength ?? 0,
            local?.loyalty ?? 0,
          );
          return {
            promotionId: candidate.id,
            name: candidate.name,
            tier: candidate.tier,
            isHomePromotion: candidate.homeMarketId === market.id,
            presence: marketPresenceBand(score),
            score,
          };
        })
        .sort((left, right) => (
          right.score - left.score
          || Number(right.isHomePromotion) - Number(left.isHomePromotion)
          || left.name.localeCompare(right.name)
        ));

      return {
        marketId: market.id,
        name: market.name,
        isHomeMarket: market.id === promotion.homeMarketId,
        audiencePotential: market.audiencePotential,
        wrestlingInterest: market.wrestlingInterest,
        spendingIndex: market.spendingIndex,
        maturity: market.maturity,
        yourAwareness,
        yourLiveStrength,
        yourLoyalty,
        yourPresence: marketPresenceBand(marketPresenceScore(yourAwareness, yourLiveStrength, yourLoyalty)),
        homePromotions: aggregate.state.promotions
          .filter((candidate) => (
            candidate.id !== promotion.id
            && candidate.homeMarketId === market.id
            && candidate.lifecycle !== "DORMANT"
            && candidate.lifecycle !== "CLOSED"
          ))
          .map((candidate) => ({
            promotionId: candidate.id,
            name: candidate.name,
            tier: candidate.tier,
          }))
          .sort((left, right) => left.name.localeCompare(right.name)),
        strongestRivals: activeRivals.slice(0, 3).map(({ score: _score, ...rival }) => rival),
        venues: aggregate.state.venues
          .filter((venue) => venue.marketId === market.id)
          .map((venue) => ({
            venueId: venue.id,
            name: venue.name,
            capacity: venue.capacity,
            weeklyHireCost: venue.weeklyHireCost,
            prestige: venue.prestige,
            productionSuitability: venue.productionSuitability,
          }))
          .sort((left, right) => left.weeklyHireCost - right.weeklyHireCost || left.name.localeCompare(right.name)),
      };
    })
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
        maxParticipants: maxShowParticipantsForDate(
          aggregate.state,
          promotion,
          targetDate,
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
