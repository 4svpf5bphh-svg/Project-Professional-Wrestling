import type {
  Id,
  InjurySeverity,
  MatchIntent,
  MatchSide,
  MatchType,
  PpwDate,
  WrestlingEventType,
} from "../../domain/src/types.js";
import {
  activePromotionControlForPlayer,
  activeWorldMembership,
} from "./ownership.js";
import type { ApplicationWorldAggregate } from "./world-aggregate.js";

export const PLAYER_SHOW_HISTORY_LIMIT = 12;

export interface PlayerShowParticipantView {
  personId: Id;
  name: string;
  side: MatchSide;
  won: boolean;
}

export interface PlayerShowInjuryView {
  injuryId: Id;
  personId: Id;
  personName: string;
  severity: InjurySeverity;
  weeksOut: number;
}

export interface PlayerShowTitleOutcomeView {
  championshipId: Id;
  championshipName: string;
  titleChanged: boolean;
  previousHolderName: string | null;
  winnerHolderName: string;
}

export interface PlayerShowMatchView {
  matchId: Id;
  order: number;
  isMainEvent: boolean;
  type: MatchType;
  intent: MatchIntent;
  plannedLengthMinutes: number;
  actualLengthMinutes: number;
  criticalRatingStars: number;
  executionQuality: number;
  crowdResponse: number;
  finishChangedDueToInjury: boolean;
  participants: PlayerShowParticipantView[];
  winnerNames: string[];
  titleOutcomes: PlayerShowTitleOutcomeView[];
  injuries: PlayerShowInjuryView[];
}

export interface PlayerShowResultView {
  eventId: Id;
  date: PpwDate;
  type: WrestlingEventType;
  marketName: string;
  venueName: string;
  venueCapacity: number;
  attendance: number;
  attendancePercentOfCapacity: number;
  gateRevenue: number;
  totalCost: number;
  netResult: number;
  averageMatchRating: number;
  bestMatchRating: number;
  crowdResponse: number;
  matchCount: number;
  titleChangeCount: number;
  injuryCount: number;
  matches: PlayerShowMatchView[];
}

export interface PlayerShowHistoryView {
  world: {
    worldId: Id;
    name: string;
    currentDate: PpwDate;
  };
  player: {
    playerId: string;
    promotionId: Id | null;
  };
  promotion: {
    promotionId: Id;
    name: string;
  } | null;
  shows: PlayerShowResultView[];
}

function dateOrdinal(aggregate: ApplicationWorldAggregate, date: PpwDate): number {
  return (((date.year - 1) * aggregate.state.ruleset.weeksPerYear) + (date.week - 1)) * 7 + date.day;
}

function holderName(aggregate: ApplicationWorldAggregate, holderId: Id): string {
  const person = aggregate.state.people.find((candidate) => candidate.id === holderId);
  if (person) return person.name;
  const team = (aggregate.state.teams ?? []).find((candidate) => candidate.id === holderId);
  return team?.name ?? "Unknown holder";
}

function clampPercentage(value: number): number {
  return Math.max(0, Math.round(value * 10) / 10);
}

function validatedLimit(limit: number): number {
  if (!Number.isSafeInteger(limit) || limit < 1 || limit > 50) {
    throw new Error("show-history limit must be an integer from 1 to 50");
  }
  return limit;
}

/**
 * Builds a player-safe show-history projection for the promotion they control.
 * It deliberately exposes no rival contract, planning or private business data.
 */
export function buildPlayerShowHistory(
  aggregate: ApplicationWorldAggregate,
  playerId: string,
  limit = PLAYER_SHOW_HISTORY_LIMIT,
): PlayerShowHistoryView {
  const membership = activeWorldMembership(aggregate.ownership, playerId);
  if (!membership) throw new Error(`${playerId} is not an active member of ${aggregate.state.world.id}`);
  const safeLimit = validatedLimit(limit);
  const control = activePromotionControlForPlayer(aggregate.ownership, playerId);
  const currentDate = { ...aggregate.state.world.currentDate };

  if (!control) {
    return {
      world: { worldId: aggregate.state.world.id, name: aggregate.state.world.name, currentDate },
      player: { playerId: membership.playerId, promotionId: null },
      promotion: null,
      shows: [],
    };
  }

  const promotion = aggregate.state.promotions.find((candidate) => candidate.id === control.promotionId);
  if (!promotion) throw new Error(`controlled promotion ${control.promotionId} no longer exists`);

  const peopleById = new Map(aggregate.state.people.map((person) => [person.id, person]));
  const marketsById = new Map(aggregate.state.markets.map((market) => [market.id, market]));
  const venuesById = new Map(aggregate.state.venues.map((venue) => [venue.id, venue]));
  const championshipsById = new Map((aggregate.state.championships ?? []).map((championship) => [championship.id, championship]));
  const contestsByMatch = new Map<Id, NonNullable<ApplicationWorldAggregate["state"]["championshipContests"]>>();
  for (const contest of aggregate.state.championshipContests ?? []) {
    const contests = contestsByMatch.get(contest.matchId) ?? [];
    contests.push(contest);
    contestsByMatch.set(contest.matchId, contests);
  }
  const injuriesByMatch = new Map<Id, ApplicationWorldAggregate["state"]["injuries"]>();
  for (const injury of aggregate.state.injuries) {
    const injuries = injuriesByMatch.get(injury.matchId) ?? [];
    injuries.push(injury);
    injuriesByMatch.set(injury.matchId, injuries);
  }
  const participantsByMatch = new Map<Id, ApplicationWorldAggregate["state"]["matchParticipants"]>();
  for (const participant of aggregate.state.matchParticipants) {
    const participants = participantsByMatch.get(participant.matchId) ?? [];
    participants.push(participant);
    participantsByMatch.set(participant.matchId, participants);
  }

  const shows = aggregate.state.events
    .filter((event) => event.promotionId === promotion.id && event.status === "COMPLETED")
    .sort((left, right) => dateOrdinal(aggregate, right.date) - dateOrdinal(aggregate, left.date) || right.id.localeCompare(left.id))
    .slice(0, safeLimit)
    .map((event): PlayerShowResultView => {
      const venue = venuesById.get(event.venueId);
      const eventMatches = aggregate.state.matches
        .filter((match) => match.eventId === event.id && match.promotionId === promotion.id && match.status === "COMPLETED")
        .sort((left, right) => left.order - right.order || left.id.localeCompare(right.id));
      const mainEventOrder = eventMatches.reduce((highest, match) => Math.max(highest, match.order), 0);

      const matches = eventMatches.map((match): PlayerShowMatchView => {
        const participants = (participantsByMatch.get(match.id) ?? [])
          .map((participant): PlayerShowParticipantView => ({
            personId: participant.personId,
            name: peopleById.get(participant.personId)?.name ?? "Unknown wrestler",
            side: participant.side,
            won: participant.won,
          }))
          .sort((left, right) => left.side.localeCompare(right.side) || left.name.localeCompare(right.name));
        const titleOutcomes = (contestsByMatch.get(match.id) ?? []).map((contest): PlayerShowTitleOutcomeView => ({
          championshipId: contest.championshipId,
          championshipName: championshipsById.get(contest.championshipId)?.name ?? "Championship",
          titleChanged: contest.titleChanged,
          previousHolderName: contest.previousHolderId ? holderName(aggregate, contest.previousHolderId) : null,
          winnerHolderName: holderName(aggregate, contest.winnerHolderId),
        }));
        const injuries = (injuriesByMatch.get(match.id) ?? []).map((injury): PlayerShowInjuryView => ({
          injuryId: injury.id,
          personId: injury.personId,
          personName: peopleById.get(injury.personId)?.name ?? "Unknown wrestler",
          severity: injury.severity,
          weeksOut: injury.weeksOut,
        }));

        return {
          matchId: match.id,
          order: match.order,
          isMainEvent: match.order === mainEventOrder,
          type: match.type,
          intent: match.intent,
          plannedLengthMinutes: match.plannedLengthMinutes,
          actualLengthMinutes: match.actualLengthMinutes,
          criticalRatingStars: match.criticalRatingStars,
          executionQuality: match.executionQuality,
          crowdResponse: match.crowdResponse,
          finishChangedDueToInjury: match.finishChangedDueToInjury,
          participants,
          winnerNames: participants.filter((participant) => participant.won).map((participant) => participant.name),
          titleOutcomes,
          injuries,
        };
      });

      const titleChangeCount = matches.reduce(
        (sum, match) => sum + match.titleOutcomes.filter((outcome) => outcome.titleChanged).length,
        0,
      );
      const injuryCount = matches.reduce((sum, match) => sum + match.injuries.length, 0);
      const venueCapacity = venue?.capacity ?? 0;

      return {
        eventId: event.id,
        date: { ...event.date },
        type: event.type,
        marketName: marketsById.get(event.marketId)?.name ?? "Unknown market",
        venueName: venue?.name ?? "Unknown venue",
        venueCapacity,
        attendance: event.attendance,
        attendancePercentOfCapacity: venueCapacity > 0 ? clampPercentage((event.attendance / venueCapacity) * 100) : 0,
        gateRevenue: event.gateRevenue,
        totalCost: event.totalCost,
        netResult: event.netResult,
        averageMatchRating: event.averageMatchRating,
        bestMatchRating: event.bestMatchRating,
        crowdResponse: event.crowdResponse,
        matchCount: matches.length,
        titleChangeCount,
        injuryCount,
        matches,
      };
    });

  return {
    world: { worldId: aggregate.state.world.id, name: aggregate.state.world.name, currentDate },
    player: { playerId: membership.playerId, promotionId: promotion.id },
    promotion: { promotionId: promotion.id, name: promotion.name },
    shows,
  };
}
